package services

import (
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

// InvitationService handles meeting invitations
type InvitationService struct {
	db        *database.DB
	jwtSecret string
}

// NewInvitationService creates a new invitation service
func NewInvitationService(db *database.DB, jwtSecret string) *InvitationService {
	return &InvitationService{
		db:        db,
		jwtSecret: jwtSecret,
	}
}

// InvitationClaims represents the JWT claims for invitation tokens
type InvitationClaims struct {
	MeetingID   int    `json:"meeting_id"`
	Email       string `json:"email"`
	InviterID   int    `json:"inviter_id"`
	MeetingLink string `json:"meeting_link"`
	jwt.RegisteredClaims
}

// InvitationRequest represents a request to create invitations
type InvitationRequest struct {
	MeetingID int      `json:"meeting_id"`
	Emails    []string `json:"emails"`
	Message   string   `json:"message,omitempty"`
}

// CreateInvitation creates a new invitation with JWT token
func (s *InvitationService) CreateInvitation(userID int, req InvitationRequest) (*models.Invitation, string, error) {
	// Get meeting details
	meeting, err := s.getMeetingByID(req.MeetingID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get meeting: %w", err)
	}

	// Verify user has permission to invite to this meeting
	if meeting.CreatedByUserID != userID {
		return nil, "", fmt.Errorf("user does not have permission to invite to this meeting")
	}

	// Create invitation record
	invitation := &models.Invitation{
		ID:             0, // Will be set by database
		MeetingID:      req.MeetingID,
		InvitationType: "email",
		Email:          nil, // Will be set per email
		Status:         "pending",
		Role:           "attendee",
		Token:          "", // Will be generated
		ExpiresAt:      meeting.ScheduledStart.Add(-15 * time.Minute), // Expires 15 minutes before meeting starts
		InvitedBy:      userID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// For now, create one invitation (we'll batch this later)
	if len(req.Emails) > 0 {
		email := req.Emails[0]
		invitation.Email = &email
	}

	// Insert invitation into database
	query := `
		INSERT INTO invitations (client_id, meeting_id, invitation_type, email, status, role, token, expires_at, inviter_user_id, invited_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id`
	
	// Get client ID from meeting
	invitation.ClientID = meeting.ClientID
	
	err = s.db.Get(&invitation.ID, query, 
		invitation.ClientID,
		invitation.MeetingID, 
		invitation.InvitationType,
		invitation.Email, 
		invitation.Status,
		invitation.Role,
		"", // Token will be generated after
		invitation.ExpiresAt,
		invitation.InvitedBy, // inviter_user_id
		invitation.InvitedBy, // invited_by (for consistency)
		invitation.CreatedAt,
		invitation.UpdatedAt)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create invitation: %w", err)
	}

	// Generate JWT token for the invitation
	token, err := s.generateInvitationToken(invitation, meeting)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate invitation token: %w", err)
	}

	// Update invitation with token
	updateQuery := `UPDATE invitations SET token = $1 WHERE id = $2`
	_, err = s.db.Exec(updateQuery, token, invitation.ID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to update invitation token: %w", err)
	}

	log.Printf("Created invitation %d for meeting %d, email: %s", invitation.ID, req.MeetingID, *invitation.Email)
	return invitation, token, nil
}

