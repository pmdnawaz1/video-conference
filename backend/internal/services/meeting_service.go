package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type MeetingService interface {
	CreateMeeting(ctx context.Context, meeting *models.Meeting) error
	GetMeetingByID(ctx context.Context, id int) (*models.Meeting, error)
	GetMeetingByMeetingID(ctx context.Context, meetingID string) (*models.Meeting, error)
	UpdateMeeting(ctx context.Context, meeting *models.Meeting) error
	DeleteMeeting(ctx context.Context, id int) error
	CancelMeeting(ctx context.Context, id int) error
	
	// Meeting lifecycle
	StartMeeting(ctx context.Context, meetingID string, hostID int) error
	EndMeeting(ctx context.Context, meetingID string) error
	
	// Meeting queries
	ListMeetingsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Meeting, error)
	ListMeetingsByHost(ctx context.Context, hostID int, limit, offset int) ([]*models.Meeting, error)
	GetUpcomingMeetings(ctx context.Context, clientID int, limit int) ([]*models.Meeting, error)
	GetMeetingsByDateRange(ctx context.Context, clientID int, start, end time.Time) ([]*models.Meeting, error)
	
	// Participants
	AddParticipant(ctx context.Context, participant *models.MeetingParticipant) error
	RemoveParticipant(ctx context.Context, meetingID int, userID *int, email *string) error
	GetMeetingParticipants(ctx context.Context, meetingID int) ([]*models.MeetingParticipant, error)
	UpdateParticipantStatus(ctx context.Context, meetingID int, userID *int, email *string, status string) error
	UpdateParticipantRole(ctx context.Context, meetingID int, userID *int, email *string, role string) error
	
	// Recurrence
	CreateRecurringMeetings(ctx context.Context, parentMeeting *models.Meeting) ([]*models.Meeting, error)
	GetRecurringMeetingInstances(ctx context.Context, parentMeetingID int) ([]*models.Meeting, error)
}

type meetingService struct {
	db *database.DB
}

func NewMeetingService(db *database.DB) MeetingService {
	return &meetingService{db: db}
}

func (s *meetingService) CreateMeeting(ctx context.Context, meeting *models.Meeting) error {
	// Generate unique meeting ID if not provided
	if meeting.MeetingID == "" {
		meeting.MeetingID = models.GenerateMeetingID()
	}

	query := `
		INSERT INTO meetings (client_id, title, description, created_by_user_id, meeting_id, password, 
		                     scheduled_start, scheduled_end, status, max_participants, allow_anonymous,
		                     require_approval, enable_waiting_room, enable_chat, enable_screen_sharing,
		                     enable_recording, settings)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, meeting, query,
		meeting.ClientID, meeting.Title, meeting.Description, meeting.CreatedByUserID, meeting.MeetingID,
		meeting.Password, meeting.ScheduledStart, meeting.ScheduledEnd, meeting.Status,
		meeting.MaxParticipants, meeting.AllowAnonymous, meeting.RequireApproval,
		meeting.EnableWaitingRoom, meeting.EnableChat, meeting.EnableScreenSharing,
		meeting.EnableRecording, meeting.Settings)
	if err != nil {
		return fmt.Errorf("failed to create meeting: %w", err)
	}

	return nil
}

func (s *meetingService) GetMeetingByID(ctx context.Context, id int) (*models.Meeting, error) {
	meeting := &models.Meeting{}
	query := `SELECT * FROM meetings WHERE id = $1`
	
	err := s.db.GetContext(ctx, meeting, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting by ID: %w", err)
	}
	
	return meeting, nil
}

func (s *meetingService) GetMeetingByMeetingID(ctx context.Context, meetingID string) (*models.Meeting, error) {
	meeting := &models.Meeting{}
	query := `SELECT * FROM meetings WHERE meeting_id = $1`
	
	err := s.db.GetContext(ctx, meeting, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting by meeting ID: %w", err)
	}
	
	return meeting, nil
}

func (s *meetingService) UpdateMeeting(ctx context.Context, meeting *models.Meeting) error {
	query := `
		UPDATE meetings 
		SET title = $2, description = $3, scheduled_start = $4, scheduled_end = $5, 
		    password = $6, settings = $7, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query,
		meeting.ID, meeting.Title, meeting.Description, meeting.ScheduledStart,
		meeting.ScheduledEnd, meeting.Password, meeting.Settings)
	if err != nil {
		return fmt.Errorf("failed to update meeting: %w", err)
	}
	
	return nil
}

func (s *meetingService) DeleteMeeting(ctx context.Context, id int) error {
	query := `DELETE FROM meetings WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete meeting: %w", err)
	}
	
	return nil
}

func (s *meetingService) CancelMeeting(ctx context.Context, id int) error {
	query := `
		UPDATE meetings 
		SET status = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, id, models.MeetingStatusCancelled)
	if err != nil {
		return fmt.Errorf("failed to cancel meeting: %w", err)
	}
	
	return nil
}

