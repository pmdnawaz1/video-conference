package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"

	"github.com/gorilla/websocket"
)

// NotificationService handles real-time notifications with persistence and retry logic
type NotificationService interface {
	// Client Management
	RegisterClient(userID int, conn *websocket.Conn)
	UnregisterClient(userID int)
	GetConnectedUsers() []int
	IsUserConnected(userID int) bool

	// Notification Sending
	SendNotification(ctx context.Context, userID int, messageType string, payload interface{}) error
	SendToMultipleUsers(ctx context.Context, userIDs []int, messageType string, payload interface{}) error
	BroadcastNotification(ctx context.Context, messageType string, payload interface{})
	BroadcastToMeeting(ctx context.Context, meetingID int, messageType string, payload interface{}) error

	// Enhanced Notification Methods with Persistence
	SendPersistentNotification(ctx context.Context, userID int, notification *PersistentNotification) error
	SendCriticalNotification(ctx context.Context, userID int, notification *PersistentNotification) error
	QueueNotification(ctx context.Context, userID int, notification *PersistentNotification) error
	ProcessNotificationQueue(ctx context.Context) error
	RetryFailedNotifications(ctx context.Context) error

	// Meeting-specific Notifications
	NotifyMeetingStart(ctx context.Context, meetingID int, meetingTitle string) error
	NotifyMeetingEnd(ctx context.Context, meetingID int, reason string) error
	NotifyParticipantJoined(ctx context.Context, meetingID int, userName string) error
	NotifyParticipantLeft(ctx context.Context, meetingID int, userName string) error
	NotifyPermissionRequest(ctx context.Context, adminUserIDs []int, request *PermissionRequestNotification) error
	NotifyPermissionGranted(ctx context.Context, userID int, permission string) error
	NotifyHandRaised(ctx context.Context, adminUserIDs []int, handRaise *HandRaiseNotification) error

	// System Notifications
	NotifyInvitation(ctx context.Context, userID int, invitation *InvitationNotification) error
	NotifyMeetingReminder(ctx context.Context, userID int, reminder *MeetingReminderNotification) error
	NotifySystemAlert(ctx context.Context, userIDs []int, alert *SystemAlertNotification) error

	// Notification Management
	GetUserNotifications(ctx context.Context, userID int, limit, offset int) ([]*models.Notification, error)
	MarkNotificationAsRead(ctx context.Context, userID, notificationID int) error
	DeleteNotification(ctx context.Context, userID, notificationID int) error
	GetUnreadCount(ctx context.Context, userID int) (int, error)
}

type notificationService struct {
	db         *database.DB
	emailSvc   *EmailService           // Email service for email fallback
	clients    map[int]*websocket.Conn // Map of user ID to WebSocket connection
	mu         sync.RWMutex
	meetings   map[int][]int           // Map of meeting ID to user IDs in that meeting
	meetingMu  sync.RWMutex
	queue      chan *NotificationQueueItem // Queue for processing notifications
	queueMu    sync.RWMutex
}

