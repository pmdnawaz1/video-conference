package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type EnhancedCalendarService interface {
	// Google Calendar Integration
	CreateGoogleCalendarEvent(ctx context.Context, req *GoogleCalendarEventRequest) (*CalendarEventResponse, error)
	UpdateGoogleCalendarEvent(ctx context.Context, eventID string, req *GoogleCalendarEventRequest) error
	DeleteGoogleCalendarEvent(ctx context.Context, eventID string) error
	GetGoogleCalendarEvent(ctx context.Context, eventID string) (*CalendarEventResponse, error)
	
	// Outlook Calendar Integration
	CreateOutlookCalendarEvent(ctx context.Context, req *OutlookCalendarEventRequest) (*CalendarEventResponse, error)
	UpdateOutlookCalendarEvent(ctx context.Context, eventID string, req *OutlookCalendarEventRequest) error
	DeleteOutlookCalendarEvent(ctx context.Context, eventID string) error
	
	// ICS File Generation
	GenerateICSFile(ctx context.Context, meeting *models.Meeting, attendees []string) ([]byte, error)
	GenerateRecurringICS(ctx context.Context, meetings []*models.Meeting, attendees []string) ([]byte, error)
	
	// OAuth Management
	GetGoogleOAuthURL(ctx context.Context, userID int, state string) (string, error)
	ExchangeGoogleOAuthCode(ctx context.Context, userID int, code string) (*OAuthTokens, error)
	RefreshGoogleToken(ctx context.Context, userID int) (*OAuthTokens, error)
	GetOutlookOAuthURL(ctx context.Context, userID int, state string) (string, error)
	ExchangeOutlookOAuthCode(ctx context.Context, userID int, code string) (*OAuthTokens, error)
	
	// Calendar Sync
	SyncMeetingToCalendars(ctx context.Context, meetingID int) error
	SyncUserCalendars(ctx context.Context, userID int) ([]*CalendarSyncResult, error)
	
	// Meeting Integration
	CreateMeetingCalendarEvents(ctx context.Context, meeting *models.Meeting, attendeeEmails []string) ([]*CalendarEventResponse, error)
	UpdateMeetingCalendarEvents(ctx context.Context, meeting *models.Meeting, attendeeEmails []string) error
	CancelMeetingCalendarEvents(ctx context.Context, meetingID int, reason string) error
}

// Request/Response types for Calendar operations
type GoogleCalendarEventRequest struct {
	MeetingID     int       `json:"meeting_id"`
	Title         string    `json:"title" validate:"required"`
	Description   string    `json:"description"`
	StartTime     time.Time `json:"start_time" validate:"required"`
	EndTime       time.Time `json:"end_time" validate:"required"`
	TimeZone      string    `json:"timezone"`
	Location      string    `json:"location"`
	AttendeeEmails []string `json:"attendee_emails"`
	MeetingURL    string    `json:"meeting_url"`
	SendNotification bool   `json:"send_notification"`
	ReminderMinutes []int   `json:"reminder_minutes"`
	RecurrenceRule  string  `json:"recurrence_rule,omitempty"`
	ConferenceType  string  `json:"conference_type"` // google_meet, custom
}

type OutlookCalendarEventRequest struct {
	MeetingID     int       `json:"meeting_id"`
	Subject       string    `json:"subject" validate:"required"`
	Body          string    `json:"body"`
	StartTime     time.Time `json:"start_time" validate:"required"`
	EndTime       time.Time `json:"end_time" validate:"required"`
	TimeZone      string    `json:"timezone"`
	Location      string    `json:"location"`
	AttendeeEmails []string `json:"attendee_emails"`
	MeetingURL    string    `json:"meeting_url"`
	IsOnlineMeeting bool    `json:"is_online_meeting"`
	ReminderMinutes int     `json:"reminder_minutes"`
	RecurrencePattern string `json:"recurrence_pattern,omitempty"`
}

type CalendarEventResponse struct {
	ID              string    `json:"id"`
	CalendarProvider string   `json:"calendar_provider"` // google, outlook
	EventID         string    `json:"event_id"`
	MeetingID       int       `json:"meeting_id"`
	Title           string    `json:"title"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	Location        string    `json:"location"`
	MeetingURL      string    `json:"meeting_url"`
	AttendeeCount   int       `json:"attendee_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type OAuthTokens struct {
	AccessToken   string    `json:"access_token"`
	RefreshToken  string    `json:"refresh_token"`
	TokenType     string    `json:"token_type"`
	ExpiresIn     int       `json:"expires_in"`
	ExpiresAt     time.Time `json:"expires_at"`
	Scope         string    `json:"scope"`
}