func (s *meetingService) StartMeeting(ctx context.Context, meetingID string, hostID int) error {
	query := `
		UPDATE meetings 
		SET status = $2, actual_start = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $1 AND created_by_user_id = $3`
	
	result, err := s.db.ExecContext(ctx, query, meetingID, models.MeetingStatusActive, hostID)
	if err != nil {
		return fmt.Errorf("failed to start meeting: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("meeting not found or user is not the host")
	}
	
	return nil
}

func (s *meetingService) EndMeeting(ctx context.Context, meetingID string) error {
	query := `
		UPDATE meetings 
		SET status = $2, actual_end = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $1 AND status = $3`
	
	_, err := s.db.ExecContext(ctx, query, meetingID, models.MeetingStatusEnded, models.MeetingStatusActive)
	if err != nil {
		return fmt.Errorf("failed to end meeting: %w", err)
	}
	
	return nil
}

func (s *meetingService) ListMeetingsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Meeting, error) {
	meetings := []*models.Meeting{}
	query := `
		SELECT * FROM meetings 
		WHERE client_id = $1 
		ORDER BY scheduled_start DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &meetings, query, clientID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list meetings by client: %w", err)
	}
	
	return meetings, nil
}

func (s *meetingService) ListMeetingsByHost(ctx context.Context, hostID int, limit, offset int) ([]*models.Meeting, error) {
	meetings := []*models.Meeting{}
	query := `
		SELECT * FROM meetings 
		WHERE created_by_user_id = $1 
		ORDER BY scheduled_start DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &meetings, query, hostID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list meetings by host: %w", err)
	}
	
	return meetings, nil
}

func (s *meetingService) GetUpcomingMeetings(ctx context.Context, clientID int, limit int) ([]*models.Meeting, error) {
	meetings := []*models.Meeting{}
	query := `
		SELECT * FROM meetings 
		WHERE client_id = $1 AND scheduled_start > CURRENT_TIMESTAMP 
		AND status IN ($2, $3)
		ORDER BY scheduled_start ASC 
		LIMIT $4`
	
	err := s.db.SelectContext(ctx, &meetings, query, clientID, 
		models.MeetingStatusScheduled, models.MeetingStatusActive, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming meetings: %w", err)
	}
	
	return meetings, nil
}

func (s *meetingService) GetMeetingsByDateRange(ctx context.Context, clientID int, start, end time.Time) ([]*models.Meeting, error) {
	meetings := []*models.Meeting{}
	query := `
		SELECT * FROM meetings 
		WHERE client_id = $1 AND scheduled_start >= $2 AND scheduled_start <= $3
		ORDER BY scheduled_start ASC`
	
	err := s.db.SelectContext(ctx, &meetings, query, clientID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get meetings by date range: %w", err)
	}
	
	return meetings, nil
}

func (s *meetingService) AddParticipant(ctx context.Context, participant *models.MeetingParticipant) error {
	query := `
		INSERT INTO meeting_participants (meeting_id, user_id, email, guest_name, role, status, invited_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, invited_at`
	
	err := s.db.GetContext(ctx, participant, query,
		participant.MeetingID, participant.UserID, participant.Email, participant.GuestName,
		participant.Role, participant.Status, participant.InvitedBy)
	if err != nil {
		return fmt.Errorf("failed to add participant: %w", err)
	}

	return nil
}

func (s *meetingService) RemoveParticipant(ctx context.Context, meetingID int, userID *int, email *string) error {
	var query string
	var args []interface{}

	if userID != nil {
		query = `DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2`
		args = []interface{}{meetingID, *userID}
	} else if email != nil {
		query = `DELETE FROM meeting_participants WHERE meeting_id = $1 AND email = $2`
		args = []interface{}{meetingID, *email}
	} else {
		return fmt.Errorf("either user_id or email must be provided")
	}

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to remove participant: %w", err)
	}
	
	return nil
}

func (s *meetingService) GetMeetingParticipants(ctx context.Context, meetingID int) ([]*models.MeetingParticipant, error) {
	participants := []*models.MeetingParticipant{}
	query := `
		SELECT * FROM meeting_participants 
		WHERE meeting_id = $1 
		ORDER BY invited_at ASC`
	
	err := s.db.SelectContext(ctx, &participants, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting participants: %w", err)
	}
	
	return participants, nil
}

func (s *meetingService) UpdateParticipantStatus(ctx context.Context, meetingID int, userID *int, email *string, status string) error {
	var query string
	var args []interface{}

	if userID != nil {
		query = `UPDATE meeting_participants SET status = $3 WHERE meeting_id = $1 AND user_id = $2`
		args = []interface{}{meetingID, *userID, status}
	} else if email != nil {
		query = `UPDATE meeting_participants SET status = $3 WHERE meeting_id = $1 AND email = $2`
		args = []interface{}{meetingID, *email, status}
	} else {
		return fmt.Errorf("either user_id or email must be provided")
	}

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update participant status: %w", err)
	}
	
	return nil
}

func (s *meetingService) UpdateParticipantRole(ctx context.Context, meetingID int, userID *int, email *string, role string) error {
	var query string
	var args []interface{}

	if userID != nil {
		query = `UPDATE meeting_participants SET role = $3 WHERE meeting_id = $1 AND user_id = $2`
		args = []interface{}{meetingID, *userID, role}
	} else if email != nil {
		query = `UPDATE meeting_participants SET role = $3 WHERE meeting_id = $1 AND email = $2`
		args = []interface{}{meetingID, *email, role}
	} else {
		return fmt.Errorf("either user_id or email must be provided")
	}

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update participant role: %w", err)
	}
	
	return nil
}

func (s *meetingService) CreateRecurringMeetings(ctx context.Context, parentMeeting *models.Meeting) ([]*models.Meeting, error) {
	// Recurring meetings not implemented yet - return empty slice
	return []*models.Meeting{}, nil
}

func (s *meetingService) GetRecurringMeetingInstances(ctx context.Context, parentMeetingID int) ([]*models.Meeting, error) {
	// Recurring meetings not implemented yet - return empty slice
	return []*models.Meeting{}, nil
}