import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { emailService } from '../services/emailService';
import { googleCalendarService } from '../services/googleCalendarService';
import { authService } from '../services/authService';
import { 
  authenticate, 
  authorize,
  rateLimit,
  handleCorsAuth,
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware to all email routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);
router.use(authenticate);

// Rate limiting for email operations
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 email requests per window
  message: 'Too many email requests, please try again later'
});

const bulkEmailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 bulk email operations per hour
  message: 'Too many bulk email requests, please try again later'
});

router.use(emailRateLimit);

/**
 * POST /api/email/send
 * Send individual email
 */
router.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const {
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      template,
      attachments,
      priority,
      tags,
      metadata,
    } = req.body;

    // Validate required fields
    if (!to || !subject) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'to and subject are required'
      });
    }

    // Validate template if provided
    if (template) {
      if (!template.name || !template.data) {
        return res.status(400).json({
          error: 'Invalid template',
          message: 'template must include name and data fields'
        });
      }

      const availableTemplates = emailService.getAvailableTemplates();
      if (!availableTemplates.includes(template.name)) {
        return res.status(400).json({
          error: 'Template not found',
          message: `Available templates: ${availableTemplates.join(', ')}`
        });
      }
    }

    if (!template && !html && !text) {
      return res.status(400).json({
        error: 'Missing content',
        message: 'Either template, html, or text content is required'
      });
    }

    const emailLog = await emailService.sendEmail({
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      template,
      attachments,
      priority,
      tags,
      metadata,
    }, currentUser.clientId, req.user.id);

    res.json({
      success: true,
      emailLog: {
        id: emailLog.id,
        status: emailLog.status,
        to: emailLog.to,
        subject: emailLog.subject,
        sentAt: emailLog.sentAt,
        messageId: emailLog.messageId,
      },
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/email/send-bulk
 * Send bulk emails with template
 */
router.post('/send-bulk', bulkEmailRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const {
      template,
      recipients,
      subject,
      batchSize = 10,
      delayMs = 1000,
    } = req.body;

    // Validate required fields
    if (!template || !recipients || !Array.isArray(recipients) || !subject) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'template, recipients (array), and subject are required'
      });
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No recipients',
        message: 'At least one recipient is required'
      });
    }

    if (recipients.length > 1000) {
      return res.status(400).json({
        error: 'Too many recipients',
        message: 'Maximum 1000 recipients allowed per bulk send'
      });
    }

    // Validate template exists
    const availableTemplates = emailService.getAvailableTemplates();
    if (!availableTemplates.includes(template)) {
      return res.status(400).json({
        error: 'Template not found',
        message: `Available templates: ${availableTemplates.join(', ')}`
      });
    }

    // Validate recipient format
    for (const recipient of recipients) {
      if (!recipient.email || typeof recipient.email !== 'string') {
        return res.status(400).json({
          error: 'Invalid recipient format',
          message: 'Each recipient must have an email field'
        });
      }

      if (!recipient.data || typeof recipient.data !== 'object') {
        return res.status(400).json({
          error: 'Invalid recipient format',
          message: 'Each recipient must have a data field with template variables'
        });
      }
    }

    console.log(`📧 Starting bulk email send: ${recipients.length} recipients`);

    const result = await emailService.sendBulkEmails({
      template,
      recipients,
      subject,
      clientId: currentUser.clientId,
      userId: req.user.id,
      batchSize: Math.min(batchSize, 50), // Max 50 per batch
      delayMs: Math.max(delayMs, 500), // Min 500ms delay
    });

    res.json({
      success: true,
      summary: {
        total: recipients.length,
        sent: result.sent,
        failed: result.failed,
        successRate: Math.round((result.sent / recipients.length) * 100),
      },
      bulkId: `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      processedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error sending bulk email:', error);
    res.status(500).json({
      error: 'Failed to send bulk email',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/email/templates
 * Get available email templates
 */
router.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = emailService.getAvailableTemplates();
    
    res.json({
      success: true,
      templates: templates.map(name => ({
        name,
        displayName: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      })),
    });

  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/email/templates/preview
 * Preview email template with data
 */
router.post('/templates/preview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateName, data } = req.body;

    if (!templateName || !data) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'templateName and data are required'
      });
    }

    const availableTemplates = emailService.getAvailableTemplates();
    if (!availableTemplates.includes(templateName)) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Available templates: ${availableTemplates.join(', ')}`
      });
    }

    const renderedHtml = emailService.renderTemplate(templateName, data);
    
    if (!renderedHtml) {
      return res.status(500).json({
        error: 'Failed to render template',
        message: 'Template rendering error'
      });
    }

    res.json({
      success: true,
      preview: {
        templateName,
        renderedHtml,
        data,
      },
    });

  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      error: 'Failed to preview template',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/email/logs
 * Get email logs with pagination and filtering
 */
router.get('/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const status = req.query.status as 'pending' | 'SENT' | 'failed' | 'bounced' | undefined;
    const template = req.query.template as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await emailService.getEmailLogs(currentUser.clientId, {
      page,
      limit,
      status,
      template,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Error getting email logs:', error);
    res.status(500).json({
      error: 'Failed to get email logs',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/email/test-connection
 * Test SMTP connection (admin only)
 */
router.get('/test-connection', authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const connectionStatus = await emailService.testConnection();
    
    res.json({
      success: true,
      smtp: {
        connected: connectionStatus,
        host: process.env.SMTP_HOST || 'localhost',
        port: process.env.SMTP_PORT || '587',
        secure: process.env.SMTP_SECURE === 'true',
        testedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error testing SMTP connection:', error);
    res.status(500).json({
      error: 'Failed to test connection',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/email/calendar/create-event
 * Create Google Calendar event for meeting (admin only)
 */
router.post('/calendar/create-event', authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Missing meetingId',
        message: 'meetingId is required'
      });
    }

    if (!googleCalendarService.isAvailable()) {
      return res.status(503).json({
        error: 'Google Calendar not available',
        message: 'Google Calendar service is not configured'
      });
    }

    const eventId = await googleCalendarService.createEventFromMeeting(meetingId);

    if (!eventId) {
      return res.status(500).json({
        error: 'Failed to create calendar event',
        message: 'Google Calendar event creation failed'
      });
    }

    res.json({
      success: true,
      calendarEvent: {
        id: eventId,
        meetingId,
        createdAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({
      error: 'Failed to create calendar event',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/email/calendar/status
 * Get Google Calendar integration status (admin only)
 */
router.get('/calendar/status', authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = googleCalendarService.getStatus();
    const isConnected = await googleCalendarService.testConnection();

    res.json({
      success: true,
      calendar: {
        ...status,
        connected: isConnected,
        testedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error getting calendar status:', error);
    res.status(500).json({
      error: 'Failed to get calendar status',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;