import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { prisma } from "./prismaService";

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: "hangoutsMeet";
      };
    };
    conferenceSolution?: {
      name: string;
      iconUri?: string;
    };
    conferenceId?: string;
    entryPoints?: Array<{
      entryPointType: "video" | "phone" | "sip" | "more";
      uri: string;
      label?: string;
      pin?: string;
      accessCode?: string;
    }>;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: "email" | "popup";
      minutes: number;
    }>;
  };
  visibility?: "default" | "public" | "private";
  status?: "confirmed" | "tentative" | "cancelled";
  recurrence?: string[];
}

export interface GoogleCalendarConfig {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Google Calendar Service
 * Handles Google Calendar integration without requiring user consent
 * Uses service account for server-to-server authentication
 */
export class GoogleCalendarService {
  private calendar: any;
  private serviceAccount: JWT | null = null;
  private calendarId: string | null = null;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize Google Calendar service with service account
   */
  private initializeService() {
    try {
      // Load service account credentials from environment
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

      if (!serviceAccountKey) {
        console.warn("📅 Google Calendar: Service account key not configured");
        return;
      }

      let credentials: GoogleCalendarConfig;
      try {
        credentials = JSON.parse(serviceAccountKey);
      } catch (error) {
        console.error("📅 Google Calendar: Invalid service account key format");
        return;
      }

      // Create JWT client for service account authentication
      this.serviceAccount = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      });

      // Initialize Calendar API
      this.calendar = google.calendar({
        version: "v3",
        auth: this.serviceAccount,
      });

      this.calendarId = calendarId;

