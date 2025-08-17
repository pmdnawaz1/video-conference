import crypto from 'crypto';
import { emailService } from './emailService';
import { googleCalendarService } from './googleCalendarService';
import { prisma } from './prismaService';
import { authService } from './authService';

export interface MeetingInvitation {
  meetingId: string;
  recipientEmails: string[];
  customMessage?: string;
  includeCalendarEvent?: boolean;
}

export interface MeetingReminder {
  meetingId: string;
  minutesBefore: number;
  recipientEmails?: string[]; // If not provided, sends to all participants
}

export interface WelcomeNotification {
  userId: string;
  tempPassword?: string;
  loginUrl?: string;
}

export interface PasswordResetNotification {
  email: string;
  resetToken: string;
  expiresInHours: number;
  ipAddress?: string;
}

/**
 * Notification Service
 * Orchestrates email notifications and calendar integrations for various events
 */
export class NotificationService {

  /**
   * Send meeting invitation emails
   */
  async sendMeetingInvitation(invitation: MeetingInvitation): Promise<{ sent: number; failed: number }> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: invitation.meetingId },
        include: {
          creator: true,
          client: true,
          room: true,
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Create calendar event if requested
      let calendarEventId: string | null = null;
      if (invitation.includeCalendarEvent && googleCalendarService.isAvailable()) {
        try {
          calendarEventId = await googleCalendarService.createEventFromMeeting(invitation.meetingId);
        } catch (error) {
          console.warn('📅 Failed to create calendar event for invitation:', error);
        }
      }

      // Generate calendar links for external calendars
      const calendarLinks = googleCalendarService.createCalendarLinks(meeting);

      // Prepare template data
      const templateData = {
        meetingTitle: meeting.title,
        meetingDescription: meeting.description,
        meetingDate: meeting.startTime?.toLocaleDateString() || meeting.scheduledStartTime?.toLocaleDateString(),
        meetingTime: meeting.startTime?.toLocaleTimeString() || meeting.scheduledStartTime?.toLocaleTimeString(),
        timezone: meeting.timezone,
        duration: meeting.duration || 60,
        organizerName: `${meeting.creator.firstName} ${meeting.creator.lastName}`,
        organizerEmail: meeting.creator.email,
        meetingId: meeting.id,
        meetingPassword: meeting.meetingPassword,
        joinUrl: meeting.meetingUrl || meeting.joinUrl || `${process.env.FRONTEND_URL}/meeting/${meeting.id}`,
        addToCalendarUrl: calendarLinks ? calendarLinks.google : '',
        calendarLinks,
        clientName: meeting.client.name,
        customMessage: invitation.customMessage,
        agenda: [], // TODO: Add agenda field to meeting model
      };

      const recipients = invitation.recipientEmails.map(email => ({
        email,
        data: {
          ...templateData,
          firstName: email.split('@')[0], // Fallback name from email
        },
      }));

      const result = await emailService.sendBulkEmails({
        template: 'meeting-invitation',
        recipients,
        subject: `Meeting Invitation: ${meeting.title}`,
        clientId: meeting.clientId,
        userId: meeting.createdBy,
        batchSize: 10,
        delayMs: 500,
      });

      console.log(`📧 Meeting invitation sent for ${meeting.title}: ${result.sent} sent, ${result.failed} failed`);

      return { sent: result.sent, failed: result.failed };

    } catch (error) {
      console.error('Error sending meeting invitation:', error);
      throw error;
    }
  }

  /**
   * Send meeting reminder emails
   */
  async sendMeetingReminder(reminder: MeetingReminder): Promise<{ sent: number; failed: number }> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: reminder.meetingId },
        include: {
          creator: true,
          client: true,
          participants: {
            include: {
              user: true
            }
          },
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Determine recipients
      const recipientEmails = reminder.recipientEmails || 
        meeting.participants.map(p => p.user.email);

      if (recipientEmails.length === 0) {
        console.warn('📧 No recipients for meeting reminder');
        return { sent: 0, failed: 0 };
      }

      // Calculate time until meeting
      const meetingTime = meeting.startTime || meeting.scheduledStartTime;
      if (!meetingTime) {
        throw new Error('Meeting has no start time');
      }

      const timeUntil = this.formatTimeUntil(reminder.minutesBefore);

      const templateData = {
        meetingTitle: meeting.title,
        meetingDate: meetingTime.toLocaleDateString(),
        meetingTime: meetingTime.toLocaleTimeString(),
        timezone: meeting.timezone,
        duration: meeting.duration || 60,
        organizerName: `${meeting.creator.firstName} ${meeting.creator.lastName}`,
        meetingId: meeting.id,
        joinUrl: meeting.meetingUrl || meeting.joinUrl || `${process.env.FRONTEND_URL}/meeting/${meeting.id}`,
        timeUntil,
        clientName: meeting.client.name,
      };

      const recipients = recipientEmails.map(email => ({
        email,
        data: {
          ...templateData,
          firstName: email.split('@')[0], // Fallback name from email
        },
      }));

      const result = await emailService.sendBulkEmails({
        template: 'meeting-reminder',
        recipients,
        subject: `Meeting Reminder: ${meeting.title} starts in ${timeUntil}`,
        clientId: meeting.clientId,
        userId: meeting.createdBy,
        batchSize: 20,
        delayMs: 250,
      });

      console.log(`📧 Meeting reminder sent for ${meeting.title}: ${result.sent} sent, ${result.failed} failed`);

      return { sent: result.sent, failed: result.failed };

    } catch (error) {
      console.error('Error sending meeting reminder:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeNotification(notification: WelcomeNotification): Promise<boolean> {
    try {
      const user = await authService.getUserById(notification.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const templateData = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clientName: user.client.name,
        tempPassword: notification.tempPassword,
        loginUrl: notification.loginUrl || `${process.env.FRONTEND_URL}/login`,
      };

      const emailLog = await emailService.sendEmail({
        to: user.email,
        subject: `Welcome to ${user.client.name}!`,
        template: {
          name: 'welcome',
          data: templateData,
        },
        priority: 'normal',
        tags: ['welcome', 'onboarding'],
        metadata: {
          userId: user.id,
          userRole: user.role,
          hasPassword: !!notification.tempPassword,
        },
      }, user.clientId, notification.userId);

      console.log(`📧 Welcome email sent to ${user.email}: ${emailLog.status}`);

      return emailLog.status === 'SENT';

    } catch (error) {
      console.error('Error sending welcome notification:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetNotification(notification: PasswordResetNotification): Promise<boolean> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: notification.email },
        include: { client: true },
      });

      if (!user) {
        // For security, we don't reveal if email exists
        console.log(`📧 Password reset requested for non-existent email: ${notification.email}`);
        return true; // Return true to not reveal email existence
      }

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${notification.resetToken}`;
      const expiresIn = `${notification.expiresInHours} hour${notification.expiresInHours > 1 ? 's' : ''}`;

      const templateData = {
        firstName: user.firstName,
        email: user.email,
        clientName: user.client.name,
        resetUrl,
        requestTime: new Date().toLocaleString(),
        ipAddress: notification.ipAddress || 'Unknown',
        expiresIn,
      };

      const emailLog = await emailService.sendEmail({
        to: user.email,
        subject: `Password Reset Request - ${user.client.name}`,
        template: {
          name: 'password-reset',
          data: templateData,
        },
        priority: 'high',
        tags: ['security', 'password-reset'],
        metadata: {
          userId: user.id,
          resetToken: notification.resetToken,
          expiresInHours: notification.expiresInHours,
          requestIp: notification.ipAddress,
        },
      }, user.clientId);

      console.log(`📧 Password reset email sent to ${user.email}: ${emailLog.status}`);

      return emailLog.status === 'SENT';

    } catch (error) {
      console.error('Error sending password reset notification:', error);
      throw error;
    }
  }

  /**
   * Send bulk invitations for new user onboarding
   */
  async sendBulkInvitations(invitations: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    customMessage?: string;
  }>, clientId: string, senderId: string): Promise<{ sent: number; failed: number; invitations: any[] }> {
    try {
      const sender = await authService.getUserById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        throw new Error('Client not found');
      }

      const invitationRecords = [];
      
      for (const invitation of invitations) {
        // Create invitation token
        const token = this.generateInvitationToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Save invitation to database
        const invitationRecord = await prisma.invitation.create({
          data: {
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            token,
            expiresAt,
            senderId,
            clientId,
            customMessage: invitation.customMessage,
            invitationType: 'BULK',
          },
        });

        invitationRecords.push(invitationRecord);
      }

      // Prepare recipients for bulk email
      const recipients = invitationRecords.map(record => ({
        email: record.email,
        data: {
          firstName: record.firstName || record.email.split('@')[0],
          lastName: record.lastName || '',
          inviterName: `${sender.firstName} ${sender.lastName}`,
          inviterEmail: sender.email,
          clientName: client.name,
          invitationUrl: `${process.env.FRONTEND_URL}/accept-invitation?token=${record.token}`,
          customMessage: record.customMessage,
          expiresAt: record.expiresAt.toLocaleDateString(),
        },
      }));

      // Send bulk invitations
      const result = await emailService.sendBulkEmails({
        template: 'invitation', // TODO: Create invitation template
        recipients,
        subject: `You're invited to join ${client.name}`,
        clientId,
        userId: senderId,
        batchSize: 15,
        delayMs: 750,
      });

      console.log(`📧 Bulk invitations sent: ${result.sent} sent, ${result.failed} failed`);

      return { 
        sent: result.sent, 
        failed: result.failed, 
        invitations: invitationRecords.map(r => ({
          id: r.id,
          email: r.email,
          token: r.token,
          expiresAt: r.expiresAt,
        })),
      };

    } catch (error) {
      console.error('Error sending bulk invitations:', error);
      throw error;
    }
  }

  /**
   * Schedule meeting reminders
   */
  async scheduleMeetingReminders(meetingId: string, reminderMinutes: number[] = [15, 60]): Promise<void> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { 
          id: true, 
          startTime: true, 
          scheduledStartTime: true,
          title: true,
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      const meetingTime = meeting.startTime || meeting.scheduledStartTime;
      if (!meetingTime) {
        throw new Error('Meeting has no start time');
      }

      for (const minutes of reminderMinutes) {
        const reminderTime = new Date(meetingTime.getTime() - minutes * 60000);
        
        // Only schedule if reminder time is in the future
        if (reminderTime > new Date()) {
          // TODO: Implement job queue for scheduled reminders
          // For now, log the intention
          console.log(`📅 Would schedule reminder for meeting ${meeting.title} at ${reminderTime.toISOString()} (${minutes} minutes before)`);
        }
      }

    } catch (error) {
      console.error('Error scheduling meeting reminders:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private formatTimeUntil(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(clientId: string, startDate?: Date, endDate?: Date) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const whereClause: any = { clientId };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter;
    }

    const [totalEmails, sentEmails, failedEmails, templates] = await Promise.all([
      prisma.emailLog.count({ where: whereClause }),
      prisma.emailLog.count({ where: { ...whereClause, status: 'SENT' } }),
      prisma.emailLog.count({ where: { ...whereClause, status: 'FAILED' } }),
      prisma.emailLog.groupBy({
        where: whereClause,
        by: ['template'],
        _count: { template: true },
        orderBy: { _count: { template: 'desc' } },
      }),
    ]);

    return {
      totalEmails,
      sentEmails,
      failedEmails,
      successRate: totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 0,
      templateUsage: templates.map(t => ({
        template: t.template || 'direct',
        count: t._count.template,
      })),
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

export default notificationService;
