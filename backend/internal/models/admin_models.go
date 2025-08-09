package models

import (
	"time"
)

// ============================================================================
// ENHANCED MODELS FOR NEW SCHEMA
// ============================================================================

// AdminInvitation represents an invitation sent to a new admin
type AdminInvitation struct {
	ID                 int        `json:"id" db:"id"`
	ClientID           int        `json:"client_id" db:"client_id"`
	Email              string     `json:"email" db:"email"`
	FirstName          string     `json:"first_name" db:"first_name"`
	LastName           string     `json:"last_name" db:"last_name"`
	Token              string     `json:"token" db:"token"`
	ExpiresAt          time.Time  `json:"expires_at" db:"expires_at"`
	Status             string     `json:"status" db:"status"` // pending, accepted, expired, cancelled
	InvitedBy          int        `json:"invited_by" db:"invited_by"`
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
	ClientID           int        `json:"client_id" db:"client_id"`
	AdminID            int        `json:"admin_id" db:"admin_id"`
	Email              string     `json:"email" db:"email"`
	FirstName          string     `json:"first_name" db:"first_name"`
	LastName           string     `json:"last_name" db:"last_name"`
	Token              string     `json:"token" db:"token"`
	ExpiresAt          time.Time  `json:"expires_at" db:"expires_at"`
	Status             string     `json:"status" db:"status"` // pending, accepted, expired, cancelled
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
	MeetingID      int        `json:"meeting_id" db:"meeting_id"`
	UserID         int        `json:"user_id" db:"user_id"`
	PermissionType string     `json:"permission_type" db:"permission_type"` // video, audio, screen, chat, recording
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
	MeetingID      int        `json:"meeting_id" db:"meeting_id"`
	UserID         int        `json:"user_id" db:"user_id"`
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
	MeetingID                 int       `json:"meeting_id" db:"meeting_id"`
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
	ID                 int       `json:"id" db:"id"`
	MeetingID          int       `json:"meeting_id" db:"meeting_id"`
	UserID             int       `json:"user_id" db:"user_id"`
	StartedSpeakingAt  time.Time `json:"started_speaking_at" db:"started_speaking_at"`
	StoppedSpeakingAt  *time.Time `json:"stopped_speaking_at" db:"stopped_speaking_at"`
	DurationSeconds    *int      `json:"duration_seconds" db:"duration_seconds"`
	AudioLevelAvg      *float64  `json:"audio_level_avg" db:"audio_level_avg"`
	AudioLevelPeak     *float64  `json:"audio_level_peak" db:"audio_level_peak"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

// UserAnalytics represents user engagement analytics
type UserAnalytics struct {
	ID                        int       `json:"id" db:"id"`
	UserID                    int       `json:"user_id" db:"user_id"`
	ClientID                  int       `json:"client_id" db:"client_id"`
	TotalMeetingsJoined       int       `json:"total_meetings_joined" db:"total_meetings_joined"`
	TotalMeetingDurationMins  int       `json:"total_meeting_duration_minutes" db:"total_meeting_duration_minutes"`
	TotalSpeakingTimeMins     int       `json:"total_speaking_time_minutes" db:"total_speaking_time_minutes"`
	TotalChatMessages         int       `json:"total_chat_messages" db:"total_chat_messages"`
	MeetingsThisWeek          int       `json:"meetings_this_week" db:"meetings_this_week"`
	MeetingsThisMonth         int       `json:"meetings_this_month" db:"meetings_this_month"`
	AverageMeetingDuration    int       `json:"average_meeting_duration" db:"average_meeting_duration"`
	MostActiveDayOfWeek       int       `json:"most_active_day_of_week" db:"most_active_day_of_week"`
	MostActiveHour            int       `json:"most_active_hour" db:"most_active_hour"`
	EngagementScore           float64   `json:"engagement_score" db:"engagement_score"`
	LastMeetingDate           *time.Time `json:"last_meeting_date" db:"last_meeting_date"`
	FirstMeetingDate          *time.Time `json:"first_meeting_date" db:"first_meeting_date"`
	PreferredMeetingDuration  int       `json:"preferred_meeting_duration" db:"preferred_meeting_duration"`
	ParticipationTrends       JSONB     `json:"participation_trends" db:"participation_trends"`
	FeatureUsageStats         JSONB     `json:"feature_usage_stats" db:"feature_usage_stats"`
	DevicePreferences         JSONB     `json:"device_preferences" db:"device_preferences"`
	CreatedAt                 time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at" db:"updated_at"`
}