// Notification payload structures
type PermissionRequestNotification struct {
	UserID      int    `json:"user_id"`
	UserName    string `json:"user_name"`
	MeetingID   int    `json:"meeting_id"`
	MeetingTitle string `json:"meeting_title"`
	Permission  string `json:"permission"`
	Message     string `json:"message,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

type HandRaiseNotification struct {
	UserID       int    `json:"user_id"`
	UserName     string `json:"user_name"`
	MeetingID    int    `json:"meeting_id"`
	MeetingTitle string `json:"meeting_title"`
	Message      string `json:"message,omitempty"`
	QueuePosition int   `json:"queue_position"`
	Timestamp    time.Time `json:"timestamp"`
}

type InvitationNotification struct {
	InviterName    string    `json:"inviter_name"`
	MeetingTitle   string    `json:"meeting_title"`
	MeetingID      string    `json:"meeting_id"`
	ScheduledStart time.Time `json:"scheduled_start"`
	JoinURL        string    `json:"join_url"`
	Message        string    `json:"message,omitempty"`
}

type MeetingReminderNotification struct {
	MeetingTitle   string    `json:"meeting_title"`
	MeetingID      string    `json:"meeting_id"`
	ScheduledStart time.Time `json:"scheduled_start"`
	TimeUntilStart int       `json:"time_until_start_minutes"`
	JoinURL        string    `json:"join_url"`
	ReminderType   string    `json:"reminder_type"` // "15min", "5min", "1min"
}

type SystemAlertNotification struct {
	Title       string `json:"title"`
	Message     string `json:"message"`
	AlertType   string `json:"alert_type"`   // "info", "warning", "error", "success"
	Priority    string `json:"priority"`     // "low", "medium", "high", "critical"
	ActionURL   string `json:"action_url,omitempty"`
	ActionLabel string `json:"action_label,omitempty"`
}

// PersistentNotification represents a notification that should be stored in the database
type PersistentNotification struct {
	Type           string      `json:"type"`
	Title          string      `json:"title"`
	Message        string      `json:"message"`
	Data           interface{} `json:"data,omitempty"`
	Priority       string      `json:"priority"`       // low, medium, high, critical
	Category       string      `json:"category"`       // general, meeting, system, security
	DeliveryMethod string      `json:"delivery_method"` // websocket, email, sms, push
	ExpiresAt      *time.Time  `json:"expires_at,omitempty"`
	MaxRetries     int         `json:"max_retries"`
}

// NotificationQueueItem represents a queued notification for retry
type NotificationQueueItem struct {
	ID             int                     `json:"id" db:"id"`
	NotificationID int                     `json:"notification_id" db:"notification_id"`
	ScheduledAt    time.Time               `json:"scheduled_at" db:"scheduled_at"`
	Status         string                  `json:"status" db:"status"` // pending, processing, completed, failed, cancelled
	AttemptCount   int                     `json:"attempt_count" db:"attempt_count"`
	LastError      *string                 `json:"last_error" db:"last_error"`
	CreatedAt      time.Time               `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time               `json:"updated_at" db:"updated_at"`
	Notification   *PersistentNotification `json:"notification,omitempty"`
}

// Notification delivery constants
const (
	DeliveryMethodWebSocket = "websocket"
	DeliveryMethodEmail     = "email"
	DeliveryMethodSMS       = "sms"
	DeliveryMethodPush      = "push"
)

// Priority constants
const (
	PriorityLow      = "low"
	PriorityMedium   = "medium"
	PriorityHigh     = "high"
	PriorityCritical = "critical"
)

// Queue status constants
const (
	QueueStatusPending    = "pending"
	QueueStatusProcessing = "processing"
	QueueStatusCompleted  = "completed"
	QueueStatusFailed     = "failed"
	QueueStatusCancelled  = "cancelled"
)

func NewNotificationService(db *database.DB) NotificationService {
	svc := &notificationService{
		db:       db,
		clients:  make(map[int]*websocket.Conn),
		meetings: make(map[int][]int),
		queue:    make(chan *NotificationQueueItem, 1000),
	}
	
	// Start queue processor
	go svc.processQueue()
	
	// Start retry processor (runs every 5 minutes)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			svc.RetryFailedNotifications(context.Background())
		}
	}()
	
	return svc
}

// Set email service for fallback notifications
func (s *notificationService) SetEmailService(emailSvc *EmailService) {
	s.emailSvc = emailSvc
}

// ============================================================================
// CLIENT MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *notificationService) RegisterClient(userID int, conn *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clients[userID] = conn
	log.Printf("WebSocket client registered for user ID: %d", userID)
}

func (s *notificationService) UnregisterClient(userID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if conn, ok := s.clients[userID]; ok {
		conn.Close()
		delete(s.clients, userID)
		log.Printf("WebSocket client unregistered for user ID: %d", userID)
	}

	// Remove user from all meetings
	s.meetingMu.Lock()
	for meetingID, users := range s.meetings {
		for i, uid := range users {
			if uid == userID {
				s.meetings[meetingID] = append(users[:i], users[i+1:]...)
				break
			}
		}
	}
	s.meetingMu.Unlock()
}

func (s *notificationService) GetConnectedUsers() []int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	users := make([]int, 0, len(s.clients))
	for userID := range s.clients {
		users = append(users, userID)
	}
	return users
}

