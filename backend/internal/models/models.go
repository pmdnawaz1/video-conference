package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/golang-jwt/jwt/v5"
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
	ID                     int        `json:"id" db:"id"`
	Email                  string     `json:"email" db:"email"`
	AppName                string     `json:"app_name" db:"app_name"`
	OrganizationName       string     `json:"organization_name" db:"organization_name"`
	OrganizationType       string     `json:"organization_type" db:"organization_type"`
	SubscriptionPlan       string     `json:"subscription_plan" db:"subscription_plan"`
	SubscriptionExpiresAt  *time.Time `json:"subscription_expires_at" db:"subscription_expires_at"`
	MaxAdmins              int        `json:"max_admins" db:"max_admins"`
	MaxUsers               int        `json:"max_users" db:"max_users"`
	MaxConcurrentMeetings  int        `json:"max_concurrent_meetings" db:"max_concurrent_meetings"`
	StorageLimitGB         int        `json:"storage_limit_gb" db:"storage_limit_gb"`
	LogoURL                *string    `json:"logo_url" db:"logo_url"`
	Theme                  string     `json:"theme" db:"theme"`
	PrimaryColor           string     `json:"primary_color" db:"primary_color"`
	CustomDomain           *string    `json:"custom_domain" db:"custom_domain"`
	BrandingConfig         JSONB      `json:"branding_config" db:"branding_config"`
	SSOEnabled             bool       `json:"sso_enabled" db:"sso_enabled"`
	SSOConfig              JSONB      `json:"sso_config" db:"sso_config"`
	SecuritySettings       JSONB      `json:"security_settings" db:"security_settings"`
	BillingContactEmail    *string    `json:"billing_contact_email" db:"billing_contact_email"`
	TechnicalContactEmail  *string    `json:"technical_contact_email" db:"technical_contact_email"`
	Timezone               string     `json:"timezone" db:"timezone"`
	BusinessHours          JSONB      `json:"business_hours" db:"business_hours"`
	IsActive               bool       `json:"is_active" db:"is_active"`
	TrialEndsAt            *time.Time `json:"trial_ends_at" db:"trial_ends_at"`
	CreatedBy              *int       `json:"created_by" db:"created_by"`
	CreatedAt              time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at" db:"updated_at"`
}

