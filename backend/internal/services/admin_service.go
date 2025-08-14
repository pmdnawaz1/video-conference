package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type Admin interface {
	// Admin invitation methods
	CreateAdminInvitation(ctx context.Context, req *AdminInvitationRequest) (*models.AdminInvitation, error)
	ValidateInvitationToken(ctx context.Context, token string) (*models.AdminInvitation, error)
	CompleteAdminInvitation(ctx context.Context, token, password string) (*models.User, error)
	ResendInvitation(ctx context.Context, invitationID int) error
	CancelInvitation(ctx context.Context, invitationID int) error

	// Admin invitation management
	GetInvitationsByClient(ctx context.Context, clientID int) ([]*models.AdminInvitation, error)
	GetInvitationByID(ctx context.Context, invitationID int) (*models.AdminInvitation, error)
	UpdateInvitationStatus(ctx context.Context, invitationID int, status string) error
	CleanupExpiredInvitations(ctx context.Context) error
}

type AdminInvitationRequest struct {
	ClientID  int    `json:"client_id" validate:"required"`
	Email     string `json:"email" validate:"required,email"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Message   string `json:"message,omitempty"`
}

type adminService struct {
	db       *database.DB
	userSvc  UserService
	emailSvc *EmailService
}

func AdminService(db *database.DB, userSvc UserService, emailSvc *EmailService) Admin {
	return &adminService{
		db:       db,
		userSvc:  userSvc,
		emailSvc: emailSvc,
	}
}

func (s *adminService) CreateAdminInvitation(ctx context.Context, req *AdminInvitationRequest) (*models.AdminInvitation, error) {
	// Check if user already exists
	existingUser, err := s.userSvc.GetUserByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, fmt.Errorf("user with email %s already exists", req.Email)
	}

	// Check if there's already a pending invitation
	var existingInvitation models.AdminInvitation
	query := `SELECT id FROM admin_invitations WHERE email = $1 AND status = $2`
	err = s.db.GetContext(ctx, &existingInvitation, query, req.Email, models.AdminInvitationStatusPending)
	if err == nil {
		return nil, fmt.Errorf("pending invitation already exists for email %s", req.Email)
	}

	// Generate secure token
	token, err := s.generateInvitationToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invitation token: %w", err)
	}

	// Create invitation record
	invitation := &models.AdminInvitation{
		ClientID:  &req.ClientID,
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Token:     token,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days
		Status:    models.AdminInvitationStatusPending,
		// InvitedBy would be set by the calling handler from JWT context
		InvitedBy: &[]int{1}[0], // Placeholder - should be from context
	}

	insertQuery := `
		INSERT INTO admin_invitations (client_id, email, first_name, last_name, token, expires_at, status, invited_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err = s.db.GetContext(ctx, invitation, insertQuery,
		invitation.ClientID, invitation.Email, invitation.FirstName, invitation.LastName,
		invitation.Token, invitation.ExpiresAt, invitation.Status, invitation.InvitedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to create admin invitation: %w", err)
	}

	// Send invitation email
	err = s.sendInvitationEmail(ctx, invitation)
	if err != nil {
		// Log error but don't fail the invitation creation
		fmt.Printf("Failed to send invitation email: %v", err)
	}

	return invitation, nil
}

func (s *adminService) ValidateInvitationToken(ctx context.Context, token string) (*models.AdminInvitation, error) {
	var invitation models.AdminInvitation
	query := `
		SELECT id, client_id, email, first_name, last_name, token, expires_at, status, 
		       invited_by, accepted_at, password_created_at, reminder_sent_count, 
		       last_reminder_sent, created_at, updated_at
		FROM admin_invitations 
		WHERE token = $1 AND status = $2 AND expires_at > CURRENT_TIMESTAMP`

	err := s.db.GetContext(ctx, &invitation, query, token, models.AdminInvitationStatusPending)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired invitation token")
	}

	return &invitation, nil
}

