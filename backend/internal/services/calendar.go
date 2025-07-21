package services

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"video-conference-backend/internal/models"
)

// CalendarService handles calendar integration
type CalendarService struct {
	// For now, we'll use a simple webhook-based approach
	// In production, you'd use Google Calendar API with OAuth
}

// NewCalendarService creates a new calendar service
func NewCalendarService() *CalendarService {
	return &CalendarService{}
}

// GoogleCalendarEvent represents a Google Calendar event
type GoogleCalendarEvent struct {
	Summary     string                  `json:"summary"`
	Description string                  `json:"description"`
	Start       GoogleCalendarDateTime  `json:"start"`
	End         GoogleCalendarDateTime  `json:"end"`
	Location    string                  `json:"location,omitempty"`
	Attendees   []GoogleCalendarAttendee `json:"attendees,omitempty"`
	ConferenceData GoogleConferenceData `json:"conferenceData,omitempty"`
}

// GoogleCalendarDateTime represents date/time for Google Calendar
type GoogleCalendarDateTime struct {
	DateTime string `json:"dateTime"`
	TimeZone string `json:"timeZone"`
}

// GoogleCalendarAttendee represents an attendee
type GoogleCalendarAttendee struct {
	Email string `json:"email"`
}

// GoogleConferenceData represents conference information
type GoogleConferenceData struct {
	CreateRequest GoogleConferenceCreateRequest `json:"createRequest"`
}

// GoogleConferenceCreateRequest represents a conference creation request
type GoogleConferenceCreateRequest struct {
	RequestId             string `json:"requestId"`
	ConferenceSolutionKey struct {
		Type string `json:"type"`
	} `json:"conferenceSolutionKey"`
}

// CreateCalendarEvent creates a calendar event from a meeting
func (s *CalendarService) CreateCalendarEvent(meeting *models.Meeting, inviterEmail string, attendeeEmails []string, meetingLink string) (*GoogleCalendarEvent, error) {
	// Create Google Calendar event structure
	event := &GoogleCalendarEvent{
		Summary:     meeting.Title,
		Description: fmt.Sprintf("%s\n\nJoin meeting: %s", meeting.Description, meetingLink),
		Start: GoogleCalendarDateTime{
			DateTime: meeting.ScheduledStart.Format(time.RFC3339),
			TimeZone: "UTC", // You can make this configurable
		},
		End: GoogleCalendarDateTime{
			DateTime: meeting.ScheduledEnd.Format(time.RFC3339),
			TimeZone: "UTC",
		},
		Location: "Video Conference Platform",
	}

	// Add attendees
	event.Attendees = []GoogleCalendarAttendee{
		{Email: inviterEmail}, // Add the organizer
	}
	for _, email := range attendeeEmails {
		event.Attendees = append(event.Attendees, GoogleCalendarAttendee{Email: email})
	}

	// Add conference data for Google Meet integration (optional)
	event.ConferenceData = GoogleConferenceData{
		CreateRequest: GoogleConferenceCreateRequest{
			RequestId: fmt.Sprintf("meeting-%s", meeting.MeetingID),
			ConferenceSolutionKey: struct {
				Type string `json:"type"`
			}{
				Type: "hangoutsMeet",
			},
		},
	}

	log.Printf("📅 Created calendar event for meeting: %s", meeting.Title)
	return event, nil
}