// ClientFeatures represents per-client feature toggles
type ClientFeatures struct {
	ID                           int       `json:"id" db:"id"`
	ClientID                     int       `json:"client_id" db:"client_id"`
	ChatEnabled                  bool      `json:"chat_enabled" db:"chat_enabled"`
	ReactionsEnabled             bool      `json:"reactions_enabled" db:"reactions_enabled"`
	ScreenSharingEnabled         bool      `json:"screen_sharing_enabled" db:"screen_sharing_enabled"`
	RecordingEnabled             bool      `json:"recording_enabled" db:"recording_enabled"`
	RaiseHandEnabled             bool      `json:"raise_hand_enabled" db:"raise_hand_enabled"`
	WaitingRoomEnabled           bool      `json:"waiting_room_enabled" db:"waiting_room_enabled"`
	MaxParticipants              int       `json:"max_participants" db:"max_participants"`
	AdminApprovalRequired        bool      `json:"admin_approval_required" db:"admin_approval_required"`
	DefaultVideoPermission       bool      `json:"default_video_permission" db:"default_video_permission"`
	DefaultAudioPermission       bool      `json:"default_audio_permission" db:"default_audio_permission"`
	DefaultScreenPermission      bool      `json:"default_screen_permission" db:"default_screen_permission"`
	AllowUserVideoRequest        bool      `json:"allow_user_video_request" db:"allow_user_video_request"`
	AllowUserAudioRequest        bool      `json:"allow_user_audio_request" db:"allow_user_audio_request"`
	AllowUserScreenRequest       bool      `json:"allow_user_screen_request" db:"allow_user_screen_request"`
	AutoApproveRequests          bool      `json:"auto_approve_requests" db:"auto_approve_requests"`
	MeetingLobbyEnabled          bool      `json:"meeting_lobby_enabled" db:"meeting_lobby_enabled"`
	ParticipantLimit             int       `json:"participant_limit" db:"participant_limit"`
	MeetingDurationLimit         int       `json:"meeting_duration_limit" db:"meeting_duration_limit"`
	FileSharingEnabled           bool      `json:"file_sharing_enabled" db:"file_sharing_enabled"`
	FileSizeLimitMB              int       `json:"file_size_limit_mb" db:"file_size_limit_mb"`
	WhiteboardEnabled            bool      `json:"whiteboard_enabled" db:"whiteboard_enabled"`
	PollsEnabled                 bool      `json:"polls_enabled" db:"polls_enabled"`
	QAndAEnabled                 bool      `json:"q_and_a_enabled" db:"q_and_a_enabled"`
	LiveStreamingEnabled         bool      `json:"live_streaming_enabled" db:"live_streaming_enabled"`
	MeetingTemplatesEnabled      bool      `json:"meeting_templates_enabled" db:"meeting_templates_enabled"`
	CustomBackgroundsEnabled     bool      `json:"custom_backgrounds_enabled" db:"custom_backgrounds_enabled"`
	NoiseCancellationEnabled     bool      `json:"noise_cancellation_enabled" db:"noise_cancellation_enabled"`
	TranscriptionEnabled         bool      `json:"transcription_enabled" db:"transcription_enabled"`
	TranslationEnabled           bool      `json:"translation_enabled" db:"translation_enabled"`
	MeetingInsightsEnabled       bool      `json:"meeting_insights_enabled" db:"meeting_insights_enabled"`
	APIAccessEnabled             bool      `json:"api_access_enabled" db:"api_access_enabled"`
	WebhookNotificationsEnabled  bool      `json:"webhook_notifications_enabled" db:"webhook_notifications_enabled"`
	SSORequired                  bool      `json:"sso_required" db:"sso_required"`
	IPRestrictions               JSONB     `json:"ip_restrictions" db:"ip_restrictions"`
	AllowedDomains               JSONB     `json:"allowed_domains" db:"allowed_domains"`
	BlockedDomains               JSONB     `json:"blocked_domains" db:"blocked_domains"`
	CreatedAt                    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                    time.Time `json:"updated_at" db:"updated_at"`
}

