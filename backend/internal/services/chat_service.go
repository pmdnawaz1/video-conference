package services

import (
	"context"
	"fmt"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type ChatService interface {
	SendMessage(ctx context.Context, message *models.ChatMessage) error
	GetMessageByID(ctx context.Context, id int) (*models.ChatMessage, error)
	UpdateMessage(ctx context.Context, message *models.ChatMessage) error
	DeleteMessage(ctx context.Context, id int, userID int) error
	
	// Message queries
	GetMessagesByMeeting(ctx context.Context, meetingID int, limit, offset int) ([]*models.ChatMessage, error)
	GetMessagesBySender(ctx context.Context, senderID int, limit, offset int) ([]*models.ChatMessage, error)
	GetRecentMessages(ctx context.Context, meetingID int, limit int) ([]*models.ChatMessage, error)
	GetMessagesByType(ctx context.Context, meetingID int, messageType string, limit, offset int) ([]*models.ChatMessage, error)
	SearchMessages(ctx context.Context, meetingID int, query string, limit, offset int) ([]*models.ChatMessage, error)
	
	// Message moderation
	ModerateMessage(ctx context.Context, messageID, moderatorID int) error
	UnmoderateMessage(ctx context.Context, messageID int) error
	GetModeratedMessages(ctx context.Context, meetingID int, limit, offset int) ([]*models.ChatMessage, error)
	
	// Message threads (replies)
	GetMessageReplies(ctx context.Context, parentMessageID int, limit, offset int) ([]*models.ChatMessage, error)
	GetMessageThread(ctx context.Context, rootMessageID int) ([]*models.ChatMessage, error)
	
	// File attachments
	AddAttachment(ctx context.Context, messageID int, attachment map[string]interface{}) error
	RemoveAttachment(ctx context.Context, messageID int, attachmentID string) error
	GetMessageAttachments(ctx context.Context, messageID int) ([]map[string]interface{}, error)
	
	// Chat statistics
	GetChatStats(ctx context.Context, meetingID int) (*ChatStats, error)
	GetUserChatStats(ctx context.Context, meetingID int, userID int) (*UserChatStats, error)
}

type ChatStats struct {
	TotalMessages     int                    `json:"total_messages"`
	TotalParticipants int                    `json:"total_participants"`
	MessagesByType    map[string]int         `json:"messages_by_type"`
	TopSenders        []UserMessageCount     `json:"top_senders"`
	FirstMessageAt    *string                `json:"first_message_at"`
	LastMessageAt     *string                `json:"last_message_at"`
}

type UserChatStats struct {
	UserID           int    `json:"user_id"`
	TotalMessages    int    `json:"total_messages"`
	MessageTypes     map[string]int `json:"message_types"`
	FirstMessageAt   *string `json:"first_message_at"`
	LastMessageAt    *string `json:"last_message_at"`
}

type UserMessageCount struct {
	UserID      int    `json:"user_id"`
	SenderName  string `json:"sender_name"`
	MessageCount int   `json:"message_count"`
}

type chatService struct {
	db *database.DB
}

func NewChatService(db *database.DB) ChatService {
	return &chatService{db: db}
}

func (s *chatService) SendMessage(ctx context.Context, message *models.ChatMessage) error {
	query := `
		INSERT INTO chat_messages (client_id, meeting_id, sender_id, sender_email, sender_name, 
		                          message, message_type, metadata, reply_to_id, attachments)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, message, query,
		message.ClientID, message.MeetingID, message.SenderID, message.SenderEmail,
		message.SenderName, message.Message, message.MessageType, message.Metadata,
		message.ReplyToID, message.Attachments)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	return nil
}

func (s *chatService) GetMessageByID(ctx context.Context, id int) (*models.ChatMessage, error) {
	message := &models.ChatMessage{}
	query := `SELECT * FROM chat_messages WHERE id = $1`
	
	err := s.db.GetContext(ctx, message, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get message by ID: %w", err)
	}
	
	return message, nil
}

func (s *chatService) UpdateMessage(ctx context.Context, message *models.ChatMessage) error {
	query := `
		UPDATE chat_messages 
		SET message = $2, metadata = $3, attachments = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, message.ID, message.Message, message.Metadata, message.Attachments)
	if err != nil {
		return fmt.Errorf("failed to update message: %w", err)
	}
	
	return nil
}

func (s *chatService) DeleteMessage(ctx context.Context, id int, userID int) error {
	// Only allow users to delete their own messages or allow moderators
	query := `DELETE FROM chat_messages WHERE id = $1 AND sender_id = $2`
	
	result, err := s.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete message: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("message not found or user not authorized to delete")
	}
	
	return nil
}

