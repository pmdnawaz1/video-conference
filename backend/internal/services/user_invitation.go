package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"video-conference-backend/prisma/db"
	"video-conference-backend/prisma/db"
	"golang.org/x/crypto/bcrypt"
)

// UserInvitationService handles user invitations to an organization
// UserInvitationService interface defines user invitation operations
type UserInvitationService interface {
	CreateUserInvitation(ctx context.Context, invitedByUserID int, req *CreateUserInvitationRequest) (*db.UserInvitation, error)
	ValidateUserInvitationToken(ctx context.Context, tokenString string) (*UserInvitationClaims, error)
	CompleteUserRegistration(ctx context.Context, tokenString, password string) (*db.User, error)
	
	// Additional CRUD operations
	GetUserInvitation(ctx context.Context, invitationID int) (*db.UserInvitation, error)
	GetUserInvitationsByClient(ctx context.Context, clientID int) (*db.UserInvitation, error)
	CancelUserInvitation(ctx context.Context, invitationID int) error
	ResendUserInvitation(ctx context.Context, invitationID int) error
	CleanupExpiredInvitations(ctx context.Context) error
}

type userInvitationService struct {
	db        *db.DB
	jwtSecret string
	emailService *EmailService
}

// NewUserInvitationService creates a new user invitation service
func NewUserInvitationService(db *db.DB, jwtSecret string, emailService *EmailService) UserInvitationService {
	if db == nil {
		log.Fatal("Database connection is required for UserInvitationService")
	}
	if jwtSecret == "" {
		log.Fatal("JWT secret is required for UserInvitationService")
	}
	
	return &userInvitationService{
		db:           db,
		jwtSecret:    jwtSecret,
		emailService: emailService,
	}
}

// UserInvitationClaims represents the JWT claims for user invitation tokens
type UserInvitationClaims struct {
	InvitationID int    `json:"invitation_id"`
	Email        string `json:"email"`	
	ClientID     int    `json:"client_id"`
	AdminID      int    `json:"admin_id"`
	jwt.RegisteredClaims
}