      console.log("📅 Google Calendar service initialized successfully");
    } catch (error) {
      console.error("📅 Google Calendar initialization error:", error);
    }
  }

  /**
   * Test Google Calendar connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.calendar || !this.calendarId) {
      return false;
    }

    try {
      const response = await this.calendar.calendars.get({
        calendarId: this.calendarId,
      });

      console.log(
        `📅 Google Calendar connection successful: ${response.data.summary}`,
      );
      return true;
    } catch (error) {
      console.error("📅 Google Calendar connection test failed:", error);
      return false;
    }
  }

  /**
   * Create calendar event from meeting
   */
  async createEventFromMeeting(meetingId: string): Promise<string | null> {
    if (!this.calendar || !this.calendarId) {
      console.warn(
        "📅 Google Calendar not configured, skipping event creation",
      );
      return null;
    }

    try {
      // Get meeting details from database
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          creator: true,
          participants: {
            include: {
              user: true,
            },
          },
          room: true,
        },
      });

      if (!meeting || !meeting.startTime) {
        throw new Error("Meeting not found or has no start time");
      }

      // Prepare event data
      const eventData: CalendarEvent = {
        summary: meeting.title,
        description: this.formatMeetingDescription(meeting),
        location: `Video Conference - Room: ${meeting.room?.name || meeting.id}`,
        start: {
          dateTime: meeting.startTime.toISOString(),
          timeZone: meeting.timezone || "UTC",
        },
        end: {
          dateTime:
            meeting.endTime?.toISOString() ||
            new Date(
              meeting.startTime.getTime() + (meeting.duration || 60) * 60000,
            ).toISOString(),
          timeZone: meeting.timezone || "UTC",
        },
        attendees: [
          {
            email: meeting.creator.email,
            displayName: `${meeting.creator.firstName} ${meeting.creator.lastName}`,
            responseStatus: "accepted",
          },
          ...meeting.participants.map((participant) => ({
            email: participant.user.email,
            displayName: `${participant.user.firstName} ${participant.user.lastName}`,
            responseStatus: "needsAction" as const,
          })),
        ],
        conferenceData: {
          createRequest: {
            requestId: `meet-${meetingId}-${Date.now()}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 15 },
            { method: "popup", minutes: 10 },
          ],
        },
        visibility: meeting.isPublic ? "public" : "private",
        status: "confirmed",
      };

      // Add recurrence if meeting is recurring
      if (meeting.recurrenceRule) {
        eventData.recurrence = [meeting.recurrenceRule];
      }

      // Create the event
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: eventData,
        conferenceDataVersion: 1, // Required for Meet integration
        sendUpdates: "all", // Send invitations to all attendees
      });

      const eventId = response.data.id;

      // Update meeting with calendar event ID
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          calendarEventId: eventId,
          meetingUrl:
            response.data.conferenceData?.entryPoints?.[0]?.uri ||
            meeting.meetingUrl,
        },
      });

      console.log(
        `📅 Google Calendar event created: ${eventId} for meeting ${meetingId}`,
      );
      return eventId;
    } catch (error) {
      console.error("📅 Error creating Google Calendar event:", error);
      throw error;
    }
  }

  /**
   * Update existing calendar event
   */
  async updateEventFromMeeting(meetingId: string): Promise<boolean> {
    if (!this.calendar || !this.calendarId) {
      return false;
    }

    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          creator: true,
          participants: {
            include: {
              user: true,
            },
          },
          room: true,
        },
      });

      if (!meeting || !meeting.calendarEventId || !meeting.startTime) {
        return false;
      }

      const eventData: CalendarEvent = {
        summary: meeting.title,
        description: this.formatMeetingDescription(meeting),
        location: `Video Conference - Room: ${meeting.room?.name || meeting.id}`,
        start: {
          dateTime: meeting.startTime.toISOString(),
          timeZone: meeting.timezone || "UTC",
        },
        end: {
          dateTime:
            meeting.endTime?.toISOString() ||
            new Date(
              meeting.startTime.getTime() + (meeting.duration || 60) * 60000,
            ).toISOString(),
          timeZone: meeting.timezone || "UTC",
        },
        attendees: [
          {
            email: meeting.creator.email,
            displayName: `${meeting.creator.firstName} ${meeting.creator.lastName}`,
            responseStatus: "accepted",
          },
          ...meeting.participants.map((participant) => ({
            email: participant.user.email,
            displayName: `${participant.user.firstName} ${participant.user.lastName}`,
            responseStatus: "needsAction" as const,
          })),
        ],
      };

      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: meeting.calendarEventId,
        resource: eventData,
        sendUpdates: "all",
      });

      console.log(
        `📅 Google Calendar event updated: ${meeting.calendarEventId} for meeting ${meetingId}`,
      );
      return true;
    } catch (error) {
      console.error("📅 Error updating Google Calendar event:", error);
      return false;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(meetingId: string): Promise<boolean> {
    if (!this.calendar || !this.calendarId) {
      return false;
    }

    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { calendarEventId: true },
      });

      if (!meeting?.calendarEventId) {
        return false;
      }

      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: meeting.calendarEventId,
        sendUpdates: "all",
      });

      // Clear calendar event ID from meeting
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { calendarEventId: null },
      });

      console.log(
        `📅 Google Calendar event deleted: ${meeting.calendarEventId} for meeting ${meetingId}`,
      );
      return true;
    } catch (error) {
      console.error("📅 Error deleting Google Calendar event:", error);
      return false;
    }
  }

  /**
   * Get calendar events in date range
   */
  async getEvents(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.calendar || !this.calendarId) {
      return [];
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      });

      return response.data.items || [];
    } catch (error) {
      console.error("📅 Error fetching calendar events:", error);
      return [];
    }
  }

  /**
   * Create calendar link for external calendars (Google, Outlook, etc.)
   */
  createCalendarLinks(meeting: any): {
    google: string;
    outlook: string;
    yahoo: string;
    ical: string;
  } | null {
    if (!meeting.startTime) {
      return null;
    }
    const startDate = new Date(meeting.startTime);
    const endDate = meeting.endTime
      ? new Date(meeting.endTime)
      : new Date(startDate.getTime() + (meeting.duration || 60) * 60000);

    // Format dates for calendar URLs
    const formatDateForCalendar = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    };

    const startFormatted = formatDateForCalendar(startDate);
    const endFormatted = formatDateForCalendar(endDate);

    const title = encodeURIComponent(meeting.title);
    const description = encodeURIComponent(
      this.formatMeetingDescription(meeting, false) +
        `\n\nJoin meeting: ${meeting.meetingUrl || meeting.joinUrl || ""}`,
    );
    const location = encodeURIComponent(
      meeting.room?.name || "Video Conference",
    );

    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFormatted}/${endFormatted}&details=${description}&location=${location}`,

      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startFormatted}&enddt=${endFormatted}&body=${description}&location=${location}`,

      yahoo: `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${startFormatted}&et=${endFormatted}&desc=${description}&in_loc=${location}`,

      ical: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Video Conference//Event//EN
BEGIN:VEVENT
UID:${meeting.id}@videoconference.com
DTSTART:${startFormatted}
DTEND:${endFormatted}
SUMMARY:${meeting.title}
DESCRIPTION:${this.formatMeetingDescription(meeting, false)}
LOCATION:${meeting.room?.name || "Video Conference"}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`,
    };
  }

  /**
   * Format meeting description for calendar
   */
  private formatMeetingDescription(
    meeting: any,
    includeHtml: boolean = true,
  ): string {
    const lineBreak = includeHtml ? "<br>" : "\n";
    const bold = (text: string) =>
      includeHtml ? `<strong>${text}</strong>` : text;

    let description = "";

    if (meeting.description) {
      description += `${meeting.description}${lineBreak}${lineBreak}`;
    }

    description += `${bold("Meeting Details:")}${lineBreak}`;
    description += `${bold("Meeting ID:")} ${meeting.id}${lineBreak}`;
    description += `${bold("Organizer:")} ${meeting.creator?.firstName} ${meeting.creator?.lastName} (${meeting.creator?.email})${lineBreak}`;

    if (meeting.meetingUrl || meeting.joinUrl) {
      description += `${bold("Join URL:")} ${meeting.meetingUrl || meeting.joinUrl}${lineBreak}`;
    }

    if (meeting.agenda) {
      description += `${lineBreak}${bold("Agenda:")}${lineBreak}`;
      if (Array.isArray(meeting.agenda)) {
        meeting.agenda.forEach((item: string, index: number) => {
          description += `${index + 1}. ${item}${lineBreak}`;
        });
      } else {
        description += `${meeting.agenda}${lineBreak}`;
      }
    }

    description += `${lineBreak}${bold("Meeting Tips:")}${lineBreak}`;
    description += `• Join a few minutes early to test your audio/video${lineBreak}`;
    description += `• Use a stable internet connection for best quality${lineBreak}`;
    description += `• Mute your microphone when not speaking${lineBreak}`;

    return description;
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.calendar;
  }

  /**
   * Get service status
   */
  getStatus(): {
    available: boolean;
    calendarId: string | null;
    lastTested?: Date;
  } {
    return {
      available: this.isAvailable(),
      calendarId: this.calendarId,
    };
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();

export default googleCalendarService;