// generateInvitationToken creates a JWT token for the invitation
func (s *InvitationService) generateInvitationToken(invitation *models.Invitation, meeting *models.Meeting) (string, error) {
	// Create invitation link
	meetingLink := fmt.Sprintf("/meeting/%s?invitation=%s", meeting.MeetingID, "%TOKEN%")

	claims := InvitationClaims{
		MeetingID:   invitation.MeetingID,
		Email:       *invitation.Email,
		InviterID:   invitation.InvitedBy,
		MeetingLink: meetingLink,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        fmt.Sprintf("inv_%d", invitation.ID),
			Subject:   *invitation.Email,
			Issuer:    "video-conference-platform",
			Audience:  []string{"meeting-invitee"},
			ExpiresAt: jwt.NewNumericDate(invitation.ExpiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign invitation token: %w", err)
	}

	return tokenString, nil
}

// ValidateInvitationToken validates and parses an invitation token
func (s *InvitationService) ValidateInvitationToken(tokenString string) (*InvitationClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &InvitationClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse invitation token: %w", err)
	}

	if claims, ok := token.Claims.(*InvitationClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid invitation token")
}

// AcceptInvitation marks an invitation as accepted
func (s *InvitationService) AcceptInvitation(tokenString string) error {
	claims, err := s.ValidateInvitationToken(tokenString)
	if err != nil {
		return fmt.Errorf("invalid invitation: %w", err)
	}

	// Update invitation status
	query := `
		UPDATE invitations 
		SET status = 'accepted', updated_at = NOW()
		WHERE meeting_id = $1 AND email = $2 AND status = 'pending'`
	
	_, err = s.db.Exec(query, claims.MeetingID, claims.Email)
	if err != nil {
		return fmt.Errorf("failed to accept invitation: %w", err)
	}

	log.Printf("Invitation accepted for meeting %d, email: %s", claims.MeetingID, claims.Email)
	return nil
}

// GetMeetingByInvitation retrieves meeting details using invitation token
func (s *InvitationService) GetMeetingByInvitation(tokenString string) (*models.Meeting, error) {
	claims, err := s.ValidateInvitationToken(tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid invitation: %w", err)
	}

	meeting, err := s.getMeetingByID(claims.MeetingID)
	if err != nil {
		return nil, fmt.Errorf("meeting not found: %w", err)
	}

	return meeting, nil
}

// Helper function to get meeting by ID
func (s *InvitationService) getMeetingByID(meetingID int) (*models.Meeting, error) {
	var meeting models.Meeting
	query := `
		SELECT id, client_id, created_by_user_id, title, description, 
		       scheduled_start, scheduled_end, max_participants, 
		       meeting_id, status, created_at, updated_at
		FROM meetings 
		WHERE id = $1`
	
	err := s.db.Get(&meeting, query, meetingID)
	if err != nil {
		return nil, err
	}
	
	return &meeting, nil
}

// GenerateInvitationLink creates a complete invitation link
func (s *InvitationService) GenerateInvitationLink(baseURL, token string) string {
	return fmt.Sprintf("%s/join?token=%s", baseURL, token)
}


// GenerateEmailContent creates email content for invitation
func (s *InvitationService) GenerateEmailContent(meeting *models.Meeting, inviterName, invitationLink string) EmailContent {
	subject := fmt.Sprintf("You're invited to join: %s", meeting.Title)
	
	body := fmt.Sprintf(`
Hi,

You have been invited to join a video conference meeting:

Meeting: %s
Start Time: %s
Duration: %s

Description: %s

To join the meeting, click the link below:
%s

If you don't have an account, you'll be guided through a quick registration process.

Best regards,
%s
`, 
		meeting.Title,
		meeting.ScheduledStart.Format("Monday, January 2, 2006 at 3:04 PM MST"),
		meeting.ScheduledEnd.Sub(meeting.ScheduledStart).String(),
		meeting.Description,
		invitationLink,
		inviterName)

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .meeting-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .join-button { display: inline-block; background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Video Conference Invitation</h2>
        </div>
        <div class="content">
            <p>Hi,</p>
            <p>You have been invited to join a video conference meeting:</p>
            
            <div class="meeting-details">
                <h3>%s</h3>
                <p><strong>Start Time:</strong> %s</p>
                <p><strong>Duration:</strong> %s</p>
                <p><strong>Description:</strong> %s</p>
            </div>
            
            <a href="%s" class="join-button">Join Meeting</a>
            
            <p>If you don't have an account, you'll be guided through a quick registration process.</p>
        </div>
        <div class="footer">
            <p>Invited by %s</p>
            <p>Powered by Enterprise Video Conference Platform</p>
        </div>
    </div>
</body>
</html>
`, 
		meeting.Title,
		meeting.ScheduledStart.Format("Monday, January 2, 2006 at 3:04 PM MST"),
		meeting.ScheduledEnd.Sub(meeting.ScheduledStart).String(),
		meeting.Description,
		invitationLink,
		inviterName)

	return EmailContent{
		Subject:     subject,
		Body:        body,
		HTMLBody:    htmlBody,
		MeetingLink: invitationLink,
	}
}