// GenerateICSContent generates ICS (iCalendar) content for email attachments
func (s *CalendarService) GenerateICSContent(meeting *models.Meeting, meetingLink string) string {
	// Generate a simple ICS file content
	icsContent := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Video Conference Platform//EN
BEGIN:VEVENT
UID:meeting-%s@videoconference.platform
DTSTART:%s
DTEND:%s
SUMMARY:%s
DESCRIPTION:%s\n\nJoin meeting: %s
LOCATION:Video Conference Platform
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Meeting reminder: %s
END:VALARM
END:VEVENT
END:VCALENDAR`,
		meeting.MeetingID,
		meeting.ScheduledStart.Format("20060102T150405Z"),
		meeting.ScheduledEnd.Format("20060102T150405Z"),
		meeting.Title,
		meeting.Description,
		meetingLink,
		meeting.Title,
	)

	return icsContent
}

// GoogleCalendarWebhook represents a webhook payload for Google Calendar
type GoogleCalendarWebhook struct {
	Event       GoogleCalendarEvent `json:"event"`
	AccessToken string              `json:"access_token"`
	CalendarID  string              `json:"calendar_id"`
}

// SendToGoogleCalendar sends event to Google Calendar via webhook (for demo purposes)
// In production, use Google Calendar API with proper OAuth
func (s *CalendarService) SendToGoogleCalendar(event *GoogleCalendarEvent, accessToken, calendarID string) error {
	// This is a simplified approach for demonstration
	// In production, you would use the Google Calendar API
	
	webhook := GoogleCalendarWebhook{
		Event:       *event,
		AccessToken: accessToken,
		CalendarID:  calendarID,
	}

	jsonData, err := json.Marshal(webhook)
	if err != nil {
		return fmt.Errorf("failed to marshal calendar event: %w", err)
	}

	// For now, just log the event data
	// In production, you'd send this to Google Calendar API
	log.Printf("📅 Google Calendar event data (would be sent to API):\n%s", string(jsonData))
	
	return nil
}

// OutlookCalendarEvent represents a Microsoft Outlook calendar event
type OutlookCalendarEvent struct {
	Subject      string                     `json:"subject"`
	Body         OutlookEventBody          `json:"body"`
	Start        OutlookDateTime           `json:"start"`
	End          OutlookDateTime           `json:"end"`
	Location     OutlookLocation           `json:"location"`
	Attendees    []OutlookAttendee         `json:"attendees"`
	OnlineMeeting OutlookOnlineMeeting     `json:"onlineMeeting,omitempty"`
}

type OutlookEventBody struct {
	ContentType string `json:"contentType"`
	Content     string `json:"content"`
}

type OutlookDateTime struct {
	DateTime string `json:"dateTime"`
	TimeZone string `json:"timeZone"`
}

type OutlookLocation struct {
	DisplayName string `json:"displayName"`
}

type OutlookAttendee struct {
	EmailAddress OutlookEmailAddress `json:"emailAddress"`
	Type         string              `json:"type"`
}

type OutlookEmailAddress struct {
	Address string `json:"address"`
	Name    string `json:"name,omitempty"`
}

type OutlookOnlineMeeting struct {
	JoinUrl string `json:"joinUrl"`
}

// CreateOutlookEvent creates an Outlook calendar event
func (s *CalendarService) CreateOutlookEvent(meeting *models.Meeting, attendeeEmails []string, meetingLink string) (*OutlookCalendarEvent, error) {
	event := &OutlookCalendarEvent{
		Subject: meeting.Title,
		Body: OutlookEventBody{
			ContentType: "HTML",
			Content:     fmt.Sprintf("<p>%s</p><p><a href=\"%s\">Join Meeting</a></p>", meeting.Description, meetingLink),
		},
		Start: OutlookDateTime{
			DateTime: meeting.ScheduledStart.Format(time.RFC3339),
			TimeZone: "UTC",
		},
		End: OutlookDateTime{
			DateTime: meeting.ScheduledEnd.Format(time.RFC3339),
			TimeZone: "UTC",
		},
		Location: OutlookLocation{
			DisplayName: "Video Conference Platform",
		},
		OnlineMeeting: OutlookOnlineMeeting{
			JoinUrl: meetingLink,
		},
	}

	// Add attendees
	for _, email := range attendeeEmails {
		event.Attendees = append(event.Attendees, OutlookAttendee{
			EmailAddress: OutlookEmailAddress{
				Address: email,
			},
			Type: "required",
		})
	}

	log.Printf("📅 Created Outlook event for meeting: %s", meeting.Title)
	return event, nil
}

// CalendarIntegrationResponse represents the response from calendar operations
type CalendarIntegrationResponse struct {
	GoogleEvent  *GoogleCalendarEvent  `json:"google_event,omitempty"`
	OutlookEvent *OutlookCalendarEvent `json:"outlook_event,omitempty"`
	ICSContent   string                `json:"ics_content,omitempty"`
	Success      bool                  `json:"success"`
	Message      string                `json:"message"`
}

// CreateCalendarIntegration creates calendar events for multiple platforms
func (s *CalendarService) CreateCalendarIntegration(meeting *models.Meeting, inviterEmail string, attendeeEmails []string, meetingLink string) *CalendarIntegrationResponse {
	response := &CalendarIntegrationResponse{
		Success: true,
		Message: "Calendar events created successfully",
	}

	// Create Google Calendar event
	googleEvent, err := s.CreateCalendarEvent(meeting, inviterEmail, attendeeEmails, meetingLink)
	if err != nil {
		log.Printf("Failed to create Google Calendar event: %v", err)
	} else {
		response.GoogleEvent = googleEvent
	}

	// Create Outlook event
	outlookEvent, err := s.CreateOutlookEvent(meeting, attendeeEmails, meetingLink)
	if err != nil {
		log.Printf("Failed to create Outlook event: %v", err)
	} else {
		response.OutlookEvent = outlookEvent
	}

	// Generate ICS content
	response.ICSContent = s.GenerateICSContent(meeting, meetingLink)

	return response
}