// User represents a user account with role-based access
type User struct {
	ID                       int        `json:"id" db:"id"`
	ClientID                 int        `json:"client_id" db:"client_id"`
	Email                    string     `json:"email" db:"email"`
	Password                 string     `json:"-" db:"-"` // For input only, not stored
	PasswordHash             string     `json:"-" db:"password_hash"`
	FirstName                string     `json:"first_name" db:"first_name"`
	LastName                 string     `json:"last_name" db:"last_name"`
	Role                     string     `json:"role" db:"role"` // super_admin, admin, user
	Status                   string     `json:"status" db:"status"` // active, inactive, pending
	CreatedBy                *int       `json:"created_by" db:"created_by"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at" db:"updated_at"`
	InvitationToken          *string    `json:"-" db:"invitation_token"`
	InvitationExpiresAt      *time.Time `json:"-" db:"invitation_expires_at"`
	IsInvited                bool       `json:"-" db:"is_invited"`
	PasswordCreated          bool       `json:"-" db:"password_created"`
	TwoFactorEnabled         bool       `json:"two_factor_enabled" db:"two_factor_enabled"`
	TwoFactorSecret          *string    `json:"-" db:"two_factor_secret"`
	LoginAttempts            int        `json:"-" db:"login_attempts"`
	LockedUntil              *time.Time `json:"-" db:"locked_until"`
	PasswordResetToken       *string    `json:"-" db:"password_reset_token"`
	PasswordResetExpires     *time.Time `json:"-" db:"password_reset_expires"`
	LastPasswordChange       *time.Time `json:"-" db:"last_password_change"`
	ForcePasswordChange      bool       `json:"-" db:"force_password_change"`
	EmailVerified            bool       `json:"email_verified" db:"email_verified"`
	EmailVerificationToken   *string    `json:"-" db:"email_verification_token"`
	Timezone                 string     `json:"timezone" db:"timezone"`
	Language                 string     `json:"language" db:"language"`
	NotificationPreferences  JSONB      `json:"notification_preferences" db:"notification_preferences"`
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
	ID                        int        `json:"id" db:"id"`
	ClientID                  int        `json:"client_id" db:"client_id"`
	Title                     string     `json:"title" db:"title"`
	Description               *string    `json:"description" db:"description"`
	HostID                    *int       `json:"host_id" db:"host_id"`
	MeetingID                 string     `json:"meeting_id" db:"meeting_id"`
	MeetingType               string     `json:"meeting_type" db:"meeting_type"`
	ScheduledStart            time.Time  `json:"scheduled_start" db:"scheduled_start"`
	ScheduledEnd              time.Time  `json:"scheduled_end" db:"scheduled_end"`
	ActualStart               *time.Time `json:"actual_start" db:"actual_start"`
	ActualEnd                 *time.Time `json:"actual_end" db:"actual_end"`
	BufferStartMinutes        int        `json:"buffer_start_minutes" db:"buffer_start_minutes"`
	BufferEndMinutes          int        `json:"buffer_end_minutes" db:"buffer_end_minutes"`
	Status                    string     `json:"status" db:"status"`
	IsActive                  bool       `json:"is_active" db:"is_active"`
	AdminOnlyControls         bool       `json:"admin_only_controls" db:"admin_only_controls"`
	WaitingRoomEnabled        bool       `json:"waiting_room_enabled" db:"waiting_room_enabled"`
	AutoAdmitUsers            bool       `json:"auto_admit_users" db:"auto_admit_users"`
	LockMeeting               bool       `json:"lock_meeting" db:"lock_meeting"`
	MuteParticipantsOnJoin    bool       `json:"mute_participants_on_join" db:"mute_participants_on_join"`
	DisableVideoOnJoin        bool       `json:"disable_video_on_join" db:"disable_video_on_join"`
	AllowScreenSharing        bool       `json:"allow_screen_sharing" db:"allow_screen_sharing"`
	RecordingAutoStart        bool       `json:"recording_auto_start" db:"recording_auto_start"`
	ChatEnabled               bool       `json:"chat_enabled" db:"chat_enabled"`
	RaiseHandEnabled          bool       `json:"raise_hand_enabled" db:"raise_hand_enabled"`
	BreakoutRoomsEnabled      bool       `json:"breakout_rooms_enabled" db:"breakout_rooms_enabled"`
	MaxDurationMinutes        int        `json:"max_duration_minutes" db:"max_duration_minutes"`
	Password                  *string    `json:"password" db:"password"`
	RequireMeetingPassword    bool       `json:"require_meeting_password" db:"require_meeting_password"`
	ParticipantJoinApproval   bool       `json:"participant_join_approval" db:"participant_join_approval"`
	AllowAnonymousUsers       bool       `json:"allow_anonymous_users" db:"allow_anonymous_users"`
	MeetingSettings           JSONB      `json:"meeting_settings" db:"meeting_settings"`
	LobbyMessage              *string    `json:"lobby_message" db:"lobby_message"`
	EntryExitChime            bool       `json:"entry_exit_chime" db:"entry_exit_chime"`
	CalendarEventID           *string    `json:"calendar_event_id" db:"calendar_event_id"`
	RecordingConsentRequired  bool       `json:"recording_consent_required" db:"recording_consent_required"`
	DataRetentionDays         int        `json:"data_retention_days" db:"data_retention_days"`
	MeetingNotes              *string    `json:"meeting_notes" db:"meeting_notes"`
	MeetingSummary            JSONB      `json:"meeting_summary" db:"meeting_summary"`
	QualityRating             *int       `json:"quality_rating" db:"quality_rating"`
	FeedbackComments          *string    `json:"feedback_comments" db:"feedback_comments"`
	RecurringPattern          JSONB      `json:"recurring_pattern" db:"recurring_pattern"`
	ParentMeetingID           *int       `json:"parent_meeting_id" db:"parent_meeting_id"`
	OccurrenceDate            *time.Time `json:"occurrence_date" db:"occurrence_date"`
	IsCancelled               bool       `json:"is_cancelled" db:"is_cancelled"`
	CancellationReason        *string    `json:"cancellation_reason" db:"cancellation_reason"`
	CancelledBy               *int       `json:"cancelled_by" db:"cancelled_by"`
	CancelledAt               *time.Time `json:"cancelled_at" db:"cancelled_at"`
	CreatedBy                 *int       `json:"created_by" db:"created_by"`
	CreatedAt                 time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at" db:"updated_at"`
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
	Message            string     `json:"message" db:"message"`
	MessageType        string     `json:"message_type" db:"message_type"` // text, file, image, system, etc.
	ThreadID           *int       `json:"thread_id" db:"thread_id"`
	MessageStatus      string     `json:"message_status" db:"message_status"`
	EditedAt           *time.Time `json:"edited_at" db:"edited_at"`
	EditedBy           *int       `json:"edited_by" db:"edited_by"`
	OriginalMessage    *string    `json:"original_message" db:"original_message"`
	Reactions          JSONB      `json:"reactions" db:"reactions"`
	Mentions           JSONB      `json:"mentions" db:"mentions"`
	FileAttachments    JSONB      `json:"file_attachments" db:"file_attachments"`
	MessagePriority    string     `json:"message_priority" db:"message_priority"`
	IsAnnouncement     bool       `json:"is_announcement" db:"is_announcement"`
	ExpiresAt          *time.Time `json:"expires_at" db:"expires_at"`
	TranslationData    JSONB      `json:"translation_data" db:"translation_data"`
	SentimentScore     *float64   `json:"sentiment_score" db:"sentiment_score"`
	FlaggedContent     bool       `json:"flagged_content" db:"flagged_content"`
	FlagReason         *string    `json:"flag_reason" db:"flag_reason"`
	Metadata           JSONB      `json:"metadata" db:"metadata"`
	IsModerated        bool       `json:"is_moderated" db:"is_moderated"`
	ModeratedBy        *int       `json:"moderated_by" db:"moderated_by"`
	ModeratedAt        *time.Time `json:"moderated_at" db:"moderated_at"`
	ReplyToID          *int       `json:"reply_to_id" db:"reply_to_id"`
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
	ID        int        `json:"id" db:"id"`
	MeetingID *int       `json:"meeting_id" db:"meeting_id"`
	UserID    *int       `json:"user_id" db:"user_id"`
	GroupID   *int       `json:"group_id" db:"group_id"`
	Email     *string    `json:"email" db:"email"`
	GuestName *string    `json:"guest_name" db:"guest_name"`
	Role      string     `json:"role" db:"role"`
	Status    string     `json:"status" db:"status"`
	JoinedAt  *time.Time `json:"joined_at" db:"joined_at"`
	LeftAt    *time.Time `json:"left_at" db:"left_at"`
	InvitedBy *int       `json:"invited_by" db:"invited_by"`
	InvitedAt time.Time  `json:"invited_at" db:"invited_at"`
}