// CreateUserInvitationRequest represents a request to invite a new user
type CreateUserInvitationRequest struct {
	ClientID    int      `json:"client_id" validate:"required"`
	Email       string   `json:"email" validate:"required,email"`
	FirstName   string   `json:"first_name" validate:"required"`
	LastName    string   `json:"last_name" validate:"required"`
	Role        string   `json:"role" validate:"required"`
	Department  string   `json:"department,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
	Groups      []int    `json:"groups,omitempty"`
	Message     string   `json:"message,omitempty"`
}

// CreateUserInvitation creates a new user invitation and sends an email with comprehensive validation
func (s *userInvitationService) CreateUserInvitation(ctx context.Context, invitedByUserID int, req *CreateUserInvitationRequest) (*db.UserInvitation, error) {
	// Input validation
	if req == nil {
		return nil, fmt.Errorf("invitation request cannot be nil")
	}
	
	// Validate required fields
	if req.Email == "" || req.FirstName == "" || req.LastName == "" {
		return nil, fmt.Errorf("email, first name, and last name are required")
	}
	
	if req.ClientID <= 0 {
		return nil, fmt.Errorf("valid client ID is required")
	}
	
	// Validate inviting user exists and has proper permissions
	var inviterUser *db.User
	err := s.db.GetContext(ctx, &inviterUser, 
		"SELECT id, client_id, role FROM users WHERE id = $1 AND status = 'active' AND deleted_at IS NULL", 
		invitedByUserID)
	if err != nil {
		return nil, fmt.Errorf("inviting user not found or inactive: %w", err)
	}
	
	// Check if inviter has permission for this client
	if inviterUser.ClientID != req.ClientID && inviterUser.Role != "super_admin" {
		return nil, fmt.Errorf("insufficient permissions to invite users to this organization")
	}

	// Check if user with this email already exists in this client
	var existingUserCount int
	err = s.db.GetContext(ctx, &existingUserCount, 
		"SELECT COUNT(*) FROM users WHERE email = $1 AND client_id = $2 AND deleted_at IS NULL", 
		req.Email, req.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}
	if existingUserCount > 0 {
		return nil, fmt.Errorf("user with email %s already exists in this organization", req.Email)
	}

	// Check for existing pending invitations
	var pendingInvitationCount int
	err = s.db.GetContext(ctx, &pendingInvitationCount,
		"SELECT COUNT(*) FROM user_invitations WHERE email = $1 AND client_id = $2 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP",
		req.Email, req.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing invitations: %w", err)
	}
	if pendingInvitationCount > 0 {
		return nil, fmt.Errorf("pending invitation already exists for email %s", req.Email)
	}

	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Create invitation record
	invitation := &*db.UserInvitation{
		ClientID:  *db.IntPtr(req.ClientID),
		AdminID:   *db.IntPtr(invitedByUserID),
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Status:    "pending",
		ExpiresAt: time.Now().Add(72 * time.Hour), // 72 hours expiry
	}

	query := `
		INSERT INTO user_invitations (client_id, admin_id, email, first_name, last_name, status, expires_at, welcome_message, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err = tx.GetContext(ctx, invitation, query,
		invitation.ClientID,
		invitation.AdminID,
		invitation.Email,
		invitation.FirstName,
		invitation.LastName,
		invitation.Status,
		invitation.ExpiresAt,
		req.Message,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user invitation record: %w", err)
	}

	// Generate JWT token for the invitation
	token, err := s.generateUserInvitationToken(invitation)
	if err != nil {
		return nil, fmt.Errorf("failed to generate user invitation token: %w", err)
	}

	// Update invitation with token
	updateQuery := `UPDATE user_invitations SET token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err = tx.ExecContext(ctx, updateQuery, token, invitation.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to update user invitation token: %w", err)
	}
	invitation.Token = token

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit invitation transaction: %w", err)
	}

	// Send invitation email (outside transaction)
	go func() {
		if s.emailService != nil {
			invitationLink := fmt.Sprintf("http://localhost:3000/user-invitation/%s", token) // TODO: Make base URL configurable
			
			// Get inviter's name
			var inviterName string
			nameErr := s.db.GetContext(context.Background(), &inviterName, 
				"SELECT first_name || ' ' || last_name FROM users WHERE id = $1", invitedByUserID)
			if nameErr != nil {
				log.Printf("Warning: Could not retrieve inviter name for user ID %d: %v", invitedByUserID, nameErr)
				inviterName = "An administrator"
			}

			emailErr := s.emailService.SendUserInvitationEmail(invitation.Email, invitation.FirstName, inviterName, invitationLink, invitation.ExpiresAt)
			if emailErr != nil {
				log.Printf("Failed to send user invitation email to %s: %v", invitation.Email, emailErr)
				// Update invitation status to indicate email failure
				_, _ = s.db.ExecContext(context.Background(), 
					"UPDATE user_invitations SET last_error = $1 WHERE id = $2", 
					fmt.Sprintf("Email delivery failed: %v", emailErr), invitation.ID)
			} else {
				log.Printf("Successfully sent invitation email to %s", invitation.Email)
			}
		} else {
			log.Printf("Warning: Email service not available, invitation created but email not sent")
		}
	}()

	log.Printf("Created user invitation %d for email: %s, client: %d by user: %d", 
		invitation.ID, invitation.Email, invitation.ClientID, invitedByUserID)
	return invitation, nil
}

// ValidateUserInvitationToken validates and parses a user invitation token
func (s *userInvitationService) ValidateUserInvitationToken(ctx context.Context, tokenString string) (*UserInvitationClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserInvitationClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse user invitation token: %w", err)
	}

	claims, ok := token.Claims.(*UserInvitationClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid user invitation token")
	}

	// Check if invitation exists and is pending
	var invitation *db.UserInvitation
	err = s.db.GetContext(ctx, &invitation, "SELECT * FROM user_invitations WHERE id = $1 AND token = $2 AND status = 'pending' AND deleted_at IS NULL", claims.InvitationID, tokenString)
	if err != nil {
		return nil, fmt.Errorf("invitation not found or not pending: %w", err)
	}

	// Check expiry
	if time.Now().After(invitation.ExpiresAt) {
		// Optionally update status to expired
		_, _ = s.db.ExecContext(ctx, "UPDATE user_invitations SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1", invitation.ID)
		return nil, fmt.Errorf("user invitation has expired")
	}

	return claims, nil
}

// CompleteUserRegistration completes the user registration process
func (s *userInvitationService) CompleteUserRegistration(ctx context.Context, tokenString, password string) (*db.User, error) {
	claims, err := s.ValidateUserInvitationToken(ctx, tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired invitation: %w", err)
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the user
	user := &*db.User{
		ClientID:    claims.ClientID,
		Email:       claims.Email,
		PasswordHash: string(hashedPassword),
		FirstName:   "", // Will be set from invitation details
		LastName:    "", // Will be set from invitation details
		Role:        "user", // Default role for invited users
		Status:      "active",
		CreatedBy:   &claims.AdminID,
	}

	// Fetch full invitation details to get first/last name if not in claims
	var invitation *db.UserInvitation
	err = s.db.GetContext(ctx, &invitation, "SELECT first_name, last_name FROM user_invitations WHERE id = $1", claims.InvitationID)
	if err == nil {
		user.FirstName = invitation.FirstName
		user.LastName = invitation.LastName
	} else {
		log.Printf("Warning: Could not fetch first/last name from invitation %d: %v", claims.InvitationID, err)
	}

	userQuery := `
		INSERT INTO users (client_id, email, password_hash, first_name, last_name, role, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id`

	err = s.db.GetContext(ctx, &user.ID, userQuery,
		user.ClientID,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.Role,
		user.Status,
		user.CreatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Mark invitation as accepted
	_, err = s.db.ExecContext(ctx, "UPDATE user_invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, password_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", claims.InvitationID)
	if err != nil {
		log.Printf("Warning: Failed to update user invitation status for ID %d: %v", claims.InvitationID, err)
	}

	log.Printf("User registration completed for email: %s, user ID: %d", user.Email, user.ID)
	return user, nil
}

// generateUserInvitationToken creates a JWT token for the user invitation
func (s *userInvitationService) generateUserInvitationToken(invitation *db.UserInvitation) (string, error) {
	claims := UserInvitationClaims{
		InvitationID: invitation.ID,
		Email:        invitation.Email,
		ClientID:     *invitation.ClientID,
		AdminID:      *invitation.AdminID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        fmt.Sprintf("user_inv_%d", invitation.ID),
			Subject:   invitation.Email,
			Issuer:    "video-conference-platform",
			Audience:  []string{"user-invitee"},
			ExpiresAt: jwt.NewNumericDate(invitation.ExpiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign user invitation token: %w", err)
	}

	return tokenString, nil
}

// ============================================================================
// ADDITIONAL CRUD OPERATIONS
// ============================================================================

// GetUserInvitation retrieves a user invitation by ID
func (s *userInvitationService) GetUserInvitation(ctx context.Context, invitationID int) (*db.UserInvitation, error) {
	if invitationID <= 0 {
		return nil, fmt.Errorf("invalid invitation ID")
	}

	var invitation *db.UserInvitation
	query := `
		SELECT id, client_id, admin_id, email, first_name, last_name, token, expires_at, 
		       status, welcome_message, accepted_at, password_created_at, reminder_sent_count, 
		       last_reminder_sent, created_at, updated_at
		FROM user_invitations 
		WHERE id = $1 AND deleted_at IS NULL`

	err := s.db.GetContext(ctx, &invitation, query, invitationID)
	if err != nil {
		return nil, fmt.Errorf("user invitation not found: %w", err)
	}

	return &invitation, nil
}

// GetUserInvitationsByClient retrieves all user invitations for a client
func (s *userInvitationService) GetUserInvitationsByClient(ctx context.Context, clientID int) (*db.UserInvitation, error) {
	if clientID <= 0 {
		return nil, fmt.Errorf("invalid client ID")
	}

	var invitations *db.UserInvitation
	query := `
		SELECT id, client_id, admin_id, email, first_name, last_name, token, expires_at, 
		       status, welcome_message, accepted_at, password_created_at, reminder_sent_count, 
		       last_reminder_sent, created_at, updated_at
		FROM user_invitations 
		WHERE client_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC`

	err := s.db.SelectContext(ctx, &invitations, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user invitations: %w", err)
	}

	return invitations, nil
}

// CancelUserInvitation cancels a user invitation
func (s *userInvitationService) CancelUserInvitation(ctx context.Context, invitationID int) error {
	if invitationID <= 0 {
		return fmt.Errorf("invalid invitation ID")
	}

	// Check if invitation exists and is in a cancellable state
	var invitation *db.UserInvitation
	err := s.db.GetContext(ctx, &invitation, 
		"SELECT id, status FROM user_invitations WHERE id = $1 AND deleted_at IS NULL", invitationID)
	if err != nil {
		return fmt.Errorf("invitation not found: %w", err)
	}

	if invitation.Status == "accepted" {
		return fmt.Errorf("cannot cancel an invitation that has already been accepted")
	}

	if invitation.Status == "cancelled" {
		return fmt.Errorf("invitation is already cancelled")
	}

	// Update status to cancelled
	query := `UPDATE user_invitations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	result, err := s.db.ExecContext(ctx, query, invitationID)
	if err != nil {
		return fmt.Errorf("failed to cancel invitation: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("invitation not found or already cancelled")
	}

	log.Printf("Cancelled user invitation %d", invitationID)
	return nil
}

// ResendUserInvitation resends a user invitation
func (s *userInvitationService) ResendUserInvitation(ctx context.Context, invitationID int) error {
	if invitationID <= 0 {
		return fmt.Errorf("invalid invitation ID")
	}

	// Get the invitation
	invitation, err := s.GetUserInvitation(ctx, invitationID)
	if err != nil {
		return fmt.Errorf("failed to get invitation: %w", err)
	}

	// Check if invitation is in a resendable state
	if invitation.Status != "pending" {
		return fmt.Errorf("can only resend pending invitations, current status: %s", invitation.Status)
	}

	// Check if invitation has expired
	if time.Now().After(invitation.ExpiresAt) {
		return fmt.Errorf("invitation has expired")
	}

	// Check rate limiting - max 3 resends
	if invitation.ReminderSentCount >= 3 {
		return fmt.Errorf("maximum resend limit reached (3 resends allowed)")
	}

	// Extend expiry time for resend
	newExpiry := time.Now().Add(72 * time.Hour)
	
	// Update reminder count and extend expiry
	updateQuery := `
		UPDATE user_invitations 
		SET reminder_sent_count = reminder_sent_count + 1, 
		    last_reminder_sent = CURRENT_TIMESTAMP,
		    expires_at = $2,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	_, err = s.db.ExecContext(ctx, updateQuery, invitationID, newExpiry)
	if err != nil {
		return fmt.Errorf("failed to update invitation for resend: %w", err)
	}

	// Send invitation email asynchronously
	go func() {
		if s.emailService != nil {
			invitationLink := fmt.Sprintf("http://localhost:3000/user-invitation/%s", invitation.Token)
			
			// Get inviter's name
			var inviterName string
			nameErr := s.db.GetContext(context.Background(), &inviterName, 
				"SELECT first_name || ' ' || last_name FROM users WHERE id = $1", invitation.AdminID)
			if nameErr != nil {
				inviterName = "An administrator"
			}

			emailErr := s.emailService.SendUserInvitationEmail(invitation.Email, invitation.FirstName, inviterName, invitationLink, newExpiry)
			if emailErr != nil {
				log.Printf("Failed to resend user invitation email to %s: %v", invitation.Email, emailErr)
			} else {
				log.Printf("Successfully resent invitation email to %s (attempt #%d)", invitation.Email, invitation.ReminderSentCount+1)
			}
		}
	}()

	return nil
}

// CleanupExpiredInvitations marks expired invitations as expired
func (s *userInvitationService) CleanupExpiredInvitations(ctx context.Context) error {
	query := `
		UPDATE user_invitations 
		SET status = 'expired', updated_at = CURRENT_TIMESTAMP
		WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP AND deleted_at IS NULL`

	result, err := s.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired invitations: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("Marked %d expired user invitations as expired", rowsAffected)
	}

	return nil
}
