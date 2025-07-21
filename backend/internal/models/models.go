package models

import (
	"database/sql/driver"
	"encoding/json"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JSONB is a custom type for PostgreSQL JSONB fields
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	
	return json.Unmarshal(bytes, j)
}

// Client represents an organizational account
type Client struct {
	ID           int       `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	AppName      string    `json:"app_name" db:"app_name"`
	LogoURL      *string   `json:"logo_url" db:"logo_url"`
	Theme        string    `json:"theme" db:"theme"`
	PrimaryColor string    `json:"primary_color" db:"primary_color"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// ClientFeatures represents per-client feature toggles
type ClientFeatures struct {
	ID                    int       `json:"id" db:"id"`
	ClientID              int       `json:"client_id" db:"client_id"`
	ChatEnabled           bool      `json:"chat_enabled" db:"chat_enabled"`
	ReactionsEnabled      bool      `json:"reactions_enabled" db:"reactions_enabled"`
	ScreenSharingEnabled  bool      `json:"screen_sharing_enabled" db:"screen_sharing_enabled"`
	RecordingEnabled      bool      `json:"recording_enabled" db:"recording_enabled"`
	RaiseHandEnabled      bool      `json:"raise_hand_enabled" db:"raise_hand_enabled"`
	WaitingRoomEnabled    bool      `json:"waiting_room_enabled" db:"waiting_room_enabled"`
	MaxParticipants       int       `json:"max_participants" db:"max_participants"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

// User represents a user account with role-based access
type User struct {
	ID             int        `json:"id" db:"id"`
	ClientID       int        `json:"client_id" db:"client_id"`
	Email          string     `json:"email" db:"email"`
	Password       string     `json:"-" db:"-"` // For input only, not stored
	PasswordHash   string     `json:"-" db:"password_hash"`
	FirstName      string     `json:"first_name" db:"first_name"`
	LastName       string     `json:"last_name" db:"last_name"`
	Role           string     `json:"role" db:"role"` // super_admin, admin, user
	Status         string     `json:"status" db:"status"` // active, inactive, pending
	ProfilePicture *string    `json:"profile_picture" db:"profile_picture"`
	LastLogin      *time.Time `json:"last_login" db:"last_login"`
	CreatedBy      *int       `json:"created_by" db:"created_by"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Group represents a user group for organizing participants
type Group struct {
	ID          int       `json:"id" db:"id"`
	ClientID    int       `json:"client_id" db:"client_id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description" db:"description"`
	CreatedBy   *int      `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// UserGroupMembership represents many-to-many relationship between users and groups
type UserGroupMembership struct {
	ID       int       `json:"id" db:"id"`
	UserID   int       `json:"user_id" db:"user_id"`
	GroupID  int       `json:"group_id" db:"group_id"`
	AddedBy  *int      `json:"added_by" db:"added_by"`
	AddedAt  time.Time `json:"added_at" db:"added_at"`
}

// Meeting represents a video conference meeting
type Meeting struct {
	ID                     int        `json:"id" db:"id"`
	ClientID               int        `json:"client_id" db:"client_id"`
	CreatedByUserID        int        `json:"created_by_user_id" db:"created_by_user_id"`
	Title                  string     `json:"title" db:"title"`
	Description            *string    `json:"description" db:"description"`
	MeetingID              string     `json:"meeting_id" db:"meeting_id"` // Unique meeting identifier
	Password               *string    `json:"password,omitempty" db:"password"`
	ScheduledStart         time.Time  `json:"scheduled_start" db:"scheduled_start"`
	ScheduledEnd           time.Time  `json:"scheduled_end" db:"scheduled_end"`
	ActualStart            *time.Time `json:"actual_start" db:"actual_start"`
	ActualEnd              *time.Time `json:"actual_end" db:"actual_end"`
	Status                 string     `json:"status" db:"status"` // scheduled, active, ended, cancelled
	MaxParticipants        int        `json:"max_participants" db:"max_participants"`
	AllowAnonymous         bool       `json:"allow_anonymous" db:"allow_anonymous"`
	RequireApproval        bool       `json:"require_approval" db:"require_approval"`
	EnableWaitingRoom      bool       `json:"enable_waiting_room" db:"enable_waiting_room"`
	EnableChat             bool       `json:"enable_chat" db:"enable_chat"`
	EnableScreenSharing    bool       `json:"enable_screen_sharing" db:"enable_screen_sharing"`
	EnableRecording        bool       `json:"enable_recording" db:"enable_recording"`
	Settings               JSONB      `json:"settings" db:"settings"`
	CreatedAt              time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at" db:"updated_at"`
}

// Invitation represents an invitation to a meeting
type Invitation struct {
	ID              int       `json:"id" db:"id"`
	ClientID        int       `json:"client_id" db:"client_id"`
	MeetingID       int       `json:"meeting_id" db:"meeting_id"`
	InvitationType  string    `json:"invitation_type" db:"invitation_type"` // email, group, user
	UserID          *int      `json:"user_id" db:"user_id"`
	GroupID         *int      `json:"group_id" db:"group_id"`
	Email           *string   `json:"email" db:"email"`
	GuestName       *string   `json:"guest_name" db:"guest_name"`
	Token           string    `json:"token" db:"token"`
	Status          string    `json:"status" db:"status"` // pending, sent, accepted, declined, expired, cancelled
	Role            string    `json:"role" db:"role"` // host, co_host, presenter, attendee
	Message         *string   `json:"message" db:"message"`
	ExpiresAt       time.Time `json:"expires_at" db:"expires_at"`
	SentAt          *time.Time `json:"sent_at" db:"sent_at"`
	RespondedAt     *time.Time `json:"responded_at" db:"responded_at"`
	InvitedBy       int       `json:"invited_by" db:"invited_by"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// EmailTemplate represents customizable email templates
type EmailTemplate struct {
	ID         int       `json:"id" db:"id"`
	ClientID   int       `json:"client_id" db:"client_id"`
	Type       string    `json:"type" db:"type"` // invitation, reminder, cancellation, etc.
	Name       string    `json:"name" db:"name"`
	Subject    string    `json:"subject" db:"subject"`
	HTMLBody   string    `json:"html_body" db:"html_body"`
	TextBody   *string   `json:"text_body" db:"text_body"`
	Variables  JSONB     `json:"variables" db:"variables"`
	IsDefault  bool      `json:"is_default" db:"is_default"`
	IsActive   bool      `json:"is_active" db:"is_active"`
	CreatedBy  *int      `json:"created_by" db:"created_by"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// ChatMessage represents a chat message during a meeting
type ChatMessage struct {
	ID           int       `json:"id" db:"id"`
	ClientID     int       `json:"client_id" db:"client_id"`
	MeetingID    int       `json:"meeting_id" db:"meeting_id"`
	SenderID     *int      `json:"sender_id" db:"sender_id"`
	SenderEmail  *string   `json:"sender_email" db:"sender_email"`
	SenderName   string    `json:"sender_name" db:"sender_name"`
	Message      string    `json:"message" db:"message"`
	MessageType  string    `json:"message_type" db:"message_type"` // text, file, image, system, etc.
	Metadata     JSONB     `json:"metadata" db:"metadata"`
	IsModerated  bool      `json:"is_moderated" db:"is_moderated"`
	ModeratedBy  *int      `json:"moderated_by" db:"moderated_by"`
	ModeratedAt  *time.Time `json:"moderated_at" db:"moderated_at"`
	ReplyToID    *int      `json:"reply_to_id" db:"reply_to_id"`
	Attachments  JSONB     `json:"attachments" db:"attachments"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Recording represents a meeting recording
type Recording struct {
	ID           int       `json:"id" db:"id"`
	ClientID     int       `json:"client_id" db:"client_id"`
	MeetingID    int       `json:"meeting_id" db:"meeting_id"`
	Title        string    `json:"title" db:"title"`
	Description  *string   `json:"description" db:"description"`
	Status       string    `json:"status" db:"status"` // pending, recording, processing, completed, failed
	StartedAt    *time.Time `json:"started_at" db:"started_at"`
	EndedAt      *time.Time `json:"ended_at" db:"ended_at"`
	Duration     *int      `json:"duration" db:"duration"` // in seconds
	FileSize     *int64    `json:"file_size" db:"file_size"` // in bytes
	FilePath     *string   `json:"file_path" db:"file_path"`
	DownloadURL  *string   `json:"download_url" db:"download_url"`
	StreamingURL *string   `json:"streaming_url" db:"streaming_url"`
	Metadata     JSONB     `json:"metadata" db:"metadata"`
	Settings     JSONB     `json:"settings" db:"settings"`
	StartedBy    int       `json:"started_by" db:"started_by"`
	StoppedBy    *int      `json:"stopped_by" db:"stopped_by"`
	IsPublic     bool      `json:"is_public" db:"is_public"`
	Password     *string   `json:"password,omitempty" db:"password"`
	ExpiresAt    *time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// MeetingParticipant represents a participant in a meeting
type MeetingParticipant struct {
	ID        int       `json:"id" db:"id"`
	MeetingID int       `json:"meeting_id" db:"meeting_id"`
	UserID    *int      `json:"user_id" db:"user_id"`
	Email     *string   `json:"email" db:"email"`
	GuestName *string   `json:"guest_name" db:"guest_name"`
	Role      string    `json:"role" db:"role"` // host, co_host, presenter, attendee
	Status    string    `json:"status" db:"status"` // invited, accepted, declined, joined, left
	JoinedAt  *time.Time `json:"joined_at" db:"joined_at"`
	LeftAt    *time.Time `json:"left_at" db:"left_at"`
	InvitedBy *int      `json:"invited_by" db:"invited_by"`
	InvitedAt time.Time `json:"invited_at" db:"invited_at"`
}

// Role constants
const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
	RoleUser       = "user"
)

// Meeting status constants
const (
	MeetingStatusScheduled = "scheduled"
	MeetingStatusActive    = "active"
	MeetingStatusEnded     = "ended"
	MeetingStatusCancelled = "cancelled"
)

// Invitation status constants
const (
	InvitationStatusPending   = "pending"
	InvitationStatusSent      = "sent"
	InvitationStatusAccepted  = "accepted"
	InvitationStatusDeclined  = "declined"
	InvitationStatusExpired   = "expired"
	InvitationStatusCancelled = "cancelled"
)

// Participant status constants
const (
	ParticipantStatusInvited  = "invited"
	ParticipantStatusAccepted = "accepted"
	ParticipantStatusDeclined = "declined"
	ParticipantStatusJoined   = "joined"
	ParticipantStatusLeft     = "left"
)

// Participant role constants
const (
	ParticipantRoleHost      = "host"
	ParticipantRoleCoHost    = "co_host"
	ParticipantRolePresenter = "presenter"
	ParticipantRoleAttendee  = "attendee"
)

// Helper methods for User model
func (u *User) GetFullName() string {
	return u.FirstName + " " + u.LastName
}

func (u *User) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}

func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

func (u *User) IsUser() bool {
	return u.Role == RoleUser
}

func (u *User) CanManageClient() bool {
	return u.Role == RoleSuperAdmin || u.Role == RoleAdmin
}

// Helper methods for Meeting model
func (m *Meeting) IsActive() bool {
	return m.Status == MeetingStatusActive
}

func (m *Meeting) IsScheduled() bool {
	return m.Status == MeetingStatusScheduled
}

func (m *Meeting) HasEnded() bool {
	return m.Status == MeetingStatusEnded
}

func (m *Meeting) IsCancelled() bool {
	return m.Status == MeetingStatusCancelled
}

func (m *Meeting) GetDuration() *time.Duration {
	if m.ActualStart != nil && m.ActualEnd != nil {
		duration := m.ActualEnd.Sub(*m.ActualStart)
		return &duration
	}
	return nil
}

// GenerateToken generates a unique token for invitations
func GenerateToken() string {
	return uuid.New().String()
}

// GenerateMeetingID generates a unique meeting ID
func GenerateMeetingID() string {
	// Generate a shorter, more user-friendly meeting ID
	id := uuid.New().String()
	return strings.ReplaceAll(id[:8], "-", "")
}

// Auth-related models

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID    int    `json:"user_id"`
	ClientID  int    `json:"client_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	TokenType string `json:"token_type"` // access, refresh, password_reset
	jwt.RegisteredClaims
}

// AuthResponse represents the response for authentication requests
type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	TokenType    string       `json:"token_type"`
	ExpiresIn    int          `json:"expires_in"`
	User         *UserProfile `json:"user"`
}

// UserProfile represents user profile information returned in auth responses
type UserProfile struct {
	ID             int     `json:"id"`
	Email          string  `json:"email"`
	FirstName      string  `json:"first_name"`
	LastName       string  `json:"last_name"`
	Role           string  `json:"role"`
	ProfilePicture *string `json:"profile_picture"`
	ClientID       int     `json:"client_id"`
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	ClientID  int    `json:"client_id" validate:"required"`
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Role      string `json:"role" validate:"required,oneof=super_admin admin user"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

// RefreshTokenRequest represents a token refresh request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// RefreshToken represents a stored refresh token
type RefreshToken struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Token     string    `json:"token" db:"token"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// PasswordResetToken represents a password reset token
type PasswordResetToken struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Token     string    `json:"token" db:"token"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	UsedAt    *time.Time `json:"used_at" db:"used_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}