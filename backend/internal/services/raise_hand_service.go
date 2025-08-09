package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type RaiseHandService interface {
	// Hand Management
	RaiseHand(ctx context.Context, meetingID int, userID int, message string) (*models.RaiseHand, error)
	LowerHand(ctx context.Context, meetingID int, userID int) error
	AcknowledgeHand(ctx context.Context, meetingID int, userID int, adminID int, response string) error
	
	// Queue Management
	GetRaisedHandsQueue(ctx context.Context, meetingID int) ([]*RaiseHandQueueItem, error)
	GetRaisedHandsCount(ctx context.Context, meetingID int) (int, error)
	GetUserHandStatus(ctx context.Context, meetingID int, userID int) (*UserHandStatus, error)
	
	// Admin Controls
	ClearAllHands(ctx context.Context, meetingID int, adminID int) error
	ClearUserHand(ctx context.Context, meetingID int, userID int, adminID int, reason string) error
	ReorderHandsQueue(ctx context.Context, meetingID int, adminID int, newOrder []int) error
	
	// Hand History and Analytics
	GetHandHistory(ctx context.Context, meetingID int, limit int) ([]*HandHistoryItem, error)
	GetUserHandHistory(ctx context.Context, meetingID int, userID int) ([]*HandHistoryItem, error)
	GetHandAnalytics(ctx context.Context, meetingID int) (*HandAnalytics, error)
	
	// Real-time Updates
	BroadcastHandUpdate(ctx context.Context, update *HandUpdate) error
	GetHandUpdates(ctx context.Context, meetingID int, since time.Time) ([]*HandUpdate, error)
	
	// Auto-lowering Configuration
	SetAutoLowerConfig(ctx context.Context, meetingID int, config *AutoLowerConfig) error
	GetAutoLowerConfig(ctx context.Context, meetingID int) (*AutoLowerConfig, error)
}

// Request/Response types for Raise Hand operations
type RaiseHandQueueItem struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	UserName      string    `json:"user_name"`
	UserEmail     string    `json:"user_email"`
	RaisedAt      time.Time `json:"raised_at"`
	Message       string    `json:"message,omitempty"`
	QueuePosition int       `json:"queue_position"`
	WaitingTime   int       `json:"waiting_time_minutes"`
	IsUrgent      bool      `json:"is_urgent"`
}

type UserHandStatus struct {
	UserID          int        `json:"user_id"`
	MeetingID       int        `json:"meeting_id"`
	IsRaised        bool       `json:"is_raised"`
	RaisedAt        *time.Time `json:"raised_at,omitempty"`
	Message         string     `json:"message,omitempty"`
	QueuePosition   int        `json:"queue_position"`
	WaitingTime     int        `json:"waiting_time_minutes"`
	AcknowledgedAt  *time.Time `json:"acknowledged_at,omitempty"`
	AcknowledgedBy  *int       `json:"acknowledged_by,omitempty"`
	AdminResponse   string     `json:"admin_response,omitempty"`
}

type HandHistoryItem struct {
	ID              int        `json:"id"`
	UserID          int        `json:"user_id"`
	UserName        string     `json:"user_name"`
	Action          string     `json:"action"` // raised, lowered, acknowledged, cleared
	RaisedAt        time.Time  `json:"raised_at"`
	LoweredAt       *time.Time `json:"lowered_at,omitempty"`
	AcknowledgedAt  *time.Time `json:"acknowledged_at,omitempty"`
	AcknowledgedBy  *int       `json:"acknowledged_by,omitempty"`
	AdminName       string     `json:"admin_name,omitempty"`
	Duration        int        `json:"duration_minutes"`
	Message         string     `json:"message,omitempty"`
	AdminResponse   string     `json:"admin_response,omitempty"`
	WasAutoLowered  bool       `json:"was_auto_lowered"`
}

type HandAnalytics struct {
	MeetingID             int     `json:"meeting_id"`
	TotalHandsRaised      int     `json:"total_hands_raised"`
	CurrentlyRaised       int     `json:"currently_raised"`
	AverageWaitTime       float64 `json:"average_wait_time_minutes"`
	MedianWaitTime        float64 `json:"median_wait_time_minutes"`
	LongestWaitTime       int     `json:"longest_wait_time_minutes"`
	TotalAcknowledged     int     `json:"total_acknowledged"`
	AcknowledgmentRate    float64 `json:"acknowledgment_rate"`
	AutoLoweredCount      int     `json:"auto_lowered_count"`
	MostActiveUsers       []*UserHandActivitySummary `json:"most_active_users"`
	HandsByTimeOfDay      map[string]int             `json:"hands_by_time_of_day"`
}