func (s *notificationService) IsUserConnected(userID int) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, exists := s.clients[userID]
	return exists
}

// ============================================================================
// NOTIFICATION SENDING IMPLEMENTATION
// ============================================================================

func (s *notificationService) SendNotification(ctx context.Context, userID int, messageType string, payload interface{}) error {
	s.mu.RLock()
	conn, ok := s.clients[userID]
	s.mu.RUnlock()

	if !ok {
		log.Printf("No WebSocket client found for user ID: %d", userID)
		return fmt.Errorf("no WebSocket client found for user ID: %d", userID)
	}

	// Construct the notification message
	notification := map[string]interface{}{
		"type":      messageType,
		"payload":   payload,
		"timestamp": time.Now(),
		"id":        fmt.Sprintf("%s_%d_%d", messageType, userID, time.Now().UnixNano()),
	}

	err := conn.WriteJSON(notification)
	if err != nil {
		log.Printf("Failed to send notification to user %d: %v", userID, err)
		// Consider unregistering client if error is due to broken connection
		go s.UnregisterClient(userID) // Unregister in a goroutine to avoid deadlock
		return fmt.Errorf("failed to send notification: %w", err)
	}

	log.Printf("Notification sent to user %d (Type: %s)", userID, messageType)
	return nil
}

func (s *notificationService) SendToMultipleUsers(ctx context.Context, userIDs []int, messageType string, payload interface{}) error {
	var errors []error
	
	for _, userID := range userIDs {
		if err := s.SendNotification(ctx, userID, messageType, payload); err != nil {
			errors = append(errors, fmt.Errorf("failed to send to user %d: %w", userID, err))
		}
	}
	
	if len(errors) > 0 {
		return fmt.Errorf("failed to send to %d users out of %d", len(errors), len(userIDs))
	}
	
	return nil
}

func (s *notificationService) BroadcastNotification(ctx context.Context, messageType string, payload interface{}) {
	s.mu.RLock()
	clients := make(map[int]*websocket.Conn, len(s.clients))
	for k, v := range s.clients {
		clients[k] = v
	}
	s.mu.RUnlock()

	notification := map[string]interface{}{
		"type":      messageType,
		"payload":   payload,
		"timestamp": time.Now(),
		"id":        fmt.Sprintf("%s_broadcast_%d", messageType, time.Now().UnixNano()),
	}

	for userID, conn := range clients {
		err := conn.WriteJSON(notification)
		if err != nil {
			log.Printf("Failed to broadcast notification to user %d: %v", userID, err)
			// Consider unregistering client if error is due to broken connection
			go s.UnregisterClient(userID) // Unregister in a goroutine to avoid deadlock
		}
	}
	log.Printf("Notification broadcasted (Type: %s) to %d clients", messageType, len(clients))
}

func (s *notificationService) BroadcastToMeeting(ctx context.Context, meetingID int, messageType string, payload interface{}) error {
	s.meetingMu.RLock()
	users, exists := s.meetings[meetingID]
	s.meetingMu.RUnlock()
	
	if !exists || len(users) == 0 {
		return fmt.Errorf("no users found in meeting %d", meetingID)
	}
	
	return s.SendToMultipleUsers(ctx, users, messageType, payload)
}

// ============================================================================
// MEETING-SPECIFIC NOTIFICATIONS IMPLEMENTATION
// ============================================================================

func (s *notificationService) NotifyMeetingStart(ctx context.Context, meetingID int, meetingTitle string) error {
	payload := map[string]interface{}{
		"meeting_id":    meetingID,
		"meeting_title": meetingTitle,
		"message":       fmt.Sprintf("Meeting '%s' has started", meetingTitle),
	}
	
	return s.BroadcastToMeeting(ctx, meetingID, "meeting_started", payload)
}

func (s *notificationService) NotifyMeetingEnd(ctx context.Context, meetingID int, reason string) error {
	payload := map[string]interface{}{
		"meeting_id": meetingID,
		"reason":     reason,
		"message":    fmt.Sprintf("Meeting has ended: %s", reason),
	}
	
	err := s.BroadcastToMeeting(ctx, meetingID, "meeting_ended", payload)
	
	// Remove meeting from tracking
	s.meetingMu.Lock()
	delete(s.meetings, meetingID)
	s.meetingMu.Unlock()
	
	return err
}

