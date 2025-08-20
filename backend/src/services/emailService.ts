import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { prisma } from "./prismaService";
import config from "../config";
import { EmailLog } from "../types/interfaces";

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
  data?: Record<string, any>;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  template?: {
    name: string;
    data: Record<string, any>;
  };
  priority?: "high" | "normal" | "low";
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface BulkEmailOptions {
  template: string;
  recipients: Array<{
    email: string;
    data: Record<string, any>;
  }>;
  subject: string;
  clientId: string;
  userId?: string;
  batchSize?: number;
  delayMs?: number;
}

/**
 * Email Service with Templates and SMTP Integration
 * Handles email sending, templating, logging, and bulk operations
 */
export class EmailService {
  private transporter!: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private templatesPath: string;

  constructor() {
    this.templatesPath = path.join(__dirname, "../templates/email");
    this.registerHandlebarsHelpers();
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Register Handlebars helpers for template functionality
   */
  private registerHandlebarsHelpers() {
    // Equality helper for conditionals
    handlebars.registerHelper("eq", function (a: any, b: any) {
      return a === b;
    });

    // Not equal helper
    handlebars.registerHelper("ne", function (a: any, b: any) {
      return a !== b;
    });

    // Greater than helper
    handlebars.registerHelper("gt", function (a: any, b: any) {
      return a > b;
    });

    // Less than helper
    handlebars.registerHelper("lt", function (a: any, b: any) {
      return a < b;
    });

    // Greater than or equal helper
    handlebars.registerHelper("gte", function (a: any, b: any) {
      return a >= b;
    });

    // Less than or equal helper
    handlebars.registerHelper("lte", function (a: any, b: any) {
      return a <= b;
    });

    // Logical AND helper
    handlebars.registerHelper("and", function (...args: any[]) {
      // Remove the last argument which is the options object
      const values = args.slice(0, -1);
      return values.every(Boolean);
    });

    // Logical OR helper
    handlebars.registerHelper("or", function (...args: any[]) {
      // Remove the last argument which is the options object
      const values = args.slice(0, -1);
      return values.some(Boolean);
    });

    console.log("📧 Handlebars helpers registered successfully");
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter() {
    const smtpConfig = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        console.error("📧 SMTP connection error:", error);
      } else {
        console.log("📧 SMTP server ready for email sending");
      }
    });
  }

  /**
   * Load and compile email templates
   */
  private async loadTemplates() {
    try {
      // Create templates directory if it doesn't exist
      await fs.mkdir(this.templatesPath, { recursive: true });

      // Load all .hbs files from templates directory
      const templateFiles = await fs.readdir(this.templatesPath);

      for (const file of templateFiles) {
        if (file.endsWith(".hbs")) {
          const templateName = path.basename(file, ".hbs");
          const templatePath = path.join(this.templatesPath, file);
          const templateContent = await fs.readFile(templatePath, "utf-8");

          const compiledTemplate = handlebars.compile(templateContent);
          this.templates.set(templateName, compiledTemplate);

          console.log(`📧 Loaded email template: ${templateName}`);
        }
      }

      // Create default templates if none exist
      if (this.templates.size === 0) {
        await this.createDefaultTemplates();
      }
    } catch (error) {
      console.error("📧 Error loading email templates:", error);
      // Create default templates on error
      await this.createDefaultTemplates();
    }
  }

  /**
   * Create default email templates
   */
  private async createDefaultTemplates() {
    const defaultTemplates = {
      welcome: {
        subject: "Welcome to {{clientName}}!",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to {{clientName}}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to {{clientName}}!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We're excited to have you on board</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p>Hi {{firstName}},</p>
            
            <p>Welcome to our video conferencing platform! Your account has been successfully created.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account Details:</h3>
              <p><strong>Email:</strong> {{email}}</p>
              <p><strong>Role:</strong> {{role}}</p>
              {{#if tempPassword}}
              <p><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">{{tempPassword}}</code></p>
              <p style="color: #dc3545; font-size: 14px;"><strong>Important:</strong> Please change your password after first login.</p>
              {{/if}}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{loginUrl}}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Login to Your Account</a>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Best regards,<br>The {{clientName}} Team</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated email from {{clientName}}. Please do not reply to this email.</p>
          </div>
        </body>
        </html>`,
      },

      "meeting-invitation": {
        subject: "Meeting Invitation: {{meetingTitle}}",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Meeting Invitation: {{meetingTitle}}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px 20px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">📅 Meeting Invitation</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You're invited to join a meeting</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #28a745; margin-top: 0;">{{meetingTitle}}</h2>
            
            {{#if meetingDescription}}
            <p style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
              {{meetingDescription}}
            </p>
            {{/if}}
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">📋 Meeting Details</h3>
              <p><strong>🕒 Date & Time:</strong> {{meetingDate}} at {{meetingTime}} {{timezone}}</p>
              <p><strong>⏱️ Duration:</strong> {{duration}} minutes</p>
              <p><strong>👤 Organizer:</strong> {{organizerName}} ({{organizerEmail}})</p>
              <p><strong>🔗 Meeting ID:</strong> {{meetingId}}</p>
              {{#if meetingPassword}}
              <p><strong>🔐 Password:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">{{meetingPassword}}</code></p>
              {{/if}}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{joinUrl}}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin-right: 10px;">🚀 Join Meeting</a>
              {{#if addToCalendarUrl}}
              <a href="{{addToCalendarUrl}}" style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">📅 Add to Calendar</a>
              {{/if}}
            </div>
            
            {{#if agenda}}
            <div style="margin: 20px 0;">
              <h3>📝 Agenda</h3>
              <ul style="padding-left: 20px;">
                {{#each agenda}}
                <li style="margin-bottom: 5px;">{{this}}</li>
                {{/each}}
              </ul>
            </div>
            {{/if}}
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
              <h4 style="margin-top: 0;">💡 Meeting Tips:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Join a few minutes early to test your audio/video</li>
                <li>Use a stable internet connection for best quality</li>
                <li>Mute your microphone when not speaking</li>
              </ul>
            </div>
            
            <p>See you there!</p>
            
            <p>Best regards,<br>{{organizerName}}</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #666; font-size: 12px;">
            <p>This meeting invitation was sent via {{clientName}}. If you cannot attend, please notify the organizer.</p>
          </div>
        </body>
        </html>`,
      },

      "password-reset": {
        subject: "Password Reset Request - {{clientName}}",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); padding: 30px 20px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🔐 Password Reset Request</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Secure your account</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p>Hi {{firstName}},</p>
            
            <p>We received a request to reset your password for your {{clientName}} account.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">⚠️ Security Notice</h3>
              <p><strong>Email:</strong> {{email}}</p>
              <p><strong>Request Time:</strong> {{requestTime}}</p>
              <p><strong>IP Address:</strong> {{ipAddress}}</p>
              <p><strong>Expires in:</strong> {{expiresIn}}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{resetUrl}}" style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">🔓 Reset Password</a>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px; border-left: 4px solid #dc3545;">
              <p style="margin: 0;"><strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            
            <p>For security reasons, this link will expire in {{expiresIn}}.</p>
            
            <p>If you're having trouble clicking the button above, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 3px; font-size: 12px;">{{resetUrl}}</p>
            
            <p>Best regards,<br>The {{clientName}} Security Team</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated security email from {{clientName}}. Please do not reply to this email.</p>
            <p>If you need help, please contact our support team.</p>
          </div>
        </body>
        </html>`,
      },

      "meeting-reminder": {
        subject: "Meeting Reminder: {{meetingTitle}} starts in {{timeUntil}}",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Meeting Reminder: {{meetingTitle}}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px 20px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">⏰ Meeting Reminder</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your meeting starts in {{timeUntil}}</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #ffc107; margin-top: 0;">{{meetingTitle}}</h2>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">📋 Meeting Details</h3>
              <p><strong>🕒 Starts:</strong> {{meetingDate}} at {{meetingTime}} {{timezone}}</p>
              <p><strong>⏱️ Duration:</strong> {{duration}} minutes</p>
              <p><strong>👤 Organizer:</strong> {{organizerName}}</p>
              <p><strong>🔗 Meeting ID:</strong> {{meetingId}}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{joinUrl}}" style="background: #ffc107; color: #212529; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">🚀 Join Now</a>
            </div>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 14px;">
              <h4 style="margin-top: 0; color: #155724;">✅ Pre-Meeting Checklist:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Test your camera and microphone</li>
                <li>Ensure stable internet connection</li>
                <li>Have meeting materials ready</li>
                <li>Find a quiet space</li>
              </ul>
            </div>
            
            <p>We look forward to seeing you in the meeting!</p>
            
            <p>Best regards,<br>{{organizerName}}</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #666; font-size: 12px;">
            <p>This reminder was sent via {{clientName}}. You can manage your notification preferences in your account settings.</p>
          </div>
        </body>
        </html>`,
      },
    };

    // Create template files
    for (const [templateName, template] of Object.entries(defaultTemplates)) {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      try {
        await fs.writeFile(templatePath, template.html);
        const compiledTemplate = handlebars.compile(template.html);
        this.templates.set(templateName, compiledTemplate);
        console.log(`📧 Created default template: ${templateName}`);
      } catch (error) {
        console.error(`📧 Error creating template ${templateName}:`, error);
      }
    }
  }

  /**
   * Send email with template or direct content
   */
  async sendEmail(
    options: EmailOptions,
    clientId: string,
    userId?: string,
  ): Promise<EmailLog> {
    const emailLog: Partial<EmailLog> = {
      to: Array.isArray(options.to) ? options.to : [options.to],
      cc: options.cc
        ? Array.isArray(options.cc)
          ? options.cc
          : [options.cc]
        : undefined,
      bcc: options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc
          : [options.bcc]
        : undefined,
      subject: options.subject,
      template: options.template?.name,
      status: "PENDING",
      clientId,
      userId,
      metadata: options.metadata,
    };

    try {
      // Prepare email content
      let html = options.html;
      let text = options.text;

      // Use template if specified
      if (options.template) {
        const template = this.templates.get(options.template.name);
        if (!template) {
          throw new Error(`Template '${options.template.name}' not found`);
        }

        html = template(options.template.data);
        // Simple text version by stripping HTML tags (basic implementation)
        text = html
          ?.replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }

      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html,
        text,
        attachments: options.attachments,
        priority: options.priority || "normal",
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // Update log with success
      emailLog.status = "SENT";
      emailLog.sentAt = new Date();
      emailLog.messageId = info.messageId;

      console.log(
        `📧 Email sent successfully to ${emailLog.to}: ${options.subject}`,
      );
    } catch (error) {
      // Update log with failure
      emailLog.status = "FAILED";
      emailLog.failedAt = new Date();
      emailLog.errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(`📧 Email sending failed:`, error);
      throw error;
    } finally {
      // Save log to database
      const savedLog = await prisma.emailLog.create({
        data: {
          ...(emailLog as any),
          to: JSON.stringify(emailLog.to),
          cc: emailLog.cc ? JSON.stringify(emailLog.cc) : undefined,
          bcc: emailLog.bcc ? JSON.stringify(emailLog.bcc) : undefined,
          metadata: emailLog.metadata
            ? JSON.stringify(emailLog.metadata)
            : undefined,
        },
      });

      return {
        ...(emailLog as EmailLog),
        id: savedLog.id,
      };
    }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(
    options: BulkEmailOptions,
  ): Promise<{ sent: number; failed: number; logs: EmailLog[] }> {
    const {
      template,
      recipients,
      subject,
      clientId,
      userId,
      batchSize = 10,
      delayMs = 1000,
    } = options;

    const results: EmailLog[] = [];
    let sent = 0;
    let failed = 0;

    console.log(
      `📧 Starting bulk email send: ${recipients.length} recipients using template '${template}'`,
    );

    // Process recipients in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      // Send batch in parallel
      const batchPromises = batch.map(async (recipient) => {
        try {
          const emailLog = await this.sendEmail(
            {
              to: recipient.email,
              subject,
              template: {
                name: template,
                data: recipient.data,
              },
            },
            clientId,
            userId,
          );

          if (emailLog.status === "SENT") {
            sent++;
          } else {
            failed++;
          }

          return emailLog;
        } catch (error) {
          failed++;
          return {
            id: `failed-${Date.now()}-${Math.random()}`,
            to: [recipient.email],
            subject,
            template,
            status: "FAILED" as const,
            failedAt: new Date(),
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            clientId,
            userId,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to avoid overwhelming SMTP server
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      console.log(
        `📧 Batch ${Math.floor(i / batchSize) + 1} completed: ${batchResults.length} emails processed`,
      );
    }

    console.log(`📧 Bulk email send completed: ${sent} sent, ${failed} failed`);

    return { sent, failed, logs: results };
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Render template with data (for preview)
   */
  renderTemplate(
    templateName: string,
    data: Record<string, any>,
  ): string | null {
    const template = this.templates.get(templateName);
    if (!template) {
      return null;
    }

    return template(data);
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log("📧 SMTP connection test successful");
      return true;
    } catch (error) {
      console.error("📧 SMTP connection test failed:", error);
      return false;
    }
  }

  /**
   * Get email logs
   */
  async getEmailLogs(
    clientId: string,
    options: {
      page?: number;
      limit?: number;
      status?: "pending" | "SENT" | "failed" | "bounced";
      template?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{
    logs: EmailLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }> {
    const {
      page = 1,
      limit = 50,
      status,
      template,
      startDate,
      endDate,
    } = options;

    const skip = (page - 1) * limit;
    const where: any = { clientId };

    if (status) where.status = status.toUpperCase();
    if (template) where.template = template;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        ...log,
        to: JSON.parse(log.to),
        cc: log.cc ? JSON.parse(log.cc) : null,
        bcc: log.bcc ? JSON.parse(log.bcc) : null,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

// Export singleton instance
export const emailService = new EmailService();

export default emailService;