func (s *chatService) GetMessagesByMeeting(ctx context.Context, meetingID int, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = false
		ORDER BY created_at ASC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &messages, query, meetingID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages by meeting: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) GetMessagesBySender(ctx context.Context, senderID int, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE sender_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &messages, query, senderID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages by sender: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) GetRecentMessages(ctx context.Context, meetingID int, limit int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = false
		ORDER BY created_at DESC 
		LIMIT $2`
	
	err := s.db.SelectContext(ctx, &messages, query, meetingID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent messages: %w", err)
	}
	
	// Reverse to show oldest first
	for i := len(messages)/2 - 1; i >= 0; i-- {
		opp := len(messages) - 1 - i
		messages[i], messages[opp] = messages[opp], messages[i]
	}
	
	return messages, nil
}

func (s *chatService) GetMessagesByType(ctx context.Context, meetingID int, messageType string, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE meeting_id = $1 AND message_type = $2 AND is_moderated = false
		ORDER BY created_at ASC 
		LIMIT $3 OFFSET $4`
	
	err := s.db.SelectContext(ctx, &messages, query, meetingID, messageType, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages by type: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) SearchMessages(ctx context.Context, meetingID int, query string, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	searchQuery := `
		SELECT * FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = false 
		AND (message ILIKE $2 OR sender_name ILIKE $2)
		ORDER BY created_at DESC 
		LIMIT $3 OFFSET $4`
	
	searchTerm := "%" + query + "%"
	err := s.db.SelectContext(ctx, &messages, searchQuery, meetingID, searchTerm, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search messages: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) ModerateMessage(ctx context.Context, messageID, moderatorID int) error {
	query := `
		UPDATE chat_messages 
		SET is_moderated = true, moderated_by = $2, moderated_at = CURRENT_TIMESTAMP, 
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, messageID, moderatorID)
	if err != nil {
		return fmt.Errorf("failed to moderate message: %w", err)
	}
	
	return nil
}

func (s *chatService) UnmoderateMessage(ctx context.Context, messageID int) error {
	query := `
		UPDATE chat_messages 
		SET is_moderated = false, moderated_by = NULL, moderated_at = NULL, 
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, messageID)
	if err != nil {
		return fmt.Errorf("failed to unmoderate message: %w", err)
	}
	
	return nil
}

func (s *chatService) GetModeratedMessages(ctx context.Context, meetingID int, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = true
		ORDER BY moderated_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &messages, query, meetingID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get moderated messages: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) GetMessageReplies(ctx context.Context, parentMessageID int, limit, offset int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	query := `
		SELECT * FROM chat_messages 
		WHERE reply_to_id = $1 AND is_moderated = false
		ORDER BY created_at ASC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &messages, query, parentMessageID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get message replies: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) GetMessageThread(ctx context.Context, rootMessageID int) ([]*models.ChatMessage, error) {
	messages := []*models.ChatMessage{}
	
	// Use recursive CTE to get the full thread
	query := `
		WITH RECURSIVE message_thread AS (
			SELECT *, 0 as level FROM chat_messages WHERE id = $1
			UNION ALL
			SELECT cm.*, mt.level + 1 
			FROM chat_messages cm
			INNER JOIN message_thread mt ON cm.reply_to_id = mt.id
		)
		SELECT * FROM message_thread 
		WHERE is_moderated = false
		ORDER BY level, created_at ASC`
	
	err := s.db.SelectContext(ctx, &messages, query, rootMessageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message thread: %w", err)
	}
	
	return messages, nil
}

func (s *chatService) AddAttachment(ctx context.Context, messageID int, attachment map[string]interface{}) error {
	// Get current attachments
	message, err := s.GetMessageByID(ctx, messageID)
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	attachments := message.Attachments
	if attachments == nil {
		attachments = models.JSONB{}
	}

	// Add new attachment (this is a simplified implementation)
	// In production, you'd want a more structured approach
	if attachmentList, ok := attachments["files"].([]interface{}); ok {
		attachments["files"] = append(attachmentList, attachment)
	} else {
		attachments["files"] = []interface{}{attachment}
	}

	query := `UPDATE chat_messages SET attachments = $2 WHERE id = $1`
	_, err = s.db.ExecContext(ctx, query, messageID, attachments)
	if err != nil {
		return fmt.Errorf("failed to add attachment: %w", err)
	}
	
	return nil
}

func (s *chatService) RemoveAttachment(ctx context.Context, messageID int, attachmentID string) error {
	// This is a simplified implementation
	// In production, you'd want proper attachment management
	message, err := s.GetMessageByID(ctx, messageID)
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	attachments := message.Attachments
	if attachments == nil {
		return fmt.Errorf("no attachments found")
	}

	// Remove attachment logic would go here
	// For now, just update the message
	query := `UPDATE chat_messages SET attachments = $2 WHERE id = $1`
	_, err = s.db.ExecContext(ctx, query, messageID, attachments)
	if err != nil {
		return fmt.Errorf("failed to remove attachment: %w", err)
	}
	
	return nil
}

func (s *chatService) GetMessageAttachments(ctx context.Context, messageID int) ([]map[string]interface{}, error) {
	message, err := s.GetMessageByID(ctx, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	if message.Attachments == nil {
		return []map[string]interface{}{}, nil
	}

	if files, ok := message.Attachments["files"].([]interface{}); ok {
		var attachments []map[string]interface{}
		for _, file := range files {
			if attachment, ok := file.(map[string]interface{}); ok {
				attachments = append(attachments, attachment)
			}
		}
		return attachments, nil
	}

	return []map[string]interface{}{}, nil
}

func (s *chatService) GetChatStats(ctx context.Context, meetingID int) (*ChatStats, error) {
	stats := &ChatStats{
		MessagesByType: make(map[string]int),
		TopSenders:     []UserMessageCount{},
	}

	// Total messages
	query := `SELECT COUNT(*) FROM chat_messages WHERE meeting_id = $1 AND is_moderated = false`
	err := s.db.GetContext(ctx, &stats.TotalMessages, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total messages: %w", err)
	}

	// Total participants
	query = `SELECT COUNT(DISTINCT sender_id) FROM chat_messages WHERE meeting_id = $1 AND sender_id IS NOT NULL`
	err = s.db.GetContext(ctx, &stats.TotalParticipants, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total participants: %w", err)
	}

	// Messages by type
	query = `
		SELECT message_type, COUNT(*) as count 
		FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = false 
		GROUP BY message_type`
	
	rows, err := s.db.QueryContext(ctx, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages by type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var messageType string
		var count int
		if err := rows.Scan(&messageType, &count); err != nil {
			continue
		}
		stats.MessagesByType[messageType] = count
	}

	// Top senders
	query = `
		SELECT sender_id, sender_name, COUNT(*) as message_count 
		FROM chat_messages 
		WHERE meeting_id = $1 AND sender_id IS NOT NULL AND is_moderated = false
		GROUP BY sender_id, sender_name 
		ORDER BY message_count DESC 
		LIMIT 10`
	
	err = s.db.SelectContext(ctx, &stats.TopSenders, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get top senders: %w", err)
	}

	// First and last message times
	query = `
		SELECT MIN(created_at) as first_message, MAX(created_at) as last_message 
		FROM chat_messages 
		WHERE meeting_id = $1 AND is_moderated = false`
	
	var first, last *string
	err = s.db.QueryRowContext(ctx, query, meetingID).Scan(&first, &last)
	if err != nil {
		return nil, fmt.Errorf("failed to get message timestamps: %w", err)
	}
	
	stats.FirstMessageAt = first
	stats.LastMessageAt = last

	return stats, nil
}

func (s *chatService) GetUserChatStats(ctx context.Context, meetingID int, userID int) (*UserChatStats, error) {
	stats := &UserChatStats{
		UserID:       userID,
		MessageTypes: make(map[string]int),
	}

	// Total messages for user
	query := `SELECT COUNT(*) FROM chat_messages WHERE meeting_id = $1 AND sender_id = $2 AND is_moderated = false`
	err := s.db.GetContext(ctx, &stats.TotalMessages, query, meetingID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user total messages: %w", err)
	}

	// Messages by type for user
	query = `
		SELECT message_type, COUNT(*) as count 
		FROM chat_messages 
		WHERE meeting_id = $1 AND sender_id = $2 AND is_moderated = false 
		GROUP BY message_type`
	
	rows, err := s.db.QueryContext(ctx, query, meetingID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user messages by type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var messageType string
		var count int
		if err := rows.Scan(&messageType, &count); err != nil {
			continue
		}
		stats.MessageTypes[messageType] = count
	}

	// First and last message times for user
	query = `
		SELECT MIN(created_at) as first_message, MAX(created_at) as last_message 
		FROM chat_messages 
		WHERE meeting_id = $1 AND sender_id = $2 AND is_moderated = false`
	
	var first, last *string
	err = s.db.QueryRowContext(ctx, query, meetingID, userID).Scan(&first, &last)
	if err != nil {
		return nil, fmt.Errorf("failed to get user message timestamps: %w", err)
	}
	
	stats.FirstMessageAt = first
	stats.LastMessageAt = last

	return stats, nil
}