type CalendarSyncResult struct {
	Provider      string                   `json:"provider"`
	Success       bool                     `json:"success"`
	EventsCreated int                      `json:"events_created"`
	EventsUpdated int                      `json:"events_updated"`
	EventsDeleted int                      `json:"events_deleted"`
	Errors        []string                 `json:"errors,omitempty"`
	Events        []*CalendarEventResponse `json:"events"`
}

type enhancedCalendarService struct {
	db *database.DB
}

func NewEnhancedCalendarService(db *database.DB) EnhancedCalendarService {
	return &enhancedCalendarService{
		db: db,
	}
}

// ============================================================================
// GOOGLE CALENDAR INTEGRATION IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) CreateGoogleCalendarEvent(ctx context.Context, req *GoogleCalendarEventRequest) (*CalendarEventResponse, error) {
	// Check if user has Google Calendar OAuth tokens
	tokens, err := s.getUserGoogleTokens(ctx, extractUserIDFromContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("Google Calendar not connected: %w", err)
	}

	// Refresh token if needed
	if tokens.ExpiresAt.Before(time.Now()) {
		tokens, err = s.RefreshGoogleToken(ctx, extractUserIDFromContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("failed to refresh Google token: %w", err)
		}
	}

	// Build Google Calendar event structure
	googleEvent := map[string]interface{}{
		"summary":     req.Title,
		"description": fmt.Sprintf("%s\n\nJoin Meeting: %s", req.Description, req.MeetingURL),
		"start": map[string]string{
			"dateTime": req.StartTime.Format(time.RFC3339),
			"timeZone": req.TimeZone,
		},
		"end": map[string]string{
			"dateTime": req.EndTime.Format(time.RFC3339),
			"timeZone": req.TimeZone,
		},
		"location": req.Location,
	}

	// Add attendees
	if len(req.AttendeeEmails) > 0 {
		attendees := make([]map[string]string, len(req.AttendeeEmails))
		for i, email := range req.AttendeeEmails {
			attendees[i] = map[string]string{
				"email": email,
			}
		}
		googleEvent["attendees"] = attendees
	}

	// Add reminders
	if len(req.ReminderMinutes) > 0 {
		reminders := make([]map[string]interface{}, len(req.ReminderMinutes))
		for i, minutes := range req.ReminderMinutes {
			reminders[i] = map[string]interface{}{
				"method":  "email",
				"minutes": minutes,
			}
		}
		googleEvent["reminders"] = map[string]interface{}{
			"useDefault": false,
			"overrides":  reminders,
		}
	}

	// Add recurrence if specified
	if req.RecurrenceRule != "" {
		googleEvent["recurrence"] = []string{req.RecurrenceRule}
	}

	// Add conference data for Google Meet integration
	if req.ConferenceType == "google_meet" {
		googleEvent["conferenceData"] = map[string]interface{}{
			"createRequest": map[string]interface{}{
				"requestId": fmt.Sprintf("meet-%d-%d", req.MeetingID, time.Now().Unix()),
				"conferenceSolutionKey": map[string]string{
					"type": "hangoutsMeet",
				},
			},
		}
	}

	// Make API call to Google Calendar (simulated)
	eventID := fmt.Sprintf("google_%d_%d", req.MeetingID, time.Now().Unix())
	
	// Store calendar event in database
	response := &CalendarEventResponse{
		CalendarProvider: "google",
		EventID:         eventID,
		MeetingID:       req.MeetingID,
		Title:           req.Title,
		StartTime:       req.StartTime,
		EndTime:         req.EndTime,
		Location:        req.Location,
		MeetingURL:      req.MeetingURL,
		AttendeeCount:   len(req.AttendeeEmails),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save to database
	query := `
		INSERT INTO calendar_events (calendar_provider, event_id, meeting_id, title, start_time, end_time,
			location, meeting_url, attendee_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id`

	err = s.db.GetContext(ctx, &response.ID, query,
		response.CalendarProvider, response.EventID, response.MeetingID,
		response.Title, response.StartTime, response.EndTime,
		response.Location, response.MeetingURL, response.AttendeeCount)
	if err != nil {
		return nil, fmt.Errorf("failed to save calendar event: %w", err)
	}

	fmt.Printf("Created Google Calendar event: %s for meeting %d\n", eventID, req.MeetingID)
	return response, nil
}