func (s *adminService) CompleteAdminInvitation(ctx context.Context, token, password string) (*models.User, error) {
	// Validate the invitation token
	invitation, err := s.ValidateInvitationToken(ctx, token)
	if err != nil {
		return nil, err
	}

	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Create the admin user
	user := &models.User{
		ClientID:  *invitation.ClientID,
		Email:     invitation.Email,
		Password:  password, // This will be hashed by the user service
		FirstName: invitation.FirstName,
		LastName:  invitation.LastName,
		Role:      models.RoleAdmin,
		Status:    models.UserStatusActive,
	}

	err = s.userSvc.CreateUser(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to create admin user: %w", err)
	}

	// Update invitation status
	now := time.Now()
	updateQuery := `
		UPDATE admin_invitations 
		SET status = $2, accepted_at = $3, password_created_at = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	_, err = tx.ExecContext(ctx, updateQuery, invitation.ID, models.AdminInvitationStatusAccepted, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to update invitation status: %w", err)
	}

	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return user, nil
}

func (s *adminService) ResendInvitation(ctx context.Context, invitationID int) error {
	// Get the invitation
	invitation, err := s.GetInvitationByID(ctx, invitationID)
	if err != nil {
		return err
	}

	if invitation.Status != models.AdminInvitationStatusPending {
		return fmt.Errorf("cannot resend invitation with status: %s", invitation.Status)
	}

	if time.Now().After(invitation.ExpiresAt) {
		return fmt.Errorf("invitation has expired")
	}

	// Send the email
	err = s.sendInvitationEmail(ctx, invitation)
	if err != nil {
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	// Update reminder count
	updateQuery := `
		UPDATE admin_invitations 
		SET reminder_sent_count = reminder_sent_count + 1, 
		    last_reminder_sent = CURRENT_TIMESTAMP, 
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	_, err = s.db.ExecContext(ctx, updateQuery, invitationID)
	if err != nil {
		return fmt.Errorf("failed to update reminder count: %w", err)
	}

	return nil
}

func (s *adminService) CancelInvitation(ctx context.Context, invitationID int) error {
	return s.UpdateInvitationStatus(ctx, invitationID, models.AdminInvitationStatusCancelled)
}

func (s *adminService) GetInvitationsByClient(ctx context.Context, clientID int) ([]*models.AdminInvitation, error) {
	var invitations []*models.AdminInvitation
	query := `
		SELECT id, client_id, email, first_name, last_name, token, expires_at, status, 
		       invited_by, accepted_at, password_created_at, reminder_sent_count, 
		       last_reminder_sent, created_at, updated_at
		FROM admin_invitations 
		WHERE client_id = $1 
		ORDER BY created_at DESC`

	err := s.db.SelectContext(ctx, &invitations, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get invitations: %w", err)
	}

	return invitations, nil
}

func (s *adminService) GetInvitationByID(ctx context.Context, invitationID int) (*models.AdminInvitation, error) {
	var invitation models.AdminInvitation
	query := `
		SELECT id, client_id, email, first_name, last_name, token, expires_at, status, 
		       invited_by, accepted_at, password_created_at, reminder_sent_count, 
		       last_reminder_sent, created_at, updated_at
		FROM admin_invitations 
		WHERE id = $1`

	err := s.db.GetContext(ctx, &invitation, query, invitationID)
	if err != nil {
		return nil, fmt.Errorf("invitation not found: %w", err)
	}

	return &invitation, nil
}

func (s *adminService) UpdateInvitationStatus(ctx context.Context, invitationID int, status string) error {
	query := `UPDATE admin_invitations SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	result, err := s.db.ExecContext(ctx, query, invitationID, status)
	if err != nil {
		return fmt.Errorf("failed to update invitation status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		return fmt.Errorf("invitation not found or not updated")
	}

	return nil
}

func (s *adminService) CleanupExpiredInvitations(ctx context.Context) error {
	query := `
		UPDATE admin_invitations 
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE status = $2 AND expires_at < CURRENT_TIMESTAMP`

	_, err := s.db.ExecContext(ctx, query, models.AdminInvitationStatusExpired, models.AdminInvitationStatusPending)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired invitations: %w", err)
	}

	return nil
}

// Helper methods
func (s *adminService) generateInvitationToken() (string, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (s *adminService) sendInvitationEmail(ctx context.Context, invitation *models.AdminInvitation) error {
	// Check if email service is available
	if s.emailSvc == nil {
		fmt.Printf("⚠️  Email service not available - invitation created but email not sent")
		return nil
	}

	// Create invitation URL
	invitationURL := fmt.Sprintf("http://localhost:3000/admin/invitation/%s", invitation.Token)

	emailData := map[string]interface{}{
		"first_name":     invitation.FirstName,
		"last_name":      invitation.LastName,
		"invitation_url": invitationURL,
		"expires_at":     invitation.ExpiresAt,
	}

	return s.emailSvc.SendAdminInvitation(ctx, invitation.Email, emailData)
}