// UserPreferences represents user preferences and settings
type UserPreferences struct {
	ID                         int       `json:"id" db:"id"`
	UserID                     int       `json:"user_id" db:"user_id"`
	DefaultAudioEnabled        bool      `json:"default_audio_enabled" db:"default_audio_enabled"`
	DefaultVideoEnabled        bool      `json:"default_video_enabled" db:"default_video_enabled"`
	AutoJoinAudio              bool      `json:"auto_join_audio" db:"auto_join_audio"`
	PreferredCameraDevice      *string   `json:"preferred_camera_device" db:"preferred_camera_device"`
	PreferredMicrophoneDevice  *string   `json:"preferred_microphone_device" db:"preferred_microphone_device"`
	PreferredSpeakerDevice     *string   `json:"preferred_speaker_device" db:"preferred_speaker_device"`
	NotificationEmailEnabled   bool      `json:"notification_email_enabled" db:"notification_email_enabled"`
	NotificationBrowserEnabled bool      `json:"notification_browser_enabled" db:"notification_browser_enabled"`
	NotificationMeetingReminders bool    `json:"notification_meeting_reminders" db:"notification_meeting_reminders"`
	NotificationChatMessages   bool      `json:"notification_chat_messages" db:"notification_chat_messages"`
	NotificationMeetingInvites bool      `json:"notification_meeting_invites" db:"notification_meeting_invites"`
	ThemePreference            string    `json:"theme_preference" db:"theme_preference"` // light, dark, system
	LanguagePreference         string    `json:"language_preference" db:"language_preference"`
	TimezonePreference         string    `json:"timezone_preference" db:"timezone_preference"`
	MeetingViewPreference      string    `json:"meeting_view_preference" db:"meeting_view_preference"` // grid, speaker, gallery
	ChatPosition               string    `json:"chat_position" db:"chat_position"` // right, bottom, floating
	ShowParticipantNames       bool      `json:"show_participant_names" db:"show_participant_names"`
	ShowConnectionQuality      bool      `json:"show_connection_quality" db:"show_connection_quality"`
	AutoHideControls           bool      `json:"auto_hide_controls" db:"auto_hide_controls"`
	KeyboardShortcutsEnabled   bool      `json:"keyboard_shortcuts_enabled" db:"keyboard_shortcuts_enabled"`
	HighContrastMode           bool      `json:"high_contrast_mode" db:"high_contrast_mode"`
	ReduceMotion               bool      `json:"reduce_motion" db:"reduce_motion"`
	CreatedAt                  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at" db:"updated_at"`
}

// UserMeetingBookmark represents a bookmark in a meeting recording
type UserMeetingBookmark struct {
	ID                  int       `json:"id" db:"id"`
	UserID              int       `json:"user_id" db:"user_id"`
	MeetingID           int       `json:"meeting_id" db:"meeting_id"`
	BookmarkTimeSeconds int       `json:"bookmark_time_seconds" db:"bookmark_time_seconds"`
	BookmarkTitle       *string   `json:"bookmark_title" db:"bookmark_title"`
	BookmarkDescription *string   `json:"bookmark_description" db:"bookmark_description"`
	BookmarkType        string    `json:"bookmark_type" db:"bookmark_type"` // important, action_item, decision, question, note
	IsPrivate           bool      `json:"is_private" db:"is_private"`
	CreatedAt           time.Time `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time `json:"updated_at" db:"updated_at"`
}

// MeetingParticipantExtended represents extended participant information
type MeetingParticipantExtended struct {
	ID                    int       `json:"id" db:"id"`
	MeetingParticipantID  int       `json:"meeting_participant_id" db:"meeting_participant_id"`
	ConnectionQuality     string    `json:"connection_quality" db:"connection_quality"` // excellent, good, fair, poor
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

// ============================================================================
// ENHANCED CLIENT MODEL
// ============================================================================

// EnhancedClient extends the basic Client model with new organization features
type EnhancedClient struct {
	Client // Embed basic client fields
	
	// Enhanced organization features
	OrganizationName     string     `json:"organization_name" db:"organization_name"`
	OrganizationType     string     `json:"organization_type" db:"organization_type"` // enterprise, business, education, nonprofit
	SubscriptionPlan     string     `json:"subscription_plan" db:"subscription_plan"` // free, basic, premium, enterprise
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at" db:"subscription_expires_at"`
	MaxAdmins            int        `json:"max_admins" db:"max_admins"`
	MaxUsers             int        `json:"max_users" db:"max_users"`
	MaxConcurrentMeetings int       `json:"max_concurrent_meetings" db:"max_concurrent_meetings"`
	StorageLimitGB       int        `json:"storage_limit_gb" db:"storage_limit_gb"`
	
	// Security and SSO
	CustomDomain         *string   `json:"custom_domain" db:"custom_domain"`
	SSOEnabled           bool      `json:"sso_enabled" db:"sso_enabled"`
	SSOConfig            JSONB     `json:"sso_config" db:"sso_config"`
	BrandingConfig       JSONB     `json:"branding_config" db:"branding_config"`
	SecuritySettings     JSONB     `json:"security_settings" db:"security_settings"`
	
	// Contact information
	BillingContactEmail   *string `json:"billing_contact_email" db:"billing_contact_email"`
	TechnicalContactEmail *string `json:"technical_contact_email" db:"technical_contact_email"`
	Timezone              string  `json:"timezone" db:"timezone"`
	BusinessHours         JSONB   `json:"business_hours" db:"business_hours"`
	
	// Status and trial
	IsActive     bool       `json:"is_active" db:"is_active"`
	TrialEndsAt  *time.Time `json:"trial_ends_at" db:"trial_ends_at"`
	CreatedBy    *int       `json:"created_by" db:"created_by"`
}

