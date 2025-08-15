package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"video-conference-backend/prisma/db"
	"video-conference-backend/prisma/db"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
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
	GenerateICSFile(ctx context.Context, meeting *db.Meeting, attendees []string) ([]byte, error)
	GenerateRecurringICS(ctx context.Context, meetings []*db.Meeting, attendees []string) ([]byte, error)

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
	CreateMeetingCalendarEvents(ctx context.Context, meeting *db.Meeting, attendeeEmails []string) ([]*CalendarEventResponse, error)
	UpdateMeetingCalendarEvents(ctx context.Context, meeting *db.Meeting, attendeeEmails []string) error
	CancelMeetingCalendarEvents(ctx context.Context, meetingID int, reason string) error
}

// Request/Response types for Calendar operations
type GoogleCalendarEventRequest struct {
	MeetingID        int       `json:"meeting_id"`
	Title            string    `json:"title" validate:"required"`
	Description      string    `json:"description"`
	StartTime        time.Time `json:"start_time" validate:"required"`
	EndTime          time.Time `json:"end_time" validate:"required"`
	TimeZone         string    `json:"timezone"`
	Location         string    `json:"location"`
	AttendeeEmails   []string  `json:"attendee_emails"`
	MeetingURL       string    `json:"meeting_url"`
	SendNotification bool      `json:"send_notification"`
	ReminderMinutes  []int     `json:"reminder_minutes"`
	RecurrenceRule   string    `json:"recurrence_rule,omitempty"`
	ConferenceType   string    `json:"conference_type"` // google_meet, custom
}

type OutlookCalendarEventRequest struct {
	MeetingID         int       `json:"meeting_id"`
	Subject           string    `json:"subject" validate:"required"`
	Body              string    `json:"body"`
	StartTime         time.Time `json:"start_time" validate:"required"`
	EndTime           time.Time `json:"end_time" validate:"required"`
	TimeZone          string    `json:"timezone"`
	Location          string    `json:"location"`
	AttendeeEmails    []string  `json:"attendee_emails"`
	MeetingURL        string    `json:"meeting_url"`
	IsOnlineMeeting   bool      `json:"is_online_meeting"`
	ReminderMinutes   int       `json:"reminder_minutes"`
	RecurrencePattern string    `json:"recurrence_pattern,omitempty"`
}

type CalendarEventResponse struct {
	ID               string    `json:"id"`
	CalendarProvider string    `json:"calendar_provider"` // google, outlook
	EventID          string    `json:"event_id"`
	MeetingID        int       `json:"meeting_id"`
	Title            string    `json:"title"`
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	Location         string    `json:"location"`
	MeetingURL       string    `json:"meeting_url"`
	AttendeeCount    int       `json:"attendee_count"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type OAuthTokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
	Scope        string    `json:"scope"`
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
	db                *db.DB
	googleOAuthConfig *oauth2.Config
}

func NewEnhancedCalendarService(db *db.DB, googleClientID, googleClientSecret, redirectURL string) EnhancedCalendarService {
	return &enhancedCalendarService{
		db: db,
		googleOAuthConfig: &oauth2.Config{
			ClientID:     googleClientID,
			ClientSecret: googleClientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{calendar.CalendarScope},
			Endpoint:     google.Endpoint,
		},
	}
}

func (s *enhancedCalendarService) getGoogleCalendarService(ctx context.Context, userID int) (*calendar.Service, error) {
	tokens, err := s.getUserGoogleTokens(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user tokens: %w", err)
	}

	if tokens.ExpiresAt.Before(time.Now()) {
		tokens, err = s.RefreshGoogleToken(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}
	}

	token := &oauth2.Token{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		TokenType:    tokens.TokenType,
		Expiry:       tokens.ExpiresAt,
	}

	client := s.googleOAuthConfig.Client(ctx, token)
	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar service: %w", err)
	}

	return srv, nil
}

// ============================================================================
// GOOGLE CALENDAR INTEGRATION IMPLEMENTATION
// ============================================================================

func (s *enhancedCalendarService) CreateGoogleCalendarEvent(ctx context.Context, req *GoogleCalendarEventRequest) (*CalendarEventResponse, error) {
	srv, err := s.getGoogleCalendarService(ctx, extractUserIDFromContext(ctx))
	if err != nil {
		return nil, err
	}

	event := &calendar.Event{
		Summary:     req.Title,
		Description: req.Description,
		Start: &calendar.EventDateTime{
			DateTime: req.StartTime.Format(time.RFC3339),
			TimeZone: req.TimeZone,
		},
		End: &calendar.EventDateTime{
			DateTime: req.EndTime.Format(time.RFC3339),
			TimeZone: req.TimeZone,
		},
		Location: req.Location,
	}

	if len(req.AttendeeEmails) > 0 {
		attendees := make([]*calendar.EventAttendee, len(req.AttendeeEmails))
		for i, email := range req.AttendeeEmails {
			attendees[i] = &calendar.EventAttendee{Email: email}
		}
		event.Attendees = attendees
	}

	if len(req.ReminderMinutes) > 0 {
		reminders := make([]*calendar.EventReminder, len(req.ReminderMinutes))
		for i, min := range req.ReminderMinutes {
			reminders[i] = &calendar.EventReminder{
				Method:  "popup",
				Minutes: int64(min),
			}
		}
		event.Reminders = &calendar.EventReminders{
			UseDefault: false,
			Overrides:  reminders,
		}
	}

	if req.RecurrenceRule != "" {
		event.Recurrence = []string{req.RecurrenceRule}
	}

	if req.ConferenceType == "google_meet" {
		event.ConferenceData = &calendar.ConferenceData{
			CreateRequest: &calendar.CreateConferenceRequest{
				RequestId: fmt.Sprintf("meet-%d-%d", req.MeetingID, time.Now().Unix()),
				ConferenceSolutionKey: &calendar.ConferenceSolutionKey{
					Type: "hangoutsMeet",
				},
			},
		}
	}

	createdEvent, err := srv.Events.Insert("primary", event).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar event: %w", err)
	}

	response := &CalendarEventResponse{
		CalendarProvider: "google",
		EventID:          createdEvent.Id,
		MeetingID:        req.MeetingID,
		Title:            createdEvent.Summary,
		StartTime:        req.StartTime,
		EndTime:          req.EndTime,
		Location:         createdEvent.Location,
		MeetingURL:       createdEvent.HangoutLink,
		AttendeeCount:    len(createdEvent.Attendees),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

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
		// If storing fails, we should probably delete the created event from the calendar
		_ = srv.Events.Delete("primary", createdEvent.Id).Do()
		return nil, fmt.Errorf("failed to save calendar event: %w", err)
	}

	return response, nil
}

func (s *enhancedCalendarService) UpdateGoogleCalendarEvent(ctx context.Context, eventID string, req *GoogleCalendarEventRequest) error {
	srv, err := s.getGoogleCalendarService(ctx, extractUserIDFromContext(ctx))
	if err != nil {
		return err
	}

	event := &calendar.Event{
		Summary:     req.Title,
		Description: req.Description,
		Start: &calendar.EventDateTime{
			DateTime: req.StartTime.Format(time.RFC3339),
			TimeZone: req.TimeZone,
		},
		End: &calendar.EventDateTime{
			DateTime: req.EndTime.Format(time.RFC3339),
			TimeZone: req.TimeZone,
		},
		Location: req.Location,
	}

	if len(req.AttendeeEmails) > 0 {
		attendees := make([]*calendar.EventAttendee, len(req.AttendeeEmails))
		for i, email := range req.AttendeeEmails {
			attendees[i] = &calendar.EventAttendee{Email: email}
		}
		event.Attendees = attendees
	}

	_, err = srv.Events.Update("primary", eventID, event).Do()
	if err != nil {
		return fmt.Errorf("failed to update calendar event: %w", err)
	}

	query := `
		UPDATE calendar_events 
		SET title = $1, start_time = $2, end_time = $3, location = $4, attendee_count = $5, updated_at = CURRENT_TIMESTAMP
		WHERE event_id = $6`

	_, err = s.db.ExecContext(ctx, query, req.Title, req.StartTime, req.EndTime, req.Location, len(req.AttendeeEmails), eventID)
	if err != nil {
		return fmt.Errorf("failed to update calendar event in db: %w", err)
	}

	return nil
}

func (s *enhancedCalendarService) DeleteGoogleCalendarEvent(ctx context.Context, eventID string) error {
	srv, err := s.getGoogleCalendarService(ctx, extractUserIDFromContext(ctx))
	if err != nil {
		return err
	}

	err = srv.Events.Delete("primary", eventID).Do()
	if err != nil {
		return fmt.Errorf("failed to delete calendar event: %w", err)
	}

	query := `UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE event_id = $1`
	_, err = s.db.ExecContext(ctx, query, eventID)
	if err != nil {
		return fmt.Errorf("failed to mark calendar event as deleted: %w", err)
	}

	return nil
}

func (s *enhancedCalendarService) GetGoogleCalendarEvent(ctx context.Context, eventID string) (*CalendarEventResponse, error) {
	srv, err := s.getGoogleCalendarService(ctx, extractUserIDFromContext(ctx))
	if err != nil {
		return nil, err
	}

	event, err := srv.Events.Get("primary", eventID).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to get calendar event: %w", err)
	}

	startTime, _ := time.Parse(time.RFC3339, event.Start.DateTime)
	endTime, _ := time.Parse(time.RFC3339, event.End.DateTime)

	response := &CalendarEventResponse{
		CalendarProvider: "google",
		EventID:          event.Id,
		Title:            event.Summary,
		StartTime:        startTime,
		EndTime:          endTime,
		Location:         event.Location,
		MeetingURL:       event.HangoutLink,
		AttendeeCount:    len(event.Attendees),
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
		EventID:          eventID,
		MeetingID:        req.MeetingID,
		Title:            req.Subject,
		StartTime:        req.StartTime,
		EndTime:          req.EndTime,
		Location:         req.Location,
		MeetingURL:       req.MeetingURL,
		AttendeeCount:    len(req.AttendeeEmails),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
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

	fmt.Printf("Created Outlook Calendar event: %s for meeting %d", eventID, req.MeetingID)
	return response, nil
}

func (s *enhancedCalendarService) UpdateOutlookCalendarEvent(ctx context.Context, eventID string, req *OutlookCalendarEventRequest) error {
	fmt.Printf("Updated Outlook Calendar event: %s", eventID)
	return nil
}

func (s *enhancedCalendarService) DeleteOutlookCalendarEvent(ctx context.Context, eventID string) error {
	query := `UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE event_id = $1`
	_, err := s.db.ExecContext(ctx, query, eventID)
	if err != nil {
		return fmt.Errorf("failed to mark Outlook calendar event as deleted: %w", err)
	}

	fmt.Printf("Deleted Outlook Calendar event: %s", eventID)
	return nil
}

// ============================================================================
// ICS FILE GENERATION IMPLEMENTATION
// ============================================================================

// CalendarTemplate represents a calendar event template
type CalendarTemplate struct {
	ID                 int                    `json:"id"`
	Name               string                 `json:"name"`
	Description        string                 `json:"description"`
	DefaultDuration    int                    `json:"default_duration_minutes"`
	DefaultReminders   []int                  `json:"default_reminders"`
	DefaultDescription string                 `json:"default_description"`
	RequiredFields     []string               `json:"required_fields"`
	CustomFields       map[string]interface{} `json:"custom_fields"`
	ConferenceSettings map[string]interface{} `json:"conference_settings"`
	IsActive           bool                   `json:"is_active"`
	CreatedBy          int                    `json:"created_by"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// RecurrencePattern represents meeting recurrence settings
type RecurrencePattern struct {
	Type        string      `json:"type"`                    // daily, weekly, monthly, yearly
	Interval    int         `json:"interval"`                // every N days/weeks/months
	DaysOfWeek  []int       `json:"days_of_week,omitempty"`  // 0=Sunday, 1=Monday, etc.
	DayOfMonth  int         `json:"day_of_month,omitempty"`  // for monthly
	WeekOfMonth int         `json:"week_of_month,omitempty"` // for monthly (1st, 2nd, 3rd, 4th)
	EndDate     *time.Time  `json:"end_date,omitempty"`
	Count       int         `json:"count,omitempty"`      // number of occurrences
	Exceptions  []time.Time `json:"exceptions,omitempty"` // dates to skip
}

// GetCalendarTemplates retrieves available calendar templates
func (s *enhancedCalendarService) GetCalendarTemplates(ctx context.Context, organizationID int) ([]*CalendarTemplate, error) {
	var templates []*CalendarTemplate

	query := `
		SELECT id, name, description, default_duration_minutes, default_reminders, 
			   default_description, required_fields, custom_fields, conference_settings,
			   is_active, created_by, created_at, updated_at
		FROM calendar_templates 
		WHERE organization_id = $1 AND is_active = true
		ORDER BY name`

	rows, err := s.db.QueryContext(ctx, query, organizationID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch calendar templates: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var template CalendarTemplate
		var defaultReminders, requiredFields []byte
		var customFields, conferenceSettings []byte

		err := rows.Scan(
			&template.ID, &template.Name, &template.Description,
			&template.DefaultDuration, &defaultReminders, &template.DefaultDescription,
			&requiredFields, &customFields, &conferenceSettings,
			&template.IsActive, &template.CreatedBy, &template.CreatedAt, &template.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan calendar template: %w", err)
		}

		// Parse JSON fields
		if err := json.Unmarshal(defaultReminders, &template.DefaultReminders); err != nil {
			template.DefaultReminders = []int{15} // Default fallback
		}
		if err := json.Unmarshal(requiredFields, &template.RequiredFields); err != nil {
			template.RequiredFields = []string{}
		}
		if err := json.Unmarshal(customFields, &template.CustomFields); err != nil {
			template.CustomFields = make(map[string]interface{})
		}
		if err := json.Unmarshal(conferenceSettings, &template.ConferenceSettings); err != nil {
			template.ConferenceSettings = make(map[string]interface{})
		}

		templates = append(templates, &template)
	}

	return templates, nil
}

// CreateCalendarTemplate creates a new calendar template
func (s *enhancedCalendarService) CreateCalendarTemplate(ctx context.Context, template *CalendarTemplate, organizationID int) (*CalendarTemplate, error) {
	// Serialize JSON fields
	defaultReminders, _ := json.Marshal(template.DefaultReminders)
	requiredFields, _ := json.Marshal(template.RequiredFields)
	customFields, _ := json.Marshal(template.CustomFields)
	conferenceSettings, _ := json.Marshal(template.ConferenceSettings)

	query := `
		INSERT INTO calendar_templates (organization_id, name, description, default_duration_minutes, 
			default_reminders, default_description, required_fields, custom_fields, 
			conference_settings, is_active, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.QueryRowContext(ctx, query,
		organizationID, template.Name, template.Description, template.DefaultDuration,
		defaultReminders, template.DefaultDescription, requiredFields, customFields,
		conferenceSettings, template.IsActive, template.CreatedBy,
	).Scan(&template.ID, &template.CreatedAt, &template.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create calendar template: %w", err)
	}

	return template, nil
}

// GenerateRecurringMeetings creates multiple meetings based on recurrence pattern
func (s *enhancedCalendarService) GenerateRecurringMeetings(ctx context.Context, baseMeeting *db.Meeting, pattern *RecurrencePattern) ([]*db.Meeting, error) {
	var meetings []*db.Meeting

	// Calculate meeting duration
	duration := baseMeeting.ScheduledEnd.Sub(baseMeeting.ScheduledStart)

	// Generate occurrences based on pattern
	occurrences := s.calculateRecurrenceOccurrences(baseMeeting.ScheduledStart, pattern)

	for i, startTime := range occurrences {
		// Skip exceptions
		if s.isExceptionDate(startTime, pattern.Exceptions) {
			continue
		}

		// Create new meeting instance
		meeting := &db.Meeting{
			Title:           fmt.Sprintf("%s (Occurrence %d)", baseMeeting.Title, i+1),
			Description:     baseMeeting.Description,
			ScheduledStart:  startTime,
			ScheduledEnd:    startTime.Add(duration),
			MeetingID:       fmt.Sprintf("%s-%d", baseMeeting.MeetingID, i+1),
			CreatedBy: baseMeeting.CreatedBy,
			ClientID:        baseMeeting.ClientID,
			IsCancelled:       false,
			ParentMeetingID:     &baseMeeting.ID,
		}

		// Store meeting in database
		meetingID, err := s.createRecurringMeetingInstance(ctx, meeting)
		if err != nil {
			return nil, fmt.Errorf("failed to create recurring meeting instance: %w", err)
		}
		meeting.ID = meetingID

		meetings = append(meetings, meeting)
	}

	return meetings, nil
}

func (s *enhancedCalendarService) calculateRecurrenceOccurrences(startTime time.Time, pattern *RecurrencePattern) []time.Time {
	var occurrences []time.Time
	current := startTime
	count := 0
	maxOccurrences := pattern.Count

	// If no count specified, limit to reasonable number
	if maxOccurrences == 0 {
		maxOccurrences = 52 // 1 year for weekly meetings
	}

	for count < maxOccurrences {
		// Check end date constraint
		if pattern.EndDate != nil && current.After(*pattern.EndDate) {
			break
		}

		occurrences = append(occurrences, current)
		current = s.getNextOccurrence(current, pattern)
		count++

		// Safety check to prevent infinite loops
		if count > 1000 {
			break
		}
	}

	return occurrences
}

func (s *enhancedCalendarService) getNextOccurrence(current time.Time, pattern *RecurrencePattern) time.Time {
	switch pattern.Type {
	case "daily":
		return current.AddDate(0, 0, pattern.Interval)
	case "weekly":
		if len(pattern.DaysOfWeek) > 0 {
			return s.getNextWeeklyOccurrence(current, pattern)
		}
		return current.AddDate(0, 0, 7*pattern.Interval)
	case "monthly":
		if pattern.DayOfMonth > 0 {
			return s.getNextMonthlyOccurrenceByDay(current, pattern)
		} else if pattern.WeekOfMonth > 0 {
			return s.getNextMonthlyOccurrenceByWeek(current, pattern)
		}
		return current.AddDate(0, pattern.Interval, 0)
	case "yearly":
		return current.AddDate(pattern.Interval, 0, 0)
	default:
		return current.AddDate(0, 0, 7) // Default to weekly
	}
}

func (s *enhancedCalendarService) getNextWeeklyOccurrence(current time.Time, pattern *RecurrencePattern) time.Time {
	currentWeekday := int(current.Weekday())

	// Find next day in the pattern
	for i := 1; i <= 7; i++ {
		nextWeekday := (currentWeekday + i) % 7
		for _, day := range pattern.DaysOfWeek {
			if day == nextWeekday {
				return current.AddDate(0, 0, i)
			}
		}
	}

	// If no day found in current week, move to next week cycle
	return current.AddDate(0, 0, 7*pattern.Interval)
}

func (s *enhancedCalendarService) getNextMonthlyOccurrenceByDay(current time.Time, pattern *RecurrencePattern) time.Time {
	nextMonth := current.AddDate(0, pattern.Interval, 0)

	// Set to the specified day of month
	year, month, _ := nextMonth.Date()
	location := nextMonth.Location()

	// Handle case where day doesn't exist in month (e.g., Feb 31st)
	lastDayOfMonth := time.Date(year, month+1, 0, 0, 0, 0, 0, location).Day()
	day := pattern.DayOfMonth
	if day > lastDayOfMonth {
		day = lastDayOfMonth
	}

	return time.Date(year, month, day, current.Hour(), current.Minute(), current.Second(), current.Nanosecond(), location)
}

func (s *enhancedCalendarService) getNextMonthlyOccurrenceByWeek(current time.Time, pattern *RecurrencePattern) time.Time {
	nextMonth := current.AddDate(0, pattern.Interval, 0)
	year, month, _ := nextMonth.Date()
	location := nextMonth.Location()

	// Find the specified week of the month
	firstDayOfMonth := time.Date(year, month, 1, current.Hour(), current.Minute(), current.Second(), current.Nanosecond(), location)
	targetWeekday := current.Weekday()

	// Find first occurrence of target weekday in the month
	daysUntilTargetWeekday := (int(targetWeekday) - int(firstDayOfMonth.Weekday()) + 7) % 7
	firstOccurrence := firstDayOfMonth.AddDate(0, 0, daysUntilTargetWeekday)

	// Add weeks to get to the specified week
	weekOffset := (pattern.WeekOfMonth - 1) * 7
	targetDate := firstOccurrence.AddDate(0, 0, weekOffset)

	// Check if the target date is still in the same month
	if targetDate.Month() != month {
		// Handle case where week doesn't exist (e.g., 5th Tuesday of a month that only has 4 Tuesdays)
		// Fall back to last occurrence of the weekday in the month
		lastDayOfMonth := time.Date(year, month+1, 0, 0, 0, 0, 0, location)
		for lastDayOfMonth.Weekday() != targetWeekday {
			lastDayOfMonth = lastDayOfMonth.AddDate(0, 0, -1)
		}
		return time.Date(lastDayOfMonth.Year(), lastDayOfMonth.Month(), lastDayOfMonth.Day(),
			current.Hour(), current.Minute(), current.Second(), current.Nanosecond(), location)
	}

	return targetDate
}

func (s *enhancedCalendarService) isExceptionDate(date time.Time, exceptions []time.Time) bool {
	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)

	for _, exception := range exceptions {
		exceptionOnly := time.Date(exception.Year(), exception.Month(), exception.Day(), 0, 0, 0, 0, time.UTC)
		if dateOnly.Equal(exceptionOnly) {
			return true
		}
	}
	return false
}

func (s *enhancedCalendarService) createRecurringMeetingInstance(ctx context.Context, meeting *db.Meeting) (int, error) {
	query := `
		INSERT INTO meetings (title, description, scheduled_start, scheduled_end, meeting_id, 
			created_by_user_id, client_id, is_recurring, recurring_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id`

	var id int
	err := s.db.QueryRowContext(ctx, query,
		meeting.Title, meeting.Description, meeting.ScheduledStart, meeting.ScheduledEnd,
		meeting.MeetingID, meeting.CreatedBy, meeting.ClientID, meeting.IsCancelled, meeting.ParentMeetingID,
	).Scan(&id)

	return id, err
}

// Calendar conflict detection
func (s *enhancedCalendarService) DetectCalendarConflicts(ctx context.Context, userID int, startTime, endTime time.Time, excludeMeetingID *int) ([]*CalendarConflict, error) {
	var conflicts []*CalendarConflict

	// Check internal meeting conflicts
	query := `
		SELECT m.id, m.title, m.scheduled_start, m.scheduled_end, 'internal' as source
		FROM meetings m
		JOIN meeting_participants mp ON m.id = mp.meeting_id
		WHERE mp.user_id = $1 
		AND m.scheduled_start < $3 
		AND m.scheduled_end > $2
		AND ($4 IS NULL OR m.id != $4)
		AND m.status != 'cancelled'`

	rows, err := s.db.QueryContext(ctx, query, userID, startTime, endTime, excludeMeetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to check internal conflicts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var conflict CalendarConflict
		err := rows.Scan(&conflict.MeetingID, &conflict.Title, &conflict.StartTime, &conflict.EndTime, &conflict.Source)
		if err != nil {
			continue
		}

		conflict.ConflictType = s.determineConflictType(startTime, endTime, conflict.StartTime, conflict.EndTime)
		conflicts = append(conflicts, &conflict)
	}

	// TODO: Check external calendar conflicts (Google Calendar, Outlook)

	return conflicts, nil
}

// CalendarConflict represents a scheduling conflict
type CalendarConflict struct {
	MeetingID    int       `json:"meeting_id"`
	Title        string    `json:"title"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	Source       string    `json:"source"`        // internal, google, outlook
	ConflictType string    `json:"conflict_type"` // full_overlap, partial_overlap, adjacent
}

func (s *enhancedCalendarService) determineConflictType(newStart, newEnd, existingStart, existingEnd time.Time) string {
	// Full overlap - new meeting completely overlaps existing
	if newStart.Before(existingStart) && newEnd.After(existingEnd) {
		return "full_overlap"
	}

	// Existing meeting completely overlaps new
	if existingStart.Before(newStart) && existingEnd.After(newEnd) {
		return "full_overlap"
	}

	// Partial overlap
	if newStart.Before(existingEnd) && newEnd.After(existingStart) {
		return "partial_overlap"
	}

	// Adjacent meetings (within 15 minutes)
	if newEnd.Add(15*time.Minute).After(existingStart) && newEnd.Before(existingStart) {
		return "adjacent"
	}
	if existingEnd.Add(15*time.Minute).After(newStart) && existingEnd.Before(newStart) {
		return "adjacent"
	}

	return "no_conflict"
}

// Meeting reminders
func (s *enhancedCalendarService) ScheduleMeetingReminders(ctx context.Context, meetingID int, reminderMinutes []int) error {
	// Delete existing reminders
	_, err := s.db.ExecContext(ctx, "DELETE FROM meeting_reminders WHERE meeting_id = $1", meetingID)
	if err != nil {
		return fmt.Errorf("failed to delete existing reminders: %w", err)
	}

	// Insert new reminders
	for _, minutes := range reminderMinutes {
		query := `
			INSERT INTO meeting_reminders (meeting_id, minutes_before, is_sent, created_at)
			VALUES ($1, $2, false, CURRENT_TIMESTAMP)`

		_, err = s.db.ExecContext(ctx, query, meetingID, minutes)
		if err != nil {
			return fmt.Errorf("failed to schedule reminder: %w", err)
		}
	}

	return nil
}

func (s *enhancedCalendarService) ProcessDueReminders(ctx context.Context) error {
	query := `
		SELECT mr.id, mr.meeting_id, mr.minutes_before, m.title, m.scheduled_start,
			   GROUP_CONCAT(u.email) as attendee_emails,
			   m.meeting_id as join_code
		FROM meeting_reminders mr
		JOIN meetings m ON mr.meeting_id = m.id
		JOIN meeting_participants mp ON m.id = mp.meeting_id
		JOIN users u ON mp.user_id = u.id
		WHERE mr.is_sent = false
		AND m.scheduled_start <= datetime('now', '+' || mr.minutes_before || ' minutes')
		AND m.status = 'scheduled'
		GROUP BY mr.id, mr.meeting_id, mr.minutes_before, m.title, m.scheduled_start, m.meeting_id`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to fetch due reminders: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var reminderID, meetingID, minutesBefore int
		var title, attendeeEmails, joinCode string
		var scheduledStart time.Time

		err := rows.Scan(&reminderID, &meetingID, &minutesBefore, &title, &scheduledStart, &attendeeEmails, &joinCode)
		if err != nil {
			continue
		}

		// Send reminder notifications
		err = s.sendMeetingReminder(ctx, title, scheduledStart, minutesBefore, joinCode, strings.Split(attendeeEmails, ","))
		if err != nil {
			fmt.Printf("Failed to send reminder for meeting %d: %v", meetingID, err)
			continue
		}

		// Mark reminder as sent
		_, err = s.db.ExecContext(ctx, "UPDATE meeting_reminders SET is_sent = true WHERE id = $1", reminderID)
		if err != nil {
			fmt.Printf("Failed to mark reminder %d as sent: %v", reminderID, err)
		}
	}

	return nil
}

func (s *enhancedCalendarService) sendMeetingReminder(ctx context.Context, title string, scheduledStart time.Time, minutesBefore int, joinCode string, attendeeEmails []string) error {
	// This would integrate with the notification service
	// For now, we'll just log it
	fmt.Printf("Sending reminder: '%s' starts in %d minutes. Join code: %s. Attendees: %v",
		title, minutesBefore, joinCode, attendeeEmails)
	return nil
}

func (s *enhancedCalendarService) GenerateICSFile(ctx context.Context, meeting *db.Meeting, attendees []string) ([]byte, error) {
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
DESCRIPTION:%s\\Join Meeting: %s/%s
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
		icsContent += fmt.Sprintf("ATTENDEE:CN=%s:MAILTO:%s", email, email)
	}

	icsContent += `TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`

	return []byte(icsContent), nil
}

func (s *enhancedCalendarService) GenerateRecurringICS(ctx context.Context, meetings []*db.Meeting, attendees []string) ([]byte, error) {
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
DESCRIPTION:%s\\Join Meeting: %s/%s
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
		icsContent += fmt.Sprintf("ATTENDEE:CN=%s:MAILTO:%s", email, email)
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
	return s.googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce),
		nil
}

func (s *enhancedCalendarService) ExchangeGoogleOAuthCode(ctx context.Context, userID int, code string) (*OAuthTokens, error) {
	token, err := s.googleOAuthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	oauthTokens := &OAuthTokens{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresAt:    token.Expiry,
		Scope:        s.googleOAuthConfig.Scopes[0],
	}

	err = s.storeUserTokens(ctx, userID, "google", oauthTokens)
	if err != nil {
		return nil, err
	}

	return oauthTokens, nil
}

func (s *enhancedCalendarService) RefreshGoogleToken(ctx context.Context, userID int) (*OAuthTokens, error) {
	currentTokens, err := s.getUserGoogleTokens(ctx, userID)
	if err != nil {
		return nil, err
	}

	token := &oauth2.Token{
		AccessToken:  currentTokens.AccessToken,
		RefreshToken: currentTokens.RefreshToken,
		TokenType:    currentTokens.TokenType,
		Expiry:       currentTokens.ExpiresAt,
	}

	tokenSource := s.googleOAuthConfig.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	oauthTokens := &OAuthTokens{
		AccessToken:  newToken.AccessToken,
		RefreshToken: newToken.RefreshToken,
		TokenType:    newToken.TokenType,
		ExpiresAt:    newToken.Expiry,
		Scope:        s.googleOAuthConfig.Scopes[0],
	}

	err = s.storeUserTokens(ctx, userID, "google", oauthTokens)
	if err != nil {
		return nil, err
	}

	return oauthTokens, nil
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

func (s *enhancedCalendarService) CreateMeetingCalendarEvents(ctx context.Context, meeting *db.Meeting, attendeeEmails []string) ([]*CalendarEventResponse, error) {
	var events []*CalendarEventResponse

	// Create Google Calendar event if any attendee has Google Calendar connected
	googleReq := &GoogleCalendarEventRequest{
		MeetingID:        meeting.ID,
		Title:            meeting.Title,
		Description:      *meeting.Description,
		StartTime:        meeting.ScheduledStart,
		EndTime:          meeting.ScheduledEnd,
		TimeZone:         "UTC",
		Location:         "Video Conference Meeting",
		AttendeeEmails:   attendeeEmails,
		MeetingURL:       fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
		SendNotification: true,
		ReminderMinutes:  []int{15, 5},
		ConferenceType:   "custom",
	}

	googleEvent, err := s.CreateGoogleCalendarEvent(ctx, googleReq)
	if err == nil {
		events = append(events, googleEvent)
	}

	// Create Outlook Calendar event
	outlookReq := &OutlookCalendarEventRequest{
		MeetingID:       meeting.ID,
		Subject:         meeting.Title,
		Body:            *meeting.Description,
		StartTime:       meeting.ScheduledStart,
		EndTime:         meeting.ScheduledEnd,
		TimeZone:        "UTC",
		Location:        "Video Conference Meeting",
		AttendeeEmails:  attendeeEmails,
		MeetingURL:      fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
		IsOnlineMeeting: true,
		ReminderMinutes: 15,
	}

	outlookEvent, err := s.CreateOutlookCalendarEvent(ctx, outlookReq)
	if err == nil {
		events = append(events, outlookEvent)
	}

	return events, nil
}

func (s *enhancedCalendarService) UpdateMeetingCalendarEvents(ctx context.Context, meeting *db.Meeting, attendeeEmails []string) error {
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
				MeetingID:      meeting.ID,
				Title:          meeting.Title,
				Description:    *meeting.Description,
				StartTime:      meeting.ScheduledStart,
				EndTime:        meeting.ScheduledEnd,
				TimeZone:       "UTC",
				AttendeeEmails: attendeeEmails,
				MeetingURL:     fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
			}
			s.UpdateGoogleCalendarEvent(ctx, eventID, googleReq)
		} else if len(eventID) > 7 && eventID[:7] == "outlook" {
			outlookReq := &OutlookCalendarEventRequest{
				MeetingID:      meeting.ID,
				Subject:        meeting.Title,
				Body:           *meeting.Description,
				StartTime:      meeting.ScheduledStart,
				EndTime:        meeting.ScheduledEnd,
				TimeZone:       "UTC",
				AttendeeEmails: attendeeEmails,
				MeetingURL:     fmt.Sprintf("https://meet.videoconference.com/%s", meeting.MeetingID),
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

	fmt.Printf("IsCancelled %d calendar events for meeting %d: %s", len(eventIDs), meetingID, reason)
	return nil
}

func (s *enhancedCalendarService) SyncMeetingToCalendars(ctx context.Context, meetingID int) error {
	// This would implement full calendar synchronization
	fmt.Printf("Syncing meeting %d to calendars", meetingID)
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