type UserHandActivitySummary struct {
	UserID      int     `json:"user_id"`
	UserName    string  `json:"user_name"`
	HandsRaised int     `json:"hands_raised"`
	AvgWaitTime float64 `json:"avg_wait_time_minutes"`
}

type HandUpdate struct {
	ID            int       `json:"id"`
	MeetingID     int       `json:"meeting_id"`
	UserID        int       `json:"user_id"`
	Action        string    `json:"action"` // raised, lowered, acknowledged, cleared, reordered
	Message       string    `json:"message,omitempty"`
	QueuePosition int       `json:"queue_position,omitempty"`
	AdminID       *int      `json:"admin_id,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
	UserName      string    `json:"user_name,omitempty"`
	AdminName     string    `json:"admin_name,omitempty"`
}

type AutoLowerConfig struct {
	MeetingID                int  `json:"meeting_id"`
	AutoLowerAfterAcknowledgment bool `json:"auto_lower_after_acknowledgment"`
	AutoLowerTimeoutMinutes  int  `json:"auto_lower_timeout_minutes"`
	AutoLowerAfterSpeaking   bool `json:"auto_lower_after_speaking"`
	MaxQueueSize             int  `json:"max_queue_size"`
	NotifyOnLongWait         bool `json:"notify_on_long_wait"`
	LongWaitThresholdMinutes int  `json:"long_wait_threshold_minutes"`
}

type raiseHandService struct {
	db *database.DB
}

func NewRaiseHandService(db *database.DB) RaiseHandService {
	return &raiseHandService{
		db: db,
	}
}

// ============================================================================
// HAND MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) RaiseHand(ctx context.Context, meetingID int, userID int, message string) (*models.RaiseHand, error) {
	// Check if user already has hand raised
	var existingID int
	checkQuery := `SELECT id FROM raise_hands WHERE meeting_id = $1 AND user_id = $2 AND is_raised = true`
	err := s.db.GetContext(ctx, &existingID, checkQuery, meetingID, userID)
	if err == nil {
		return nil, fmt.Errorf("user already has hand raised")
	}

	// Check queue size limits
	config, err := s.GetAutoLowerConfig(ctx, meetingID)
	if err == nil && config != nil && config.MaxQueueSize > 0 {
		count, err := s.GetRaisedHandsCount(ctx, meetingID)
		if err == nil && count >= config.MaxQueueSize {
			return nil, fmt.Errorf("hand queue is full (max %d hands)", config.MaxQueueSize)
		}
	}

	// Create new raised hand record
	raiseHand := &models.RaiseHand{
		MeetingID:     meetingID,
		UserID:        userID,
		RaisedAt:      time.Now(),
		AutoLowered:   false,
	}

	query := `
		INSERT INTO raise_hands (meeting_id, user_id, raised_at, lowered_at, acknowledged_at, 
			acknowledged_by, lowered_by, auto_lowered, queue_position, created_at)
		VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, false, NULL, CURRENT_TIMESTAMP)
		RETURNING id, created_at`

	err = s.db.GetContext(ctx, raiseHand, query,
		raiseHand.MeetingID, raiseHand.UserID, raiseHand.RaisedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to raise hand: %w", err)
	}

	// Broadcast hand update
	update := &HandUpdate{
		ID:        raiseHand.ID,
		MeetingID: meetingID,
		UserID:    userID,
		Action:    "raised",
		Message:   message,
		Timestamp: raiseHand.RaisedAt,
	}
	
	// Get queue position
	position, err := s.getHandQueuePosition(ctx, meetingID, userID)
	if err == nil {
		update.QueuePosition = position
	}

	s.BroadcastHandUpdate(ctx, update)

	return raiseHand, nil
}

func (s *raiseHandService) LowerHand(ctx context.Context, meetingID int, userID int) error {
	now := time.Now()
	
	query := `
		UPDATE raise_hands 
		SET is_raised = false, lowered_at = $1, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $2 AND user_id = $3 AND is_raised = true`

	result, err := s.db.ExecContext(ctx, query, now, meetingID, userID)
	if err != nil {
		return fmt.Errorf("failed to lower hand: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no raised hand found for user")
	}

	// Broadcast hand update
	update := &HandUpdate{
		MeetingID: meetingID,
		UserID:    userID,
		Action:    "lowered",
		Timestamp: now,
	}
	
	s.BroadcastHandUpdate(ctx, update)

	return nil
}

func (s *raiseHandService) AcknowledgeHand(ctx context.Context, meetingID int, userID int, adminID int, response string) error {
	now := time.Now()
	
	query := `
		UPDATE raise_hands 
		SET acknowledged_at = $1, acknowledged_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $4 AND user_id = $5 AND is_raised = true`

	result, err := s.db.ExecContext(ctx, query, now, adminID, response, meetingID, userID)
	if err != nil {
		return fmt.Errorf("failed to acknowledge hand: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no raised hand found for user")
	}

	// Check if auto-lower is enabled
	config, err := s.GetAutoLowerConfig(ctx, meetingID)
	if err == nil && config != nil && config.AutoLowerAfterAcknowledgment {
		// Auto-lower the hand
		s.LowerHand(ctx, meetingID, userID)
	}

	// Broadcast hand update
	update := &HandUpdate{
		MeetingID: meetingID,
		UserID:    userID,
		Action:    "acknowledged",
		AdminID:   &adminID,
		Timestamp: now,
	}
	
	s.BroadcastHandUpdate(ctx, update)

	return nil
}

// ============================================================================
// QUEUE MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) GetRaisedHandsQueue(ctx context.Context, meetingID int) ([]*RaiseHandQueueItem, error) {
	var queue []*RaiseHandQueueItem
	
	query := `
		SELECT 
			rh.id, rh.user_id, rh.raised_at, COALESCE(rh.message, '') as message,
			rh.is_urgent,
			u.first_name || ' ' || u.last_name as user_name, 
			u.email as user_email,
			EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - rh.raised_at))/60 as waiting_time,
			ROW_NUMBER() OVER (ORDER BY 
				CASE WHEN rh.is_urgent THEN 0 ELSE 1 END,
				rh.raised_at ASC
			) as queue_position
		FROM raise_hands rh
		JOIN users u ON rh.user_id = u.id
		WHERE rh.meeting_id = $1 AND rh.is_raised = true
		ORDER BY 
			CASE WHEN rh.is_urgent THEN 0 ELSE 1 END,
			rh.raised_at ASC`

	err := s.db.SelectContext(ctx, &queue, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get raised hands queue: %w", err)
	}

	return queue, nil
}

func (s *raiseHandService) GetRaisedHandsCount(ctx context.Context, meetingID int) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM raise_hands WHERE meeting_id = $1 AND is_raised = true`
	
	err := s.db.GetContext(ctx, &count, query, meetingID)
	if err != nil {
		return 0, fmt.Errorf("failed to get raised hands count: %w", err)
	}

	return count, nil
}