func (s *notificationService) NotifyParticipantJoined(ctx context.Context, meetingID int, userName string) error {
	payload := map[string]interface{}{
		"meeting_id": meetingID,
		"user_name":  userName,
		"message":    fmt.Sprintf("%s joined the meeting", userName),
	}
	
	return s.BroadcastToMeeting(ctx, meetingID, "participant_joined", payload)
}

func (s *notificationService) NotifyParticipantLeft(ctx context.Context, meetingID int, userName string) error {
	payload := map[string]interface{}{
		"meeting_id": meetingID,
		"user_name":  userName,
		"message":    fmt.Sprintf("%s left the meeting", userName),
	}
	
	return s.BroadcastToMeeting(ctx, meetingID, "participant_left", payload)
}

func (s *notificationService) NotifyPermissionRequest(ctx context.Context, adminUserIDs []int, request *PermissionRequestNotification) error {
	return s.SendToMultipleUsers(ctx, adminUserIDs, "permission_request", request)
}

func (s *notificationService) NotifyPermissionGranted(ctx context.Context, userID int, permission string) error {
	payload := map[string]interface{}{
		"permission": permission,
		"message":    fmt.Sprintf("Your %s permission has been granted", permission),
	}
	
	return s.SendNotification(ctx, userID, "permission_granted", payload)
}

func (s *notificationService) NotifyHandRaised(ctx context.Context, adminUserIDs []int, handRaise *HandRaiseNotification) error {
	return s.SendToMultipleUsers(ctx, adminUserIDs, "hand_raised", handRaise)
}

// ============================================================================
// SYSTEM NOTIFICATIONS IMPLEMENTATION
// ============================================================================

func (s *notificationService) NotifyInvitation(ctx context.Context, userID int, invitation *InvitationNotification) error {
	return s.SendNotification(ctx, userID, "meeting_invitation", invitation)
}

func (s *notificationService) NotifyMeetingReminder(ctx context.Context, userID int, reminder *MeetingReminderNotification) error {
	return s.SendNotification(ctx, userID, "meeting_reminder", reminder)
}

func (s *notificationService) NotifySystemAlert(ctx context.Context, userIDs []int, alert *SystemAlertNotification) error {
	return s.SendToMultipleUsers(ctx, userIDs, "system_alert", alert)
}

// ============================================================================
// HELPER METHODS
// ============================================================================

// AddUserToMeeting adds a user to a meeting's notification list
func (s *notificationService) AddUserToMeeting(meetingID int, userID int) {
	s.meetingMu.Lock()
	defer s.meetingMu.Unlock()
	
	if users, exists := s.meetings[meetingID]; exists {
		// Check if user is already in the meeting
		for _, uid := range users {
			if uid == userID {
				return
			}
		}
		s.meetings[meetingID] = append(users, userID)
	} else {
		s.meetings[meetingID] = []int{userID}
	}
	
	log.Printf("User %d added to meeting %d notifications", userID, meetingID)
}

// RemoveUserFromMeeting removes a user from a meeting's notification list
func (s *notificationService) RemoveUserFromMeeting(meetingID int, userID int) {
	s.meetingMu.Lock()
	defer s.meetingMu.Unlock()
	
	if users, exists := s.meetings[meetingID]; exists {
		for i, uid := range users {
			if uid == userID {
				s.meetings[meetingID] = append(users[:i], users[i+1:]...)
				log.Printf("User %d removed from meeting %d notifications", userID, meetingID)
				return
			}
		}
	}
}

// GetMeetingUsers returns all users in a meeting
func (s *notificationService) GetMeetingUsers(meetingID int) []int {
	s.meetingMu.RLock()
	defer s.meetingMu.RUnlock()
	
	if users, exists := s.meetings[meetingID]; exists {
		// Return a copy to avoid race conditions
		usersCopy := make([]int, len(users))
		copy(usersCopy, users)
		return usersCopy
	}
	
	return []int{}
}