// ============================================================================
// ENHANCED USER MODEL
// ============================================================================

// EnhancedUser extends the basic User model with new authentication features
type EnhancedUser struct {
	User // Embed basic user fields
	
	// Role-based access control
	ClientID *int `json:"client_id" db:"client_id"` // NULL for super_admin
	
	// Invitation and authentication features
	InvitationToken     *string    `json:"invitation_token" db:"invitation_token"`
	InvitationExpiresAt *time.Time `json:"invitation_expires_at" db:"invitation_expires_at"`
	IsInvited           bool       `json:"is_invited" db:"is_invited"`
	PasswordCreated     bool       `json:"password_created" db:"password_created"`
	
	// Multi-Factor Authentication
	TwoFactorEnabled bool    `json:"two_factor_enabled" db:"two_factor_enabled"`
	TwoFactorSecret  *string `json:"two_factor_secret,omitempty" db:"two_factor_secret"`
	
	// Security features
	LoginAttempts          int        `json:"login_attempts" db:"login_attempts"`
	LockedUntil           *time.Time `json:"locked_until" db:"locked_until"`
	PasswordResetToken    *string    `json:"password_reset_token" db:"password_reset_token"`
	PasswordResetExpires  *time.Time `json:"password_reset_expires" db:"password_reset_expires"`
	LastPasswordChange    *time.Time `json:"last_password_change" db:"last_password_change"`
	ForcePasswordChange   bool       `json:"force_password_change" db:"force_password_change"`
	
	// Email verification
	EmailVerified            bool    `json:"email_verified" db:"email_verified"`
	EmailVerificationToken   *string `json:"email_verification_token" db:"email_verification_token"`
	
	// User preferences
	Timezone                 string `json:"timezone" db:"timezone"`
	Language                 string `json:"language" db:"language"`
	NotificationPreferences  JSONB  `json:"notification_preferences" db:"notification_preferences"`
}

// ============================================================================
// ENHANCED MEETING MODEL
// ============================================================================