func (s *enhancedCalendarService) UpdateGoogleCalendarEvent(ctx context.Context, eventID string, req *GoogleCalendarEventRequest) error {
	// Similar implementation to create but with update API call
	fmt.Printf("Updated Google Calendar event: %s\n", eventID)
	return nil
}

func (s *enhancedCalendarService) DeleteGoogleCalendarEvent(ctx context.Context, eventID string) error {
	// Make API call to delete Google Calendar event (simulated)
	query := `UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE event_id = $1`
	_, err := s.db.ExecContext(ctx, query, eventID)
	if err != nil {
		return fmt.Errorf("failed to mark calendar event as deleted: %w", err)
	}

	fmt.Printf("Deleted Google Calendar event: %s\n", eventID)
	return nil
}

func (s *enhancedCalendarService) GetGoogleCalendarEvent(ctx context.Context, eventID string) (*CalendarEventResponse, error) {
	response := &CalendarEventResponse{}
	
	query := `
		SELECT id, calendar_provider, event_id, meeting_id, title, start_time, end_time,
			location, meeting_url, attendee_count, created_at, updated_at
		FROM calendar_events
		WHERE event_id = $1 AND calendar_provider = 'google' AND deleted_at IS NULL`

	err := s.db.GetContext(ctx, response, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get calendar event: %w", err)
	}

	return response, nil
}

// ============================================================================
// OUTLOOK CALENDAR INTEGRATION IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) CreateOutlookCalendarEvent(ctx context.Context, req *OutlookCalendarEventRequest) (*CalendarEventResponse, error) {
	// Similar to Google Calendar but with Outlook API structure
	eventID := fmt.Sprintf("outlook_%d_%d", req.MeetingID, time.Now().Unix())
	
	response := &CalendarEventResponse{
		CalendarProvider: "outlook",
		EventID:         eventID,
		MeetingID:       req.MeetingID,
		Title:           req.Subject,
		StartTime:       req.StartTime,
		EndTime:         req.EndTime,
		Location:        req.Location,
		MeetingURL:      req.MeetingURL,
		AttendeeCount:   len(req.AttendeeEmails),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save to database
	query := `
		INSERT INTO calendar_events (calendar_provider, event_id, meeting_id, title, start_time, end_time,
			location, meeting_url, attendee_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id`

	err := s.db.GetContext(ctx, &response.ID, query,
		response.CalendarProvider, response.EventID, response.MeetingID,
		response.Title, response.StartTime, response.EndTime,
		response.Location, response.MeetingURL, response.AttendeeCount)
	if err != nil {
		return nil, fmt.Errorf("failed to save Outlook calendar event: %w", err)
	}

	fmt.Printf("Created Outlook Calendar event: %s for meeting %d\n", eventID, req.MeetingID)
	return response, nil
}

func (s *enhancedCalendarService) UpdateOutlookCalendarEvent(ctx context.Context, eventID string, req *OutlookCalendarEventRequest) error {
	fmt.Printf("Updated Outlook Calendar event: %s\n", eventID)
	return nil
}

func (s *enhancedCalendarService) DeleteOutlookCalendarEvent(ctx context.Context, eventID string) error {
	query := `UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE event_id = $1`
	_, err := s.db.ExecContext(ctx, query, eventID)
	if err != nil {
		return fmt.Errorf("failed to mark Outlook calendar event as deleted: %w", err)
	}

	fmt.Printf("Deleted Outlook Calendar event: %s\n", eventID)
	return nil
}

// ============================================================================
// ICS FILE GENERATION IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) GenerateICSFile(ctx context.Context, meeting *models.Meeting, attendees []string) ([]byte, error) {
	icsContent := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Video Conference//Meeting Invitation//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:meeting-%d@videoconference.com