// ============================================================================
// ENHANCED NOTIFICATION METHODS WITH PERSISTENCE AND RETRY LOGIC
// ============================================================================

// SendPersistentNotification sends and stores notification in database with retry capability
func (s *notificationService) SendPersistentNotification(ctx context.Context, userID int, notification *PersistentNotification) error {
	// Set defaults
	if notification.Priority == "" {
		notification.Priority = PriorityMedium
	}
	if notification.Category == "" {
		notification.Category = "general"
	}
	if notification.DeliveryMethod == "" {
		notification.DeliveryMethod = DeliveryMethodWebSocket
	}
	if notification.MaxRetries == 0 {
		notification.MaxRetries = 3
	}

	// Store notification in database
	notificationID, err := s.storeNotification(ctx, userID, notification)
	if err != nil {
		log.Printf("Failed to store notification for user %d: %v", userID, err)
		return err
	}

	// Try to send real-time notification first
	err = s.SendNotification(ctx, userID, notification.Type, notification.Data)
	if err == nil {
		// Mark as delivered if successful
		s.markNotificationDelivered(ctx, notificationID)
		return nil
	}

	// If WebSocket delivery failed, queue for retry
	return s.queueNotificationForRetry(ctx, notificationID, notification)
}

// SendCriticalNotification sends critical notifications with multiple delivery methods
func (s *notificationService) SendCriticalNotification(ctx context.Context, userID int, notification *PersistentNotification) error {
	notification.Priority = PriorityCritical
	if notification.MaxRetries == 0 {
		notification.MaxRetries = 5 // More retries for critical notifications
	}

	// Store notification
	notificationID, err := s.storeNotification(ctx, userID, notification)
	if err != nil {
		return err
	}

	// Try WebSocket first
	wsErr := s.SendNotification(ctx, userID, notification.Type, notification.Data)
	
	// For critical notifications, also try email fallback if user is offline
	if wsErr != nil && !s.IsUserConnected(userID) && s.emailSvc != nil {
		emailErr := s.sendEmailFallback(ctx, userID, notification)
		if emailErr == nil {
			s.markNotificationDelivered(ctx, notificationID)
			log.Printf("Critical notification %d delivered via email fallback to user %d", notificationID, userID)
			return nil
		}
		log.Printf("Email fallback failed for critical notification: %v", emailErr)
	}

	if wsErr == nil {
		s.markNotificationDelivered(ctx, notificationID)
		return nil
	}

	// Queue for aggressive retry
	return s.queueNotificationForRetry(ctx, notificationID, notification)
}

// QueueNotification adds notification to queue for delayed delivery
func (s *notificationService) QueueNotification(ctx context.Context, userID int, notification *PersistentNotification) error {
	notificationID, err := s.storeNotification(ctx, userID, notification)
	if err != nil {
		return err
	}

	return s.queueNotificationForRetry(ctx, notificationID, notification)
}

// ProcessNotificationQueue processes pending notifications in the queue
func (s *notificationService) ProcessNotificationQueue(ctx context.Context) error {
	query := `
		SELECT nq.id, nq.notification_id, nq.scheduled_at, nq.status, nq.attempt_count, nq.last_error,
		       n.user_id, n.type, n.title, n.message, n.data, n.priority, n.category, n.delivery_method, n.max_retries
		FROM notification_queue nq
		JOIN notifications n ON nq.notification_id = n.id
		WHERE nq.status = $1 AND nq.scheduled_at <= CURRENT_TIMESTAMP
		ORDER BY n.priority = 'critical' DESC, nq.scheduled_at ASC
		LIMIT 100`

	rows, err := s.db.QueryContext(ctx, query, QueueStatusPending)
	if err != nil {
		return fmt.Errorf("failed to query notification queue: %w", err)
	}
	defer rows.Close()

	var processed int
	for rows.Next() {
		var item NotificationQueueItem
		var userID int
		var notification PersistentNotification
		var dataStr *string

		err := rows.Scan(&item.ID, &item.NotificationID, &item.ScheduledAt, &item.Status,
			&item.AttemptCount, &item.LastError, &userID, &notification.Type, &notification.Title,
			&notification.Message, &dataStr, &notification.Priority, &notification.Category,
			&notification.DeliveryMethod, &notification.MaxRetries)
		if err != nil {
			log.Printf("Failed to scan notification queue item: %v", err)
			continue
		}

		// Parse JSON data if present
		if dataStr != nil {
			var data interface{}
			if err := json.Unmarshal([]byte(*dataStr), &data); err == nil {
				notification.Data = data
			}
		}

		// Process the notification
		err = s.processQueuedNotification(ctx, userID, &item, &notification)
		if err != nil {
			log.Printf("Failed to process queued notification %d: %v", item.ID, err)
		}
		processed++
	}

	log.Printf("Processed %d notifications from queue", processed)
	return nil
}