func (s *raiseHandService) GetUserHandStatus(ctx context.Context, meetingID int, userID int) (*UserHandStatus, error) {
	status := &UserHandStatus{
		UserID:    userID,
		MeetingID: meetingID,
		IsRaised:  false,
	}

	query := `
		SELECT rh.raised_at, rh.message, rh.acknowledged_at, rh.acknowledged_by, 
			   rh.admin_response,
			   EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - rh.raised_at))/60 as waiting_time
		FROM raise_hands rh
		WHERE rh.meeting_id = $1 AND rh.user_id = $2 AND rh.is_raised = true`

	var message, adminResponse sql.NullString
	var raisedAt time.Time
	var acknowledgedAt sql.NullTime
	var acknowledgedBy sql.NullInt64
	var waitingTime float64

	err := s.db.QueryRowContext(ctx, query, meetingID, userID).Scan(
		&raisedAt, &message, &acknowledgedAt, &acknowledgedBy, &adminResponse, &waitingTime)
	
	if err != nil {
		// No raised hand found - return default status
		return status, nil
	}

	// Hand is raised
	status.IsRaised = true
	status.RaisedAt = &raisedAt
	status.WaitingTime = int(waitingTime)
	
	if message.Valid {
		status.Message = message.String
	}
	if acknowledgedAt.Valid {
		status.AcknowledgedAt = &acknowledgedAt.Time
	}
	if acknowledgedBy.Valid {
		adminID := int(acknowledgedBy.Int64)
		status.AcknowledgedBy = &adminID
	}
	if adminResponse.Valid {
		status.AdminResponse = adminResponse.String
	}

	// Get queue position
	position, err := s.getHandQueuePosition(ctx, meetingID, userID)
	if err == nil {
		status.QueuePosition = position
	}

	return status, nil
}

func (s *raiseHandService) getHandQueuePosition(ctx context.Context, meetingID int, userID int) (int, error) {
	var position int
	query := `
		SELECT queue_position FROM (
			SELECT user_id, 
				ROW_NUMBER() OVER (ORDER BY 
					CASE WHEN is_urgent THEN 0 ELSE 1 END,
					raised_at ASC
				) as queue_position
			FROM raise_hands
			WHERE meeting_id = $1 AND is_raised = true
		) t WHERE user_id = $2`

	err := s.db.GetContext(ctx, &position, query, meetingID, userID)
	if err != nil {
		return 0, err
	}

	return position, nil
}