// Role constants
const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
	RoleUser       = "user"
)

// User status constants
const (
	UserStatusActive    = "active"
	UserStatusInactive  = "inactive" 
	UserStatusPending   = "pending"
	UserStatusSuspended = "suspended"
)

// Admin invitation status constants
const (
	AdminInvitationStatusPending   = "pending"
	AdminInvitationStatusAccepted  = "accepted"
	AdminInvitationStatusExpired   = "expired"
	AdminInvitationStatusCancelled = "cancelled"
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
func (m *Meeting) IsActiveStatus() bool {
	return m.Status == MeetingStatusActive
}

func (m *Meeting) IsScheduled() bool {
	return m.Status == MeetingStatusScheduled
}

func (m *Meeting) HasEnded() bool {
	return m.Status == MeetingStatusEnded
}

func (m *Meeting) IsCancelledStatus() bool {
	return m.Status == MeetingStatusCancelled
}

func (m *Meeting) GetDuration() *time.Duration {
	if m.ActualStart != nil && m.ActualEnd != nil {
		duration := m.ActualEnd.Sub(*m.ActualStart)
		return &duration
	}
	return nil
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
	ID        int    `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
	ClientID  int    `json:"client_id"`
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


// UserPreference represents user-specific settings and preferences
type UserPreference struct {
	ID                       int        `json:"id" db:"id"`
	UserID                   int        `json:"user_id" db:"user_id"`
	DefaultAudioEnabled      bool       `json:"default_audio_enabled" db:"default_audio_enabled"`
	DefaultVideoEnabled      bool       `json:"default_video_enabled" db:"default_video_enabled"`
	AutoJoinAudio            bool       `json:"auto_join_audio" db:"auto_join_audio"`
	PreferredCameraDevice    *string    `json:"preferred_camera_device" db:"preferred_camera_device"`
	PreferredMicrophoneDevice *string    `json:"preferred_microphone_device" db:"preferred_microphone_device"`
	PreferredSpeakerDevice   *string    `json:"preferred_speaker_device" db:"preferred_speaker_device"`
	NotificationEmailEnabled bool       `json:"notification_email_enabled" db:"notification_email_enabled"`
	NotificationBrowserEnabled bool       `json:"notification_browser_enabled" db:"notification_browser_enabled"`
	NotificationMeetingReminders bool       `json:"notification_meeting_reminders" db:"notification_meeting_reminders"`
	NotificationChatMessages bool       `json:"notification_chat_messages" db:"notification_chat_messages"`
	NotificationMeetingInvites bool       `json:"notification_meeting_invites" db:"notification_meeting_invites"`
	ThemePreference          string     `json:"theme_preference" db:"theme_preference"` // light, dark, system
	LanguagePreference       string     `json:"language_preference" db:"language_preference"`
	TimezonePreference       string     `json:"timezone_preference" db:"timezone_preference"`
	MeetingViewPreference    string     `json:"meeting_view_preference" db:"meeting_view_preference"` // grid, speaker, gallery
	ChatPosition             string     `json:"chat_position" db:"chat_position"` // right, bottom, floating
	ShowParticipantNames     bool       `json:"show_participant_names" db:"show_participant_names"`
	ShowConnectionQuality    bool       `json:"show_connection_quality" db:"show_connection_quality"`
	AutoHideControls         bool       `json:"auto_hide_controls" db:"auto_hide_controls"`
	KeyboardShortcutsEnabled bool       `json:"keyboard_shortcuts_enabled" db:"keyboard_shortcuts_enabled"`
	HighContrastMode         bool       `json:"high_contrast_mode" db:"high_contrast_mode"`
	ReduceMotion             bool       `json:"reduce_motion" db:"reduce_motion"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at" db:"updated_at"`
}

// Notification represents system notifications for users
type Notification struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Type      string    `json:"type" db:"type"`
	Title     string    `json:"title" db:"title"`
	Message   string    `json:"message" db:"message"`
	Data      string    `json:"data" db:"data"` // JSON string for additional notification data
	IsRead    bool      `json:"is_read" db:"is_read"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	ReadAt    *time.Time `json:"read_at" db:"read_at"`
}

// Group represents a user group for organizing participants
type Group struct {
	ID                  int       `json:"id" db:"id"`
	ClientID            int       `json:"client_id" db:"client_id"`
	Name                string    `json:"name" db:"name"`
	Description         *string   `json:"description" db:"description"`
	GroupType           string    `json:"group_type" db:"group_type"`
	IsActive            bool      `json:"is_active" db:"is_active"`
	MaxMembers          int       `json:"max_members" db:"max_members"`
	AutoAddNewUsers     bool      `json:"auto_add_new_users" db:"auto_add_new_users"`
	EmailDomainFilter   *string   `json:"email_domain_filter" db:"email_domain_filter"`
	GroupSettings       JSONB     `json:"group_settings" db:"group_settings"`
	MeetingDefaults     JSONB     `json:"meeting_defaults" db:"meeting_defaults"`
	NotificationSettings JSONB    `json:"notification_settings" db:"notification_settings"`
	ExternalID          *string   `json:"external_id" db:"external_id"`
	SyncSource          string    `json:"sync_source" db:"sync_source"`
	LastSyncAt          *time.Time `json:"last_sync_at" db:"last_sync_at"`
	SyncErrors          JSONB     `json:"sync_errors" db:"sync_errors"`
	CreatedBy           *int      `json:"created_by" db:"created_by"`
	CreatedAt           time.Time `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time `json:"updated_at" db:"updated_at"`
}