// RetryFailedNotifications retries notifications that have failed but haven't exceeded max retries
func (s *notificationService) RetryFailedNotifications(ctx context.Context) error {
	query := `
		UPDATE notification_queue 
		SET status = $1, scheduled_at = CURRENT_TIMESTAMP + interval '5 minutes'
		WHERE status = $2 AND attempt_count < (
			SELECT max_retries FROM notifications WHERE id = notification_queue.notification_id
		)
		RETURNING id`

	rows, err := s.db.QueryContext(ctx, query, QueueStatusPending, QueueStatusFailed)
	if err != nil {
		return fmt.Errorf("failed to retry failed notifications: %w", err)
	}
	defer rows.Close()

	var retried int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			retried++
		}
	}

	if retried > 0 {
		log.Printf("Scheduled %d failed notifications for retry", retried)
	}

	return nil
}

// GetUserNotifications retrieves notifications for a user with pagination
func (s *notificationService) GetUserNotifications(ctx context.Context, userID int, limit, offset int) ([]*models.Notification, error) {
	query := `
		SELECT id, user_id, type, title, message, data, is_read, created_at, read_at
		FROM notifications 
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3`

	rows, err := s.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user notifications: %w", err)
	}
	defer rows.Close()

	var notifications []*models.Notification
	for rows.Next() {
		notification := &models.Notification{}
		err := rows.Scan(&notification.ID, &notification.UserID, &notification.Type,
			&notification.Title, &notification.Message, &notification.Data,
			&notification.IsRead, &notification.CreatedAt, &notification.ReadAt)
		if err != nil {
			log.Printf("Failed to scan notification: %v", err)
			continue
		}
		notifications = append(notifications, notification)
	}

	return notifications, nil
}

// MarkNotificationAsRead marks a notification as read
func (s *notificationService) MarkNotificationAsRead(ctx context.Context, userID, notificationID int) error {
	query := `UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP 
	          WHERE id = $1 AND user_id = $2`
	
	result, err := s.db.ExecContext(ctx, query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("notification not found or access denied")
	}

	return nil
}

// DeleteNotification deletes a notification
func (s *notificationService) DeleteNotification(ctx context.Context, userID, notificationID int) error {
	query := `DELETE FROM notifications WHERE id = $1 AND user_id = $2`
	
	result, err := s.db.ExecContext(ctx, query, notificationID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("notification not found or access denied")
	}

	return nil
}

// GetUnreadCount gets the count of unread notifications for a user
func (s *notificationService) GetUnreadCount(ctx context.Context, userID int) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM notifications 
	          WHERE user_id = $1 AND is_read = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`
	
	err := s.db.GetContext(ctx, &count, query, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// ============================================================================
// HELPER METHODS
// ============================================================================

func (s *notificationService) storeNotification(ctx context.Context, userID int, notification *PersistentNotification) (int, error) {
	var dataJSON []byte
	var err error

	if notification.Data != nil {
		dataJSON, err = json.Marshal(notification.Data)
		if err != nil {
			return 0, fmt.Errorf("failed to marshal notification data: %w", err)
		}
	}

	query := `
		INSERT INTO notifications (user_id, type, title, message, data, priority, category, 
		                          delivery_method, max_retries, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id`

	var id int
	err = s.db.GetContext(ctx, &id, query, userID, notification.Type, notification.Title,
		notification.Message, dataJSON, notification.Priority, notification.Category,
		notification.DeliveryMethod, notification.MaxRetries, notification.ExpiresAt)

	if err != nil {
		return 0, fmt.Errorf("failed to store notification: %w", err)
	}

	return id, nil
}

func (s *notificationService) markNotificationDelivered(ctx context.Context, notificationID int) {
	query := `UPDATE notifications SET delivered_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, notificationID)
	if err != nil {
		log.Printf("Failed to mark notification %d as delivered: %v", notificationID, err)
	}
}

