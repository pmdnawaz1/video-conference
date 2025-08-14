package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type TimeValidationService interface {
	// Meeting time validation
	ValidateMeetingAccess(ctx context.Context, meetingID int, userID int) (*MeetingAccessResult, error)
	CheckMeetingTimeWindow(ctx context.Context, meeting *models.Meeting) (*TimeWindowStatus, error)
	GetMeetingTimeInfo(ctx context.Context, meetingID int) (*MeetingTimeInfo, error)

	// Buffer time configuration
	UpdateMeetingBufferTime(ctx context.Context, meetingID int, bufferStartMinutes, bufferEndMinutes int) error
	GetMeetingBufferSettings(ctx context.Context, meetingID int) (*BufferSettings, error)

	// Admin override functionality
	GrantAdminOverride(ctx context.Context, meetingID int, adminID int, userID int, reason string) error
	CheckAdminOverride(ctx context.Context, meetingID int, userID int) (*AdminOverride, error)

	// Meeting status validation
	ValidateMeetingStatus(ctx context.Context, meetingID int, expectedStatus string) error
	UpdateMeetingStatus(ctx context.Context, meetingID int, status string, adminID *int) error
}

// Result types for time validation operations
type MeetingAccessResult struct {
	CanJoin        bool             `json:"can_join"`
	Status         string           `json:"status"` // allowed, too_early, too_late, meeting_ended, meeting_cancelled
	Reason         string           `json:"reason"`
	TimeUntilStart *time.Duration   `json:"time_until_start,omitempty"`
	TimeUntilEnd   *time.Duration   `json:"time_until_end,omitempty"`
	AdminOverride  *AdminOverride   `json:"admin_override,omitempty"`
	BufferSettings *BufferSettings  `json:"buffer_settings"`
	MeetingInfo    *MeetingTimeInfo `json:"meeting_info"`
}

type TimeWindowStatus struct {
	IsOpen            bool   `json:"is_open"`
	Status            string `json:"status"` // not_started, active, ended, cancelled
	CanJoinEarly      bool   `json:"can_join_early"`
	CanJoinLate       bool   `json:"can_join_late"`
	MinutesUntilStart int    `json:"minutes_until_start"`
	MinutesUntilEnd   int    `json:"minutes_until_end"`
	MinutesSinceStart int    `json:"minutes_since_start"`
	MinutesSinceEnd   int    `json:"minutes_since_end"`
	BufferStartActive bool   `json:"buffer_start_active"`
	BufferEndActive   bool   `json:"buffer_end_active"`
}

type MeetingTimeInfo struct {
	MeetingID          int        `json:"meeting_id"`
	Title              string     `json:"title"`
	ScheduledStart     time.Time  `json:"scheduled_start"`
	ScheduledEnd       time.Time  `json:"scheduled_end"`
	ActualStart        *time.Time `json:"actual_start,omitempty"`
	ActualEnd          *time.Time `json:"actual_end,omitempty"`
	Status             string     `json:"status"`
	BufferStartMinutes int        `json:"buffer_start_minutes"`
	BufferEndMinutes   int        `json:"buffer_end_minutes"`
	TimeZone           string     `json:"timezone"`
	Duration           int        `json:"duration_minutes"`
	IsRecurring        bool       `json:"is_recurring"`
}

type BufferSettings struct {
	MeetingID          int       `json:"meeting_id"`
	BufferStartMinutes int       `json:"buffer_start_minutes"`
	BufferEndMinutes   int       `json:"buffer_end_minutes"`
	AllowEarlyJoin     bool      `json:"allow_early_join"`
	AllowLateJoin      bool      `json:"allow_late_join"`
	UpdatedAt          time.Time `json:"updated_at"`
	UpdatedBy          *int      `json:"updated_by,omitempty"`
}