// ============================================================================
// ADMIN CONTROLS IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) ClearAllHands(ctx context.Context, meetingID int, adminID int) error {
	now := time.Now()
	
	query := `
		UPDATE raise_hands 
		SET is_raised = false, lowered_at = $1, 
			admin_response = 'Cleared by admin', updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $2 AND is_raised = true`

	result, err := s.db.ExecContext(ctx, query, now, meetingID)
	if err != nil {
		return fmt.Errorf("failed to clear all hands: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	// Broadcast hand update for clearing all hands
	update := &HandUpdate{
		MeetingID: meetingID,
		Action:    "cleared_all",
		AdminID:   &adminID,
		Timestamp: now,
	}
	
	s.BroadcastHandUpdate(ctx, update)

	fmt.Printf("Cleared %d raised hands by admin %d\n", rowsAffected, adminID)
	return nil
}

func (s *raiseHandService) ClearUserHand(ctx context.Context, meetingID int, userID int, adminID int, reason string) error {
	now := time.Now()
	
	query := `
		UPDATE raise_hands 
		SET is_raised = false, lowered_at = $1, admin_response = $2, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $3 AND user_id = $4 AND is_raised = true`

	result, err := s.db.ExecContext(ctx, query, now, reason, meetingID, userID)
	if err != nil {
		return fmt.Errorf("failed to clear user hand: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no raised hand found for user")
	}

	// Broadcast hand update
	update := &HandUpdate{
		MeetingID: meetingID,
		UserID:    userID,
		Action:    "cleared",
		AdminID:   &adminID,
		Timestamp: now,
	}
	
	s.BroadcastHandUpdate(ctx, update)

	return nil
}

func (s *raiseHandService) ReorderHandsQueue(ctx context.Context, meetingID int, adminID int, newOrder []int) error {
	// This would implement queue reordering functionality
	// For now, return not implemented
	return fmt.Errorf("queue reordering not yet implemented")
}

// ============================================================================
// HAND HISTORY AND ANALYTICS IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) GetHandHistory(ctx context.Context, meetingID int, limit int) ([]*HandHistoryItem, error) {
	if limit <= 0 {
		limit = 50
	}

	var history []*HandHistoryItem
	
	query := `
		SELECT 
			rh.id, rh.user_id, rh.raised_at, rh.lowered_at, rh.acknowledged_at,
			rh.acknowledged_by, rh.admin_response, 
			COALESCE(rh.message, '') as message,
			u.first_name || ' ' || u.last_name as user_name,
			COALESCE(a.first_name || ' ' || a.last_name, '') as admin_name,
			COALESCE(EXTRACT(EPOCH FROM (COALESCE(rh.lowered_at, rh.acknowledged_at, CURRENT_TIMESTAMP) - rh.raised_at))/60, 0) as duration,
			CASE 
				WHEN rh.lowered_at IS NOT NULL AND rh.acknowledged_at IS NULL THEN 'lowered'
				WHEN rh.acknowledged_at IS NOT NULL THEN 'acknowledged'
				WHEN rh.is_raised = true THEN 'raised'
				ELSE 'cleared'
			END as action,
			false as was_auto_lowered
		FROM raise_hands rh
		JOIN users u ON rh.user_id = u.id
		LEFT JOIN users a ON rh.acknowledged_by = a.id
		WHERE rh.meeting_id = $1
		ORDER BY rh.raised_at DESC
		LIMIT $2`

	err := s.db.SelectContext(ctx, &history, query, meetingID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get hand history: %w", err)
	}

	return history, nil
}

func (s *raiseHandService) GetUserHandHistory(ctx context.Context, meetingID int, userID int) ([]*HandHistoryItem, error) {
	var history []*HandHistoryItem
	
	query := `
		SELECT 
			rh.id, rh.user_id, rh.raised_at, rh.lowered_at, rh.acknowledged_at,
			rh.acknowledged_by, rh.admin_response,
			COALESCE(rh.message, '') as message,
			u.first_name || ' ' || u.last_name as user_name,
			COALESCE(a.first_name || ' ' || a.last_name, '') as admin_name,
			COALESCE(EXTRACT(EPOCH FROM (COALESCE(rh.lowered_at, rh.acknowledged_at, CURRENT_TIMESTAMP) - rh.raised_at))/60, 0) as duration,
			CASE 
				WHEN rh.lowered_at IS NOT NULL AND rh.acknowledged_at IS NULL THEN 'lowered'
				WHEN rh.acknowledged_at IS NOT NULL THEN 'acknowledged'
				WHEN rh.is_raised = true THEN 'raised'
				ELSE 'cleared'
			END as action,
			false as was_auto_lowered
		FROM raise_hands rh
		JOIN users u ON rh.user_id = u.id
		LEFT JOIN users a ON rh.acknowledged_by = a.id
		WHERE rh.meeting_id = $1 AND rh.user_id = $2
		ORDER BY rh.raised_at DESC`

	err := s.db.SelectContext(ctx, &history, query, meetingID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user hand history: %w", err)
	}

	return history, nil
}