func (s *notificationService) queueNotificationForRetry(ctx context.Context, notificationID int, notification *PersistentNotification) error {
	query := `
		INSERT INTO notification_queue (notification_id, scheduled_at, status, attempt_count)
		VALUES ($1, CURRENT_TIMESTAMP, $2, 0)`

	_, err := s.db.ExecContext(ctx, query, notificationID, QueueStatusPending)
	if err != nil {
		return fmt.Errorf("failed to queue notification for retry: %w", err)
	}

	return nil
}

func (s *notificationService) processQueuedNotification(ctx context.Context, userID int, item *NotificationQueueItem, notification *PersistentNotification) error {
	// Mark as processing
	s.updateQueueItemStatus(ctx, item.ID, QueueStatusProcessing, "")

	var err error
	switch notification.DeliveryMethod {
	case DeliveryMethodWebSocket:
		err = s.SendNotification(ctx, userID, notification.Type, notification.Data)
	case DeliveryMethodEmail:
		err = s.sendEmailFallback(ctx, userID, notification)
	default:
		err = s.SendNotification(ctx, userID, notification.Type, notification.Data)
	}

	if err != nil {
		// Check if we should retry
		if item.AttemptCount < notification.MaxRetries {
			nextRetry := time.Now().Add(time.Duration(item.AttemptCount+1) * 2 * time.Minute) // Exponential backoff
			s.updateQueueItemForRetry(ctx, item.ID, err.Error(), nextRetry)
		} else {
			s.updateQueueItemStatus(ctx, item.ID, QueueStatusFailed, fmt.Sprintf("Max retries exceeded: %v", err))
		}
		return err
	}

	// Success
	s.updateQueueItemStatus(ctx, item.ID, QueueStatusCompleted, "")
	s.markNotificationDelivered(ctx, item.NotificationID)
	return nil
}

func (s *notificationService) sendEmailFallback(ctx context.Context, userID int, notification *PersistentNotification) error {
	if s.emailSvc == nil {
		return fmt.Errorf("email service not available")
	}

	// Get user email
	var userEmail string
	err := s.db.GetContext(ctx, &userEmail, "SELECT email FROM users WHERE id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to get user email: %w", err)
	}

	// Send email notification
	emailMsg := EmailMessage{
		To:      []string{userEmail},
		Subject: notification.Title,
		Body:    notification.Message,
		IsHTML:  true,
	}

	return s.emailSvc.SendEmail(emailMsg)
}

func (s *notificationService) updateQueueItemStatus(ctx context.Context, itemID int, status, errorMsg string) {
	query := `UPDATE notification_queue SET status = $1, last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`
	_, err := s.db.ExecContext(ctx, query, status, errorMsg, itemID)
	if err != nil {
		log.Printf("Failed to update queue item %d status: %v", itemID, err)
	}
}

func (s *notificationService) updateQueueItemForRetry(ctx context.Context, itemID int, errorMsg string, nextRetry time.Time) {
	query := `
		UPDATE notification_queue 
		SET status = $1, attempt_count = attempt_count + 1, last_error = $2, 
		    scheduled_at = $3, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $4`
	
	_, err := s.db.ExecContext(ctx, query, QueueStatusPending, errorMsg, nextRetry, itemID)
	if err != nil {
		log.Printf("Failed to schedule retry for queue item %d: %v", itemID, err)
	}
}

func (s *notificationService) processQueue() {
	for item := range s.queue {
		go func(item *NotificationQueueItem) {
			ctx := context.Background()
			err := s.ProcessNotificationQueue(ctx)
			if err != nil {
				log.Printf("Error processing notification queue: %v", err)
			}
		}(item)
	}
}