// EnhancedMeeting extends the basic Meeting model with comprehensive meeting management
type EnhancedMeeting struct {
	Meeting // Embed basic meeting fields
	
	// Meeting type and buffer times
	MeetingType        string `json:"meeting_type" db:"meeting_type"` // instant, scheduled, recurring
	BufferStartMinutes int    `json:"buffer_start_minutes" db:"buffer_start_minutes"` // Allow joining N minutes early
	BufferEndMinutes   int    `json:"buffer_end_minutes" db:"buffer_end_minutes"`     // Allow joining N minutes after end
	
	// Enhanced meeting control
	IsActive                   bool   `json:"is_active" db:"is_active"`
	AdminOnlyControls          bool   `json:"admin_only_controls" db:"admin_only_controls"`
	WaitingRoomEnabled         bool   `json:"waiting_room_enabled" db:"waiting_room_enabled"`
	AutoAdmitUsers             bool   `json:"auto_admit_users" db:"auto_admit_users"`
	LockMeeting                bool   `json:"lock_meeting" db:"lock_meeting"`
	MuteParticipantsOnJoin     bool   `json:"mute_participants_on_join" db:"mute_participants_on_join"`
	DisableVideoOnJoin         bool   `json:"disable_video_on_join" db:"disable_video_on_join"`
	AllowScreenSharing         bool   `json:"allow_screen_sharing" db:"allow_screen_sharing"`
	RecordingAutoStart         bool   `json:"recording_auto_start" db:"recording_auto_start"`
	ChatEnabled                bool   `json:"chat_enabled" db:"chat_enabled"`
	RaiseHandEnabled           bool   `json:"raise_hand_enabled" db:"raise_hand_enabled"`
	BreakoutRoomsEnabled       bool   `json:"breakout_rooms_enabled" db:"breakout_rooms_enabled"`
	MaxDurationMinutes         int    `json:"max_duration_minutes" db:"max_duration_minutes"`
	
	// Security features
	RequireMeetingPassword     bool    `json:"require_meeting_password" db:"require_meeting_password"`
	ParticipantJoinApproval    bool    `json:"participant_join_approval" db:"participant_join_approval"`
	AllowAnonymousUsers        bool    `json:"allow_anonymous_users" db:"allow_anonymous_users"`
	
	// Meeting configuration
	LobbyMessage               *string `json:"lobby_message" db:"lobby_message"`
	EntryExitChime            bool    `json:"entry_exit_chime" db:"entry_exit_chime"`
	
	// Calendar integration
	CalendarEventID           *string `json:"calendar_event_id" db:"calendar_event_id"`
	GoogleMeetLink            *string `json:"google_meet_link" db:"google_meet_link"`
	ZoomMeetingID             *string `json:"zoom_meeting_id" db:"zoom_meeting_id"`
	TeamsMeetingURL           *string `json:"teams_meeting_url" db:"teams_meeting_url"`
	
	// Recording and compliance
	RecordingConsentRequired  bool      `json:"recording_consent_required" db:"recording_consent_required"`
	DataRetentionDays         int       `json:"data_retention_days" db:"data_retention_days"`
	MeetingNotes              *string   `json:"meeting_notes" db:"meeting_notes"`
	MeetingSummary            JSONB     `json:"meeting_summary" db:"meeting_summary"`
	QualityRating             *int      `json:"quality_rating" db:"quality_rating"`
	FeedbackComments          *string   `json:"feedback_comments" db:"feedback_comments"`
	
	// Recurring meetings
	RecurringPattern          JSONB     `json:"recurring_pattern" db:"recurring_pattern"`
	ParentMeetingID           *int      `json:"parent_meeting_id" db:"parent_meeting_id"`
	OccurrenceDate            *time.Time `json:"occurrence_date" db:"occurrence_date"`
	
	// Cancellation tracking
	IsCancelled               bool      `json:"is_cancelled" db:"is_cancelled"`
	CancellationReason        *string   `json:"cancellation_reason" db:"cancellation_reason"`
	CancelledBy               *int      `json:"cancelled_by" db:"cancelled_by"`
	CancelledAt               *time.Time `json:"cancelled_at" db:"cancelled_at"`
}

// ============================================================================
// REQUEST/RESPONSE MODELS
// ============================================================================