// AdminInvitation represents an invitation sent to a new admin
type AdminInvitation struct {
	ID                 int        `json:"id" db:"id"`
	ClientID           *int       `json:"client_id" db:"client_id"`
	Email              string     `json:"email" db:"email"`
	FirstName          string     `json:"first_name" db:"first_name"`
	LastName           string     `json:"last_name" db:"last_name"`
	Token              string     `json:"token" db:"token"`
	ExpiresAt          time.Time  `json:"expires_at" db:"expires_at"`
	Status             string     `json:"status" db:"status"`
	InvitedBy          *int       `json:"invited_by" db:"invited_by"`
	AcceptedAt         *time.Time `json:"accepted_at" db:"accepted_at"`
	PasswordCreatedAt  *time.Time `json:"password_created_at" db:"password_created_at"`
	ReminderSentCount  int        `json:"reminder_sent_count" db:"reminder_sent_count"`
	LastReminderSent   *time.Time `json:"last_reminder_sent" db:"last_reminder_sent"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

// UserInvitation represents an invitation sent to a new user
type UserInvitation struct {
	ID                 int        `json:"id" db:"id"`
	ClientID           *int       `json:"client_id" db:"client_id"`
	AdminID            *int       `json:"admin_id" db:"admin_id"`
	Email              string     `json:"email" db:"email"`
	FirstName          string     `json:"first_name" db:"first_name"`
	LastName           string     `json:"last_name" db:"last_name"`
	Token              string     `json:"token" db:"token"`
	ExpiresAt          time.Time  `json:"expires_at" db:"expires_at"`
	Status             string     `json:"status" db:"status"`
	WelcomeMessage     *string    `json:"welcome_message" db:"welcome_message"`
	AcceptedAt         *time.Time `json:"accepted_at" db:"accepted_at"`
	PasswordCreatedAt  *time.Time `json:"password_created_at" db:"password_created_at"`
	ReminderSentCount  int        `json:"reminder_sent_count" db:"reminder_sent_count"`
	LastReminderSent   *time.Time `json:"last_reminder_sent" db:"last_reminder_sent"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

// MeetingPermission represents permissions for a user in a meeting
type MeetingPermission struct {
	ID             int        `json:"id" db:"id"`
	MeetingID      *int       `json:"meeting_id" db:"meeting_id"`
	UserID         *int       `json:"user_id" db:"user_id"`
	PermissionType string     `json:"permission_type" db:"permission_type"`
	IsGranted      bool       `json:"is_granted" db:"is_granted"`
	RequestedAt    *time.Time `json:"requested_at" db:"requested_at"`
	ApprovedAt     *time.Time `json:"approved_at" db:"approved_at"`
	DeniedAt       *time.Time `json:"denied_at" db:"denied_at"`
	ApprovedBy     *int       `json:"approved_by" db:"approved_by"`
	DeniedBy       *int       `json:"denied_by" db:"denied_by"`
	RequestMessage *string    `json:"request_message" db:"request_message"`
	AdminResponse  *string    `json:"admin_response" db:"admin_response"`
	AutoGranted    bool       `json:"auto_granted" db:"auto_granted"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// RaiseHand represents a raised hand in a meeting
type RaiseHand struct {
	ID             int        `json:"id" db:"id"`
	MeetingID      *int       `json:"meeting_id" db:"meeting_id"`
	UserID         *int       `json:"user_id" db:"user_id"`
	RaisedAt       time.Time  `json:"raised_at" db:"raised_at"`
	LoweredAt      *time.Time `json:"lowered_at" db:"lowered_at"`
	LoweredBy      *int       `json:"lowered_by" db:"lowered_by"`
	AutoLowered    bool       `json:"auto_lowered" db:"auto_lowered"`
	AcknowledgedBy *int       `json:"acknowledged_by" db:"acknowledged_by"`
	AcknowledgedAt *time.Time `json:"acknowledged_at" db:"acknowledged_at"`
	QueuePosition  *int       `json:"queue_position" db:"queue_position"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

// MeetingAnalytics represents analytics data for a meeting
type MeetingAnalytics struct {
	ID                        int       `json:"id" db:"id"`
	MeetingID                 *int      `json:"meeting_id" db:"meeting_id"`
	ParticipantCount          int       `json:"participant_count" db:"participant_count"`
	PeakParticipants          int       `json:"peak_participants" db:"peak_participants"`
	TotalDurationSeconds      int       `json:"total_duration_seconds" db:"total_duration_seconds"`
	ChatMessagesCount         int       `json:"chat_messages_count" db:"chat_messages_count"`
	ScreenSharesCount         int       `json:"screen_shares_count" db:"screen_shares_count"`
	RecordingsCount           int       `json:"recordings_count" db:"recordings_count"`
	RaiseHandsCount           int       `json:"raise_hands_count" db:"raise_hands_count"`
	PermissionRequestsCount   int       `json:"permission_requests_count" db:"permission_requests_count"`
	AverageParticipantDuration int      `json:"average_participant_duration" db:"average_participant_duration"`
	ParticipantJoinTimes      JSONB     `json:"participant_join_times" db:"participant_join_times"`
	ParticipantLeaveTimes     JSONB     `json:"participant_leave_times" db:"participant_leave_times"`
	FeatureUsageStats         JSONB     `json:"feature_usage_stats" db:"feature_usage_stats"`
	QualityMetrics            JSONB     `json:"quality_metrics" db:"quality_metrics"`
	CreatedAt                 time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at" db:"updated_at"`
}

// SpeakingActivity represents speaking activity during a meeting
type SpeakingActivity struct {
	ID                 int        `json:"id" db:"id"`
	MeetingID          *int       `json:"meeting_id" db:"meeting_id"`
	UserID             *int       `json:"user_id" db:"user_id"`
	StartedSpeakingAt  time.Time  `json:"started_speaking_at" db:"started_speaking_at"`
	StoppedSpeakingAt  *time.Time `json:"stopped_speaking_at" db:"stopped_speaking_at"`
	DurationSeconds    *int       `json:"duration_seconds" db:"duration_seconds"`
	AudioLevelAvg      *float64   `json:"audio_level_avg" db:"audio_level_avg"`
	AudioLevelPeak     *float64   `json:"audio_level_peak" db:"audio_level_peak"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
}

// UserAnalytics represents user engagement analytics
type UserAnalytics struct {
	ID                        int        `json:"id" db:"id"`
	UserID                    *int       `json:"user_id" db:"user_id"`
	ClientID                  *int       `json:"client_id" db:"client_id"`
	TotalMeetingsJoined       int        `json:"total_meetings_joined" db:"total_meetings_joined"`
	TotalMeetingDurationMins  int        `json:"total_meeting_duration_minutes" db:"total_meeting_duration_minutes"`
	TotalSpeakingTimeMins     int        `json:"total_speaking_time_minutes" db:"total_speaking_time_minutes"`
	TotalChatMessages         int        `json:"total_chat_messages" db:"total_chat_messages"`
	TotalHandRaises           int        `json:"total_hand_raises" db:"total_hand_raises"`
	MeetingsThisWeek          int        `json:"meetings_this_week" db:"meetings_this_week"`
	MeetingsThisMonth         int        `json:"meetings_this_month" db:"meetings_this_month"`
	AverageMeetingDuration    int        `json:"average_meeting_duration" db:"average_meeting_duration"`
	MostActiveDayOfWeek       int        `json:"most_active_day_of_week" db:"most_active_day_of_week"`
	MostActiveHour            int        `json:"most_active_hour" db:"most_active_hour"`
	EngagementScore           float64    `json:"engagement_score" db:"engagement_score"`
	LastMeetingDate           *time.Time `json:"last_meeting_date" db:"last_meeting_date"`
	FirstMeetingDate          *time.Time `json:"first_meeting_date" db:"first_meeting_date"`
	PreferredMeetingDuration  int        `json:"preferred_meeting_duration" db:"preferred_meeting_duration"`
	ParticipationTrends       JSONB      `json:"participation_trends" db:"participation_trends"`
	FeatureUsageStats         JSONB      `json:"feature_usage_stats" db:"feature_usage_stats"`
	DevicePreferences         JSONB      `json:"device_preferences" db:"device_preferences"`
	CreatedAt                 time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at" db:"updated_at"`
}

// UserMeetingBookmark represents a bookmark in a meeting recording
type UserMeetingBookmark struct {
	ID                  int       `json:"id" db:"id"`
	UserID              *int      `json:"user_id" db:"user_id"`
	MeetingID           *int      `json:"meeting_id" db:"meeting_id"`
	BookmarkTimeSeconds int       `json:"bookmark_time_seconds" db:"bookmark_time_seconds"`
	BookmarkTitle       *string   `json:"bookmark_title" db:"bookmark_title"`
	BookmarkDescription *string   `json:"bookmark_description" db:"bookmark_description"`
	BookmarkType        string    `json:"bookmark_type" db:"bookmark_type"`
	IsPrivate           bool      `json:"is_private" db:"is_private"`
	CreatedAt           time.Time `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time `json:"updated_at" db:"updated_at"`
}

// MeetingParticipantExtended represents extended participant information
type MeetingParticipantExtended struct {
	ID                    int       `json:"id" db:"id"`
	MeetingParticipantID  *int      `json:"meeting_participant_id" db:"meeting_participant_id"`
	ConnectionQuality     string    `json:"connection_quality" db:"connection_quality"`
	DeviceInfo            JSONB     `json:"device_info" db:"device_info"`
	BrowserInfo           JSONB     `json:"browser_info" db:"browser_info"`
	NetworkInfo           JSONB     `json:"network_info" db:"network_info"`
	PermissionsGranted    JSONB     `json:"permissions_granted" db:"permissions_granted"`
	SpeakingTimeSeconds   int       `json:"speaking_time_seconds" db:"speaking_time_seconds"`
	ChatMessagesSent      int       `json:"chat_messages_sent" db:"chat_messages_sent"`
	ReactionsSent         int       `json:"reactions_sent" db:"reactions_sent"`
	ScreenShareDuration   int       `json:"screen_share_duration" db:"screen_share_duration"`
	HandRaisesCount       int       `json:"hand_raises_count" db:"hand_raises_count"`
	LastActivityAt        time.Time `json:"last_activity_at" db:"last_activity_at"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