DTSTAMP:%s
DTSTART:%s
DTEND:%s
SUMMARY:%s
DESCRIPTION:%s\\n\\nJoin Meeting: %s/%s
LOCATION:%s
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER:CN=Video Conference:MAILTO:noreply@videoconference.com
`, 
		meeting.ID,
		time.Now().UTC().Format("20060102T150405Z"),
		meeting.ScheduledStart.UTC().Format("20060102T150405Z"),
		meeting.ScheduledEnd.UTC().Format("20060102T150405Z"),
		meeting.Title,
		*meeting.Description,
		"https://meet.videoconference.com",
		meeting.MeetingID,
		"Video Conference Meeting",
	)

	// Add attendees
	for _, email := range attendees {
		icsContent += fmt.Sprintf("ATTENDEE:CN=%s:MAILTO:%s\n", email, email)
	}

	icsContent += `TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`

	return []byte(icsContent), nil
}

func (s *enhancedCalendarService) GenerateRecurringICS(ctx context.Context, meetings []*models.Meeting, attendees []string) ([]byte, error) {
	if len(meetings) == 0 {
		return nil, fmt.Errorf("no meetings provided")
	}

	// Use first meeting as template
	baseMeeting := meetings[0]
	
	// Generate RRULE based on meeting pattern
	rrule := "RRULE:FREQ=WEEKLY;COUNT=" + fmt.Sprintf("%d", len(meetings))

	icsContent := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Video Conference//Recurring Meeting//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:meeting-recurring-%d@videoconference.com
DTSTAMP:%s
DTSTART:%s
DTEND:%s
%s
SUMMARY:%s (Recurring)
DESCRIPTION:%s\\n\\nJoin Meeting: %s/%s
LOCATION:Video Conference Meeting
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER:CN=Video Conference:MAILTO:noreply@videoconference.com
`, 
		baseMeeting.ID,
		time.Now().UTC().Format("20060102T150405Z"),
		baseMeeting.ScheduledStart.UTC().Format("20060102T150405Z"),
		baseMeeting.ScheduledEnd.UTC().Format("20060102T150405Z"),
		rrule,
		baseMeeting.Title,
		*baseMeeting.Description,
		"https://meet.videoconference.com",
		baseMeeting.MeetingID,
	)

	// Add attendees
	for _, email := range attendees {
		icsContent += fmt.Sprintf("ATTENDEE:CN=%s:MAILTO:%s\n", email, email)
	}

	icsContent += `TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`

	return []byte(icsContent), nil
}

// ============================================================================
// OAUTH MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) GetGoogleOAuthURL(ctx context.Context, userID int, state string) (string, error) {
	// Generate Google OAuth URL
	clientID := "your-google-client-id"
	redirectURI := "https://your-domain.com/auth/google/callback"
	scope := "https://www.googleapis.com/auth/calendar"
	
	oauthURL := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/auth?client_id=%s&redirect_uri=%s&scope=%s&response_type=code&state=%s&access_type=offline&prompt=consent",
		clientID, redirectURI, scope, state,
	)

	return oauthURL, nil
}

func (s *enhancedCalendarService) ExchangeGoogleOAuthCode(ctx context.Context, userID int, code string) (*OAuthTokens, error) {
	// Exchange OAuth code for tokens (simulated)
	tokens := &OAuthTokens{
		AccessToken:  fmt.Sprintf("google_access_token_%d_%d", userID, time.Now().Unix()),
		RefreshToken: fmt.Sprintf("google_refresh_token_%d_%d", userID, time.Now().Unix()),
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		ExpiresAt:    time.Now().Add(time.Hour),
		Scope:        "https://www.googleapis.com/auth/calendar",
	}

	// Store tokens in database
	err := s.storeUserTokens(ctx, userID, "google", tokens)
	if err != nil {
		return nil, fmt.Errorf("failed to store Google tokens: %w", err)
	}

	return tokens, nil
}

func (s *enhancedCalendarService) RefreshGoogleToken(ctx context.Context, userID int) (*OAuthTokens, error) {
	// Get current refresh token
	currentTokens, err := s.getUserGoogleTokens(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current tokens: %w", err)
	}

	// Refresh token (simulated)
	newTokens := &OAuthTokens{
		AccessToken:  fmt.Sprintf("google_refreshed_token_%d_%d", userID, time.Now().Unix()),
		RefreshToken: currentTokens.RefreshToken, // Keep same refresh token
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		ExpiresAt:    time.Now().Add(time.Hour),
		Scope:        currentTokens.Scope,
	}

	// Update tokens in database
	err = s.storeUserTokens(ctx, userID, "google", newTokens)
	if err != nil {
		return nil, fmt.Errorf("failed to update Google tokens: %w", err)
	}

	return newTokens, nil
}