func (s *raiseHandService) GetHandAnalytics(ctx context.Context, meetingID int) (*HandAnalytics, error) {
	analytics := &HandAnalytics{
		MeetingID: meetingID,
	}

	// Get basic counts and averages
	statsQuery := `
		SELECT 
			COUNT(*) as total_hands_raised,
			COUNT(*) FILTER (WHERE is_raised = true) as currently_raised,
			COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) as total_acknowledged,
			COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(lowered_at, acknowledged_at, CURRENT_TIMESTAMP) - raised_at))/60), 0) as avg_wait_time,
			COALESCE(MAX(EXTRACT(EPOCH FROM (COALESCE(lowered_at, acknowledged_at, CURRENT_TIMESTAMP) - raised_at))/60), 0) as longest_wait_time
		FROM raise_hands
		WHERE meeting_id = $1`

	var totalAcknowledged int
	err := s.db.QueryRowContext(ctx, statsQuery, meetingID).Scan(
		&analytics.TotalHandsRaised, &analytics.CurrentlyRaised, &totalAcknowledged,
		&analytics.AverageWaitTime, &analytics.LongestWaitTime)
	
	if err != nil {
		return nil, fmt.Errorf("failed to get hand analytics: %w", err)
	}

	analytics.TotalAcknowledged = totalAcknowledged
	
	// Calculate acknowledgment rate
	if analytics.TotalHandsRaised > 0 {
		analytics.AcknowledgmentRate = float64(analytics.TotalAcknowledged) / float64(analytics.TotalHandsRaised) * 100
	}

	// Get most active users
	usersQuery := `
		SELECT 
			rh.user_id, 
			u.first_name || ' ' || u.last_name as user_name,
			COUNT(*) as hands_raised,
			COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(rh.lowered_at, rh.acknowledged_at, CURRENT_TIMESTAMP) - rh.raised_at))/60), 0) as avg_wait_time
		FROM raise_hands rh
		JOIN users u ON rh.user_id = u.id
		WHERE rh.meeting_id = $1
		GROUP BY rh.user_id, u.first_name, u.last_name
		ORDER BY hands_raised DESC
		LIMIT 10`

	err = s.db.SelectContext(ctx, &analytics.MostActiveUsers, usersQuery, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get most active users: %w", err)
	}

	// Initialize time distribution map
	analytics.HandsByTimeOfDay = make(map[string]int)

	return analytics, nil
}

// ============================================================================
// REAL-TIME UPDATES IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) BroadcastHandUpdate(ctx context.Context, update *HandUpdate) error {
	// This would integrate with WebSocket system to broadcast updates
	// For now, just log the update
	fmt.Printf("Broadcasting hand update: %+v\n", update)
	return nil
}

func (s *raiseHandService) GetHandUpdates(ctx context.Context, meetingID int, since time.Time) ([]*HandUpdate, error) {
	// This would integrate with WebSocket system to get recent updates
	// For now, return empty array
	return []*HandUpdate{}, nil
}

// ============================================================================
// AUTO-LOWERING CONFIGURATION IMPLEMENTATION
// ============================================================================

func (s *raiseHandService) SetAutoLowerConfig(ctx context.Context, meetingID int, config *AutoLowerConfig) error {
	// Store configuration in meeting settings or separate table
	// For now, just return success
	return nil
}

func (s *raiseHandService) GetAutoLowerConfig(ctx context.Context, meetingID int) (*AutoLowerConfig, error) {
	// Get configuration from meeting settings or separate table
	// Return default configuration for now
	config := &AutoLowerConfig{
		MeetingID:                    meetingID,
		AutoLowerAfterAcknowledgment: true,
		AutoLowerTimeoutMinutes:     15,
		AutoLowerAfterSpeaking:      false,
		MaxQueueSize:                20,
		NotifyOnLongWait:            true,
		LongWaitThresholdMinutes:    10,
	}

	return config, nil
}