type AdminOverride struct {
	ID        int       `json:"id"`
	MeetingID int       `json:"meeting_id"`
	UserID    int       `json:"user_id"`
	AdminID   int       `json:"admin_id"`
	Reason    string    `json:"reason"`
	IsActive  bool      `json:"is_active"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	AdminName string    `json:"admin_name,omitempty"`
}

type timeValidationService struct {
	db *database.DB
}

func NewTimeValidationService(db *database.DB) TimeValidationService {
	return &timeValidationService{
		db: db,
	}
}

// ============================================================================
// MEETING TIME VALIDATION IMPLEMENTATION
// ============================================================================

func (s *timeValidationService) ValidateMeetingAccess(ctx context.Context, meetingID int, userID int) (*MeetingAccessResult, error) {
	// Get meeting information
	meeting := &models.Meeting{}
	query := `SELECT id, title, scheduled_start, scheduled_end, actual_start, actual_end, status,
			         buffer_start_minutes, buffer_end_minutes
			  FROM meetings WHERE id = $1`

	err := s.db.GetContext(ctx, meeting, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting: %w", err)
	}

	result := &MeetingAccessResult{
		MeetingInfo: &MeetingTimeInfo{
			MeetingID:      meeting.ID,
			Title:          meeting.Title,
			ScheduledStart: meeting.ScheduledStart,
			ScheduledEnd:   meeting.ScheduledEnd,
			ActualStart:    meeting.ActualStart,
			ActualEnd:      meeting.ActualEnd,
			Status:         meeting.Status,
			Duration:       int(meeting.ScheduledEnd.Sub(meeting.ScheduledStart).Minutes()),
			TimeZone:       "UTC", // Default timezone
		},
	}

	// Get buffer settings
	bufferSettings, err := s.GetMeetingBufferSettings(ctx, meetingID)
	if err == nil {
		result.BufferSettings = bufferSettings
		result.MeetingInfo.BufferStartMinutes = bufferSettings.BufferStartMinutes
		result.MeetingInfo.BufferEndMinutes = bufferSettings.BufferEndMinutes
	} else {
		// Default buffer settings
		result.BufferSettings = &BufferSettings{
			MeetingID:          meetingID,
			BufferStartMinutes: 5,  // Default 5 minutes early
			BufferEndMinutes:   10, // Default 10 minutes late
			AllowEarlyJoin:     true,
			AllowLateJoin:      true,
		}
		result.MeetingInfo.BufferStartMinutes = 5
		result.MeetingInfo.BufferEndMinutes = 10
	}

	// Check admin override
	adminOverride, err := s.CheckAdminOverride(ctx, meetingID, userID)
	if err == nil && adminOverride != nil && adminOverride.IsActive {
		result.AdminOverride = adminOverride
		result.CanJoin = true
		result.Status = "allowed"
		result.Reason = "Admin override granted: " + adminOverride.Reason
		return result, nil
	}

	// Check meeting status first
	if meeting.Status == "cancelled" {
		result.Status = "meeting_cancelled"
		result.Reason = "This meeting has been cancelled"
		return result, nil
	}

	if meeting.Status == "ended" || meeting.ActualEnd != nil {
		result.Status = "meeting_ended"
		result.Reason = "This meeting has ended"
		return result, nil
	}

	now := time.Now()

	// Calculate time windows with buffer
	earlyJoinTime := meeting.ScheduledStart.Add(time.Duration(-result.BufferSettings.BufferStartMinutes) * time.Minute)
	lateJoinTime := meeting.ScheduledEnd.Add(time.Duration(result.BufferSettings.BufferEndMinutes) * time.Minute)

	// Check if too early (before buffer)
	if now.Before(earlyJoinTime) {
		timeUntilStart := earlyJoinTime.Sub(now)
		result.TimeUntilStart = &timeUntilStart
		result.Status = "too_early"
		result.Reason = fmt.Sprintf("Meeting hasn't started yet. You can join in %d minutes.", int(timeUntilStart.Minutes()))
		return result, nil
	}

	// Check if too late (after buffer)
	if now.After(lateJoinTime) {
		result.Status = "too_late"
		result.Reason = "The meeting has ended and the late join window has passed"
		return result, nil
	}

	// Meeting is active or within buffer time
	if meeting.Status == "active" || (now.After(earlyJoinTime) && now.Before(lateJoinTime)) {
		result.CanJoin = true
		result.Status = "allowed"

		if now.Before(meeting.ScheduledStart) {
			result.Reason = "Joining early (within buffer time)"
		} else if now.After(meeting.ScheduledEnd) {
			result.Reason = "Joining late (within buffer time)"
		} else {
			result.Reason = "Meeting is active"
		}

		// Set time information
		if now.Before(meeting.ScheduledEnd) {
			timeUntilEnd := meeting.ScheduledEnd.Sub(now)
			result.TimeUntilEnd = &timeUntilEnd
		}
	}

	return result, nil
}

func (s *timeValidationService) CheckMeetingTimeWindow(ctx context.Context, meeting *models.Meeting) (*TimeWindowStatus, error) {
	now := time.Now()

	status := &TimeWindowStatus{
		Status: meeting.Status,
	}

	// Get buffer settings
	bufferSettings, err := s.GetMeetingBufferSettings(ctx, meeting.ID)
	bufferStartMinutes := 5 // default
	bufferEndMinutes := 10  // default

	if err == nil && bufferSettings != nil {
		bufferStartMinutes = bufferSettings.BufferStartMinutes
		bufferEndMinutes = bufferSettings.BufferEndMinutes
		status.CanJoinEarly = bufferSettings.AllowEarlyJoin
		status.CanJoinLate = bufferSettings.AllowLateJoin
	} else {
		status.CanJoinEarly = true
		status.CanJoinLate = true
	}

	// Calculate time windows
	earlyJoinTime := meeting.ScheduledStart.Add(time.Duration(-bufferStartMinutes) * time.Minute)
	lateJoinTime := meeting.ScheduledEnd.Add(time.Duration(bufferEndMinutes) * time.Minute)

	// Calculate time differences
	if now.Before(meeting.ScheduledStart) {
		status.MinutesUntilStart = int(meeting.ScheduledStart.Sub(now).Minutes())
	} else {
		status.MinutesSinceStart = int(now.Sub(meeting.ScheduledStart).Minutes())
	}

	if now.Before(meeting.ScheduledEnd) {
		status.MinutesUntilEnd = int(meeting.ScheduledEnd.Sub(now).Minutes())
	} else {
		status.MinutesSinceEnd = int(now.Sub(meeting.ScheduledEnd).Minutes())
	}

	// Check buffer windows
	status.BufferStartActive = now.After(earlyJoinTime) && now.Before(meeting.ScheduledStart)
	status.BufferEndActive = now.After(meeting.ScheduledEnd) && now.Before(lateJoinTime)

	// Determine if window is open
	status.IsOpen = now.After(earlyJoinTime) && now.Before(lateJoinTime)

	// Update status based on time
	if meeting.Status == "cancelled" {
		status.Status = "cancelled"
		status.IsOpen = false
	} else if meeting.Status == "ended" || meeting.ActualEnd != nil {
		status.Status = "ended"
		status.IsOpen = false
	} else if now.Before(earlyJoinTime) {
		status.Status = "not_started"
		status.IsOpen = false
	} else if now.After(lateJoinTime) {
		status.Status = "ended"
		status.IsOpen = false
	} else if now.After(meeting.ScheduledStart) && now.Before(meeting.ScheduledEnd) {
		status.Status = "active"
		status.IsOpen = true
	}

	return status, nil
}

func (s *timeValidationService) GetMeetingTimeInfo(ctx context.Context, meetingID int) (*MeetingTimeInfo, error) {
	info := &MeetingTimeInfo{}

	query := `
		SELECT m.id, m.title, m.scheduled_start, m.scheduled_end, m.actual_start, m.actual_end,
			   m.status, m.is_recurring,
			   COALESCE(m.buffer_start_minutes, 5) as buffer_start_minutes,
			   COALESCE(m.buffer_end_minutes, 10) as buffer_end_minutes
		FROM meetings m
		WHERE m.id = $1`

	err := s.db.GetContext(ctx, info, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting time info: %w", err)
	}

	// Calculate duration
	info.Duration = int(info.ScheduledEnd.Sub(info.ScheduledStart).Minutes())
	info.TimeZone = "UTC" // Default timezone

	return info, nil
}

// ============================================================================
// BUFFER TIME CONFIGURATION IMPLEMENTATION
// ============================================================================

func (s *timeValidationService) UpdateMeetingBufferTime(ctx context.Context, meetingID int, bufferStartMinutes, bufferEndMinutes int) error {
	query := `
		UPDATE meetings 
		SET buffer_start_minutes = $2, buffer_end_minutes = $3, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1`

	_, err := s.db.ExecContext(ctx, query, meetingID, bufferStartMinutes, bufferEndMinutes)
	if err != nil {
		return fmt.Errorf("failed to update buffer time: %w", err)
	}

	return nil
}

func (s *timeValidationService) GetMeetingBufferSettings(ctx context.Context, meetingID int) (*BufferSettings, error) {
	settings := &BufferSettings{}

	query := `
		SELECT id as meeting_id, 
			   COALESCE(buffer_start_minutes, 5) as buffer_start_minutes,
			   COALESCE(buffer_end_minutes, 10) as buffer_end_minutes,
			   updated_at
		FROM meetings 
		WHERE id = $1`

	err := s.db.GetContext(ctx, settings, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get buffer settings: %w", err)
	}

	// Set default values
	settings.AllowEarlyJoin = true
	settings.AllowLateJoin = true

	return settings, nil
}

// ============================================================================
// ADMIN OVERRIDE IMPLEMENTATION
// ============================================================================

func (s *timeValidationService) GrantAdminOverride(ctx context.Context, meetingID int, adminID int, userID int, reason string) error {
	// Insert or update admin override
	query := `
		INSERT INTO meeting_admin_overrides (meeting_id, user_id, admin_id, reason, is_active, expires_at, created_at)
		VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP)
		ON CONFLICT (meeting_id, user_id) 
		DO UPDATE SET 
			admin_id = $3, 
			reason = $4, 
			is_active = true, 
			expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours',
			created_at = CURRENT_TIMESTAMP`

	_, err := s.db.ExecContext(ctx, query, meetingID, userID, adminID, reason)
	if err != nil {
		return fmt.Errorf("failed to grant admin override: %w", err)
	}

	return nil
}

func (s *timeValidationService) CheckAdminOverride(ctx context.Context, meetingID int, userID int) (*AdminOverride, error) {
	override := &AdminOverride{}

	query := `
		SELECT o.id, o.meeting_id, o.user_id, o.admin_id, o.reason, o.is_active, 
			   o.expires_at, o.created_at,
			   u.first_name || ' ' || u.last_name as admin_name
		FROM meeting_admin_overrides o
		JOIN users u ON o.admin_id = u.id
		WHERE o.meeting_id = $1 AND o.user_id = $2 AND o.is_active = true AND o.expires_at > CURRENT_TIMESTAMP`

	err := s.db.GetContext(ctx, override, query, meetingID, userID)
	if err != nil {
		return nil, err // Not found is expected
	}

	return override, nil
}

// ============================================================================
// MEETING STATUS VALIDATION IMPLEMENTATION
// ============================================================================

func (s *timeValidationService) ValidateMeetingStatus(ctx context.Context, meetingID int, expectedStatus string) error {
	var currentStatus string
	query := `SELECT status FROM meetings WHERE id = $1`

	err := s.db.GetContext(ctx, &currentStatus, query, meetingID)
	if err != nil {
		return fmt.Errorf("failed to get meeting status: %w", err)
	}

	if currentStatus != expectedStatus {
		return fmt.Errorf("meeting status is '%s', expected '%s'", currentStatus, expectedStatus)
	}

	return nil
}

func (s *timeValidationService) UpdateMeetingStatus(ctx context.Context, meetingID int, status string, adminID *int) error {
	now := time.Now()

	// Build update query based on status
	var query string
	var args []interface{}

	switch status {
	case "active":
		query = `UPDATE meetings SET status = $1, actual_start = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`
		args = []interface{}{status, now, meetingID}
	case "ended":
		query = `UPDATE meetings SET status = $1, actual_end = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`
		args = []interface{}{status, now, meetingID}
	default:
		query = `UPDATE meetings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
		args = []interface{}{status, meetingID}
	}

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update meeting status: %w", err)
	}

	// Log status change if admin provided
	if adminID != nil {
		logQuery := `
			INSERT INTO meeting_status_logs (meeting_id, previous_status, new_status, changed_by, changed_at)
			SELECT $1, 
				   (SELECT status FROM meetings WHERE id = $1), 
				   $2, $3, CURRENT_TIMESTAMP`

		_, err = s.db.ExecContext(ctx, logQuery, meetingID, status, *adminID)
		// Log error but don't fail the status update
		if err != nil {
			fmt.Printf("Warning: failed to log meeting status change: %v", err)
		}
	}

	return nil
}