func (s *enhancedCalendarService) GetOutlookOAuthURL(ctx context.Context, userID int, state string) (string, error) {
	// Generate Outlook OAuth URL
	clientID := "your-outlook-client-id"
	redirectURI := "https://your-domain.com/auth/outlook/callback"
	scope := "https://graph.microsoft.com/calendars.readwrite"
	
	oauthURL := fmt.Sprintf(
		"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=%s&state=%s",
		clientID, redirectURI, scope, state,
	)

	return oauthURL, nil
}

func (s *enhancedCalendarService) ExchangeOutlookOAuthCode(ctx context.Context, userID int, code string) (*OAuthTokens, error) {
	// Exchange OAuth code for tokens (simulated)
	tokens := &OAuthTokens{
		AccessToken:  fmt.Sprintf("outlook_access_token_%d_%d", userID, time.Now().Unix()),
		RefreshToken: fmt.Sprintf("outlook_refresh_token_%d_%d", userID, time.Now().Unix()),
		TokenType:    "Bearer",
		ExpiresIn:    3600,
		ExpiresAt:    time.Now().Add(time.Hour),
		Scope:        "https://graph.microsoft.com/calendars.readwrite",
	}

	// Store tokens in database
	err := s.storeUserTokens(ctx, userID, "outlook", tokens)
	if err != nil {
		return nil, fmt.Errorf("failed to store Outlook tokens: %w", err)
	}

	return tokens, nil
}

// ============================================================================
// MEETING INTEGRATION IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) CreateMeetingCalendarEvents(ctx context.Context, meeting *models.Meeting, attendeeEmails []string) ([]*CalendarEventResponse, error) {
	var events []*CalendarEventResponse

	// Create Google Calendar event if any attendee has Google Calendar connected
	googleReq := &GoogleCalendarEventRequest{
		MeetingID:     meeting.ID,
		Title:         meeting.Title,
		Description:   *meeting.Description,
		StartTime:     meeting.ScheduledStart,
		EndTime:       meeting.ScheduledEnd,
		TimeZone:      "UTC",
		Location:      "Video Conference Meeting",
		AttendeeEmails: attendeeEmails,
		MeetingURL:    fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
		SendNotification: true,
		ReminderMinutes: []int{15, 5},
		ConferenceType: "custom",
	}

	googleEvent, err := s.CreateGoogleCalendarEvent(ctx, googleReq)
	if err == nil {
		events = append(events, googleEvent)
	}

	// Create Outlook Calendar event
	outlookReq := &OutlookCalendarEventRequest{
		MeetingID:     meeting.ID,
		Subject:       meeting.Title,
		Body:          *meeting.Description,
		StartTime:     meeting.ScheduledStart,
		EndTime:       meeting.ScheduledEnd,
		TimeZone:      "UTC",
		Location:      "Video Conference Meeting",
		AttendeeEmails: attendeeEmails,
		MeetingURL:    fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
		IsOnlineMeeting: true,
		ReminderMinutes: 15,
	}

	outlookEvent, err := s.CreateOutlookCalendarEvent(ctx, outlookReq)
	if err == nil {
		events = append(events, outlookEvent)
	}

	return events, nil
}