// AdminInvitationRequest represents a request to invite an admin
type AdminInvitationRequest struct {
	ClientID  int    `json:"client_id" validate:"required"`
	Email     string `json:"email" validate:"required,email"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Message   string `json:"message,omitempty"`
}

// UserInvitationRequest represents a request to invite a user
type UserInvitationRequest struct {
	Email           string `json:"email" validate:"required,email"`
	FirstName       string `json:"first_name" validate:"required"`
	LastName        string `json:"last_name" validate:"required"`
	WelcomeMessage  string `json:"welcome_message,omitempty"`
}

// PermissionRequest represents a permission request from a user
type PermissionRequest struct {
	MeetingID       int    `json:"meeting_id" validate:"required"`
	UserID          int    `json:"user_id" validate:"required"`
	PermissionType  string `json:"permission_type" validate:"required,oneof=video audio screen chat recording"`
	RequestMessage  string `json:"request_message,omitempty"`
}

// InstantMeetingRequest represents a request to create an instant meeting
type InstantMeetingRequest struct {
	Title               string            `json:"title" validate:"required"`
	Description         string            `json:"description,omitempty"`
	MaxParticipants     int               `json:"max_participants,omitempty"`
	Password            string            `json:"password,omitempty"`
	ParticipantEmails   []string          `json:"participant_emails,omitempty"`
	GroupIDs            []int             `json:"group_ids,omitempty"`
	MeetingSettings     *MeetingSettings  `json:"meeting_settings,omitempty"`
	SendInvitations     bool              `json:"send_invitations"`
	AutoStart           bool              `json:"auto_start"`
}

// ScheduledMeetingRequest represents a request to create a scheduled meeting
type ScheduledMeetingRequest struct {
	Title               string            `json:"title" validate:"required"`
	Description         string            `json:"description,omitempty"`
	ScheduledStart      time.Time         `json:"scheduled_start" validate:"required"`
	ScheduledEnd        time.Time         `json:"scheduled_end" validate:"required"`
	MaxParticipants     int               `json:"max_participants,omitempty"`
	Password            string            `json:"password,omitempty"`
	ParticipantEmails   []string          `json:"participant_emails,omitempty"`
	GroupIDs            []int             `json:"group_ids,omitempty"`
	MeetingSettings     *MeetingSettings  `json:"meeting_settings,omitempty"`
	SendInvitations     bool              `json:"send_invitations"`
	SendCalendarEvents  bool              `json:"send_calendar_events"`
	ReminderSettings    *ReminderSettings `json:"reminder_settings,omitempty"`
}

// MeetingSettings represents comprehensive meeting configuration
type MeetingSettings struct {
	WaitingRoomEnabled      bool `json:"waiting_room_enabled"`
	AutoAdmitUsers          bool `json:"auto_admit_users"`
	MuteParticipantsOnJoin  bool `json:"mute_participants_on_join"`
	DisableVideoOnJoin      bool `json:"disable_video_on_join"`
	AllowScreenSharing      bool `json:"allow_screen_sharing"`
	ChatEnabled             bool `json:"chat_enabled"`
	RaiseHandEnabled        bool `json:"raise_hand_enabled"`
	RecordingAutoStart      bool `json:"recording_auto_start"`
	BreakoutRoomsEnabled    bool `json:"breakout_rooms_enabled"`
	MaxDurationMinutes      int  `json:"max_duration_minutes"`
	RequireAdminApproval    bool `json:"require_admin_approval"`
}

// ReminderSettings represents meeting reminder configuration
type ReminderSettings struct {
	SendReminders    bool   `json:"send_reminders"`
	ReminderMinutes  []int  `json:"reminder_minutes"` // e.g., [1440, 60, 15] for 1 day, 1 hour, 15 minutes
}

// ============================================================================
// CONSTANTS FOR ENHANCED MODELS
// ============================================================================

// Admin invitation status constants
const (
	AdminInvitationStatusPending   = "pending"
	AdminInvitationStatusAccepted  = "accepted"
	AdminInvitationStatusExpired   = "expired"
	AdminInvitationStatusCancelled = "cancelled"
)

// User invitation status constants
const (
	UserInvitationStatusPending   = "pending"
	UserInvitationStatusAccepted  = "accepted"
	UserInvitationStatusExpired   = "expired"
	UserInvitationStatusCancelled = "cancelled"
)

// Permission type constants
const (
	PermissionTypeVideo     = "video"
	PermissionTypeAudio     = "audio"
	PermissionTypeScreen    = "screen"
	PermissionTypeChat      = "chat"
	PermissionTypeRecording = "recording"
)

// Meeting type constants
const (
	MeetingTypeInstant    = "instant"
	MeetingTypeScheduled  = "scheduled"
	MeetingTypeRecurring  = "recurring"
)

// User status constants
const (
	UserStatusActive    = "active"
	UserStatusInactive  = "inactive"
	UserStatusPending   = "pending"
	UserStatusSuspended = "suspended"
	UserStatusLocked    = "locked"
)

// Organization type constants
const (
	OrganizationTypeEnterprise = "enterprise"
	OrganizationTypeBusiness   = "business"
	OrganizationTypeEducation  = "education"
	OrganizationTypeNonprofit  = "nonprofit"
)

// Subscription plan constants
const (
	SubscriptionPlanFree       = "free"
	SubscriptionPlanBasic      = "basic"
	SubscriptionPlanPremium    = "premium"
	SubscriptionPlanEnterprise = "enterprise"
)

// Bookmark type constants
const (
	BookmarkTypeImportant   = "important"
	BookmarkTypeActionItem  = "action_item"
	BookmarkTypeDecision    = "decision"
	BookmarkTypeQuestion    = "question"
	BookmarkTypeNote        = "note"
)

// Connection quality constants
const (
	ConnectionQualityExcellent = "excellent"
	ConnectionQualityGood      = "good"
	ConnectionQualityFair      = "fair"
	ConnectionQualityPoor      = "poor"
)