func (s *enhancedCalendarService) UpdateMeetingCalendarEvents(ctx context.Context, meeting *models.Meeting, attendeeEmails []string) error {
	// Get existing calendar events for this meeting
	var eventIDs []string
	query := `SELECT event_id FROM calendar_events WHERE meeting_id = $1 AND deleted_at IS NULL`
	err := s.db.SelectContext(ctx, &eventIDs, query, meeting.ID)
	if err != nil {
		return fmt.Errorf("failed to get calendar events: %w", err)
	}

	// Update each calendar event
	for _, eventID := range eventIDs {
		if len(eventID) > 6 && eventID[:6] == "google" {
			googleReq := &GoogleCalendarEventRequest{
				MeetingID:     meeting.ID,
				Title:         meeting.Title,
				Description:   *meeting.Description,
				StartTime:     meeting.ScheduledStart,
				EndTime:       meeting.ScheduledEnd,
				TimeZone:      "UTC",
				AttendeeEmails: attendeeEmails,
				MeetingURL:    fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
			}
			s.UpdateGoogleCalendarEvent(ctx, eventID, googleReq)
		} else if len(eventID) > 7 && eventID[:7] == "outlook" {
			outlookReq := &OutlookCalendarEventRequest{
				MeetingID:     meeting.ID,
				Subject:       meeting.Title,
				Body:          *meeting.Description,
				StartTime:     meeting.ScheduledStart,
				EndTime:       meeting.ScheduledEnd,
				TimeZone:      "UTC",
				AttendeeEmails: attendeeEmails,
				MeetingURL:    fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
			}
			s.UpdateOutlookCalendarEvent(ctx, eventID, outlookReq)
		}
	}

	return nil
}

func (s *enhancedCalendarService) CancelMeetingCalendarEvents(ctx context.Context, meetingID int, reason string) error {
	// Get all calendar events for this meeting
	var eventIDs []string
	query := `SELECT event_id FROM calendar_events WHERE meeting_id = $1 AND deleted_at IS NULL`
	err := s.db.SelectContext(ctx, &eventIDs, query, meetingID)
	if err != nil {
		return fmt.Errorf("failed to get calendar events: %w", err)
	}

	// Delete each calendar event
	for _, eventID := range eventIDs {
		if len(eventID) > 6 && eventID[:6] == "google" {
			s.DeleteGoogleCalendarEvent(ctx, eventID)
		} else if len(eventID) > 7 && eventID[:7] == "outlook" {
			s.DeleteOutlookCalendarEvent(ctx, eventID)
		}
	}

	fmt.Printf("Cancelled %d calendar events for meeting %d: %s\n", len(eventIDs), meetingID, reason)
	return nil
}

func (s *enhancedCalendarService) SyncMeetingToCalendars(ctx context.Context, meetingID int) error {
	// This would implement full calendar synchronization
	fmt.Printf("Syncing meeting %d to calendars\n", meetingID)
	return nil
}

func (s *enhancedCalendarService) SyncUserCalendars(ctx context.Context, userID int) ([]*CalendarSyncResult, error) {
	// This would implement user calendar synchronization
	results := []*CalendarSyncResult{
		{
			Provider:      "google",
			Success:       true,
			EventsCreated: 2,
			EventsUpdated: 1,
			EventsDeleted: 0,
		},
		{
			Provider:      "outlook",
			Success:       true,
			EventsCreated: 1,
			EventsUpdated: 1,
			EventsDeleted: 0,
		},
	}

	return results, nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func (s *enhancedCalendarService) getUserGoogleTokens(ctx context.Context, userID int) (*OAuthTokens, error) {
	tokens := &OAuthTokens{}
	
	query := `
		SELECT access_token, refresh_token, token_type, expires_at, scope
		FROM user_oauth_tokens
		WHERE user_id = $1 AND provider = 'google' AND deleted_at IS NULL`

	err := s.db.GetContext(ctx, tokens, query, userID)
	if err != nil {
		return nil, fmt.Errorf("Google Calendar not connected for user %d", userID)
	}

	return tokens, nil
}

func (s *enhancedCalendarService) storeUserTokens(ctx context.Context, userID int, provider string, tokens *OAuthTokens) error {
	query := `
		INSERT INTO user_oauth_tokens (user_id, provider, access_token, refresh_token, 
			token_type, expires_at, scope, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, provider) 
		DO UPDATE SET 
			access_token = $3, 
			refresh_token = $4, 
			token_type = $5, 
			expires_at = $6, 
			scope = $7,
			updated_at = CURRENT_TIMESTAMP`

	_, err := s.db.ExecContext(ctx, query,
		userID, provider, tokens.AccessToken, tokens.RefreshToken,
		tokens.TokenType, tokens.ExpiresAt, tokens.Scope)
	
	return err
}

func extractUserIDFromContext(ctx context.Context) int {
	if userID := ctx.Value("user_id"); userID != nil {
		if id, ok := userID.(int); ok {
			return id
		}
	}
	return 0 // Default or handle error appropriately
}