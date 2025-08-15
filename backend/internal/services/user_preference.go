package services

import (
	"context"
	"fmt"
	"time"

	"video-conference-backend/prisma/db"
	"video-conference-backend/prisma/db"
)

// UserPreferenceService interface defines user preferences and settings methods
type UserPreferenceService interface {
	// Core preference management
	GetUserPreferences(ctx context.Context, userID int) (*db.UserPreference, error)
	UpdateUserPreferences(ctx context.Context, userID int, updates *db.UserPreference) (*db.UserPreference, error)

	// Default settings management
	GetDefaultPreferences(ctx context.Context, organizationID int) (*db.UserPreference, error)
	SetOrganizationDefaults(ctx context.Context, organizationID int, defaults *db.UserPreference) error

	// Meeting settings
	GetDefaultMeetingSettings(ctx context.Context, userID int) (*MeetingSettings, error)
	UpdateMeetingSettings(ctx context.Context, userID int, settings *MeetingSettings) error

	// Notification preferences
	GetNotificationPreferences(ctx context.Context, userID int) (*NotificationPreferences, error)
	UpdateNotificationPreferences(ctx context.Context, userID int, prefs *NotificationPreferences) error

	// Device synchronization
	SynchronizeDevicePreferences(ctx context.Context, userID int, deviceID string, preferences *DevicePreferences) error
	GetDevicePreferences(ctx context.Context, userID int, deviceID string) (*DevicePreferences, error)

	// Profile settings
	GetProfileSettings(ctx context.Context, userID int) (*ProfileSettings, error)
	UpdateProfileSettings(ctx context.Context, userID int, settings *ProfileSettings) error

	// Privacy settings
	GetPrivacySettings(ctx context.Context, userID int) (*PrivacySettings, error)
	UpdatePrivacySettings(ctx context.Context, userID int, settings *PrivacySettings) error
}

// userPreferenceService handles user-specific settings and preferences
type userPreferenceService struct {
	db *db.DB
}

// NewUserPreferenceService creates a new user preference service
func NewUserPreferenceService(db *db.DB) UserPreferenceService {
	return &userPreferenceService{
		db: db,
	}
}

// GetUserPreferences retrieves user preferences (interface method)
func (s *userPreferenceService) GetUserPreferences(ctx context.Context, userID int) (*db.UserPreference, error) {
	return s.GetUserPreferencesFromDB(ctx, userID)
}

// GetUserPreferencesFromDB retrieves preferences for a specific user from database
func (s *userPreferenceService) GetUserPreferencesFromDB(ctx context.Context, userID int) (*db.UserPreference, error) {
	var prefs db.UserPreference
	query := `SELECT * FROM user_preferences WHERE user_id = $1`

	err := s.db.GetContext(ctx, &prefs, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}

	return &prefs, nil
}

// UpdateUserPreferences updates preferences for a specific user
func (s *userPreferenceService) UpdateUserPreferences(ctx context.Context, userID int, updates *db.UserPreference) (*db.UserPreference, error) {
	// This is a simplified update. In a real app, you'd build a dynamic update query
	// based on which fields are provided in `updates`.
	query := `
		INSERT INTO user_preferences (user_id, default_audio_enabled, default_video_enabled, auto_join_audio, 
			preferred_camera_device, preferred_microphone_device, preferred_speaker_device, 
			notification_email_enabled, notification_browser_enabled, notification_meeting_reminders, 
			notification_chat_messages, notification_meeting_invites, theme_preference, 
			language_preference, timezone_preference, meeting_view_preference, chat_position, 
			show_participant_names, show_connection_quality, auto_hide_controls, 
			keyboard_shortcuts_enabled, high_contrast_mode, reduce_motion, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE SET
			default_audio_enabled = $2, default_video_enabled = $3, auto_join_audio = $4,
			preferred_camera_device = $5, preferred_microphone_device = $6, preferred_speaker_device = $7,
			notification_email_enabled = $8, notification_browser_enabled = $9, notification_meeting_reminders = $10,
			notification_chat_messages = $11, notification_meeting_invites = $12, theme_preference = $13,
			language_preference = $14, timezone_preference = $15, meeting_view_preference = $16, chat_position = $17,
			show_participant_names = $18, show_connection_quality = $19, auto_hide_controls = $20,
			keyboard_shortcuts_enabled = $21, high_contrast_mode = $22, reduce_motion = $23, updated_at = CURRENT_TIMESTAMP
		RETURNING *
	`

	err := s.db.GetContext(ctx, updates, query,
		userID,
		updates.DefaultAudioEnabled,
		updates.DefaultVideoEnabled,
		updates.AutoJoinAudio,
		updates.PreferredCameraDevice,
		updates.PreferredMicrophoneDevice,
		updates.PreferredSpeakerDevice,
		updates.NotificationEmailEnabled,
		updates.NotificationBrowserEnabled,
		updates.NotificationMeetingReminders,
		updates.NotificationChatMessages,
		updates.NotificationMeetingInvites,
		updates.ThemePreference,
		updates.LanguagePreference,
		updates.TimezonePreference,
		updates.MeetingViewPreference,
		updates.ChatPosition,
		updates.ShowParticipantNames,
		updates.ShowConnectionQuality,
		updates.AutoHideControls,
		updates.KeyboardShortcutsEnabled,
		updates.HighContrastMode,
		updates.ReduceMotion,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user preferences: %w", err)
	}

	return updates, nil
}

// ============================================================================
// STRUCTURED PREFERENCE TYPES
// ============================================================================

// MeetingSettings represents user's default meeting preferences
type MeetingSettings struct {
	ID                       int       `json:"id" db:"id"`
	UserID                   int       `json:"user_id" db:"user_id"`
	DefaultAudioEnabled      bool      `json:"default_audio_enabled" db:"default_audio_enabled"`
	DefaultVideoEnabled      bool      `json:"default_video_enabled" db:"default_video_enabled"`
	AutoJoinAudio            bool      `json:"auto_join_audio" db:"auto_join_audio"`
	PreferredCameraDevice    string    `json:"preferred_camera_device" db:"preferred_camera_device"`
	PreferredMicDevice       string    `json:"preferred_microphone_device" db:"preferred_microphone_device"`
	PreferredSpeakerDevice   string    `json:"preferred_speaker_device" db:"preferred_speaker_device"`
	MeetingViewPreference    string    `json:"meeting_view_preference" db:"meeting_view_preference"`
	ChatPosition             string    `json:"chat_position" db:"chat_position"`
	ShowParticipantNames     bool      `json:"show_participant_names" db:"show_participant_names"`
	ShowConnectionQuality    bool      `json:"show_connection_quality" db:"show_connection_quality"`
	AutoHideControls         bool      `json:"auto_hide_controls" db:"auto_hide_controls"`
	KeyboardShortcutsEnabled bool      `json:"keyboard_shortcuts_enabled" db:"keyboard_shortcuts_enabled"`
	BackgroundBlurEnabled    bool      `json:"background_blur_enabled" db:"background_blur_enabled"`
	VirtualBackgroundURL     string    `json:"virtual_background_url" db:"virtual_background_url"`
	CreatedAt                time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time `json:"updated_at" db:"updated_at"`
}

// NotificationPreferences represents user's notification settings
type NotificationPreferences struct {
	ID                    int       `json:"id" db:"id"`
	UserID                int       `json:"user_id" db:"user_id"`
	EmailEnabled          bool      `json:"email_enabled" db:"notification_email_enabled"`
	BrowserEnabled        bool      `json:"browser_enabled" db:"notification_browser_enabled"`
	MobileEnabled         bool      `json:"mobile_enabled" db:"notification_mobile_enabled"`
	MeetingReminders      bool      `json:"meeting_reminders" db:"notification_meeting_reminders"`
	ChatMessages          bool      `json:"chat_messages" db:"notification_chat_messages"`
	MeetingInvites        bool      `json:"meeting_invites" db:"notification_meeting_invites"`
	SystemUpdates         bool      `json:"system_updates" db:"notification_system_updates"`
	ParticipantJoinLeave  bool      `json:"participant_join_leave" db:"notification_participant_activity"`
	PermissionRequests    bool      `json:"permission_requests" db:"notification_permission_requests"`
	HandRaises            bool      `json:"hand_raises" db:"notification_hand_raises"`
	ReminderMinutesBefore []int     `json:"reminder_minutes_before" db:"-"`
	QuietHoursStart       string    `json:"quiet_hours_start" db:"quiet_hours_start"`
	QuietHoursEnd         string    `json:"quiet_hours_end" db:"quiet_hours_end"`
	WeekendNotifications  bool      `json:"weekend_notifications" db:"weekend_notifications"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}

// DevicePreferences represents device-specific preferences
type DevicePreferences struct {
	ID                 int       `json:"id" db:"id"`
	UserID             int       `json:"user_id" db:"user_id"`
	DeviceID           string    `json:"device_id" db:"device_id"`
	DeviceType         string    `json:"device_type" db:"device_type"` // desktop, mobile, tablet
	DeviceName         string    `json:"device_name" db:"device_name"`
	CameraDeviceID     string    `json:"camera_device_id" db:"camera_device_id"`
	MicrophoneDeviceID string    `json:"microphone_device_id" db:"microphone_device_id"`
	SpeakerDeviceID    string    `json:"speaker_device_id" db:"speaker_device_id"`
	VideoQuality       string    `json:"video_quality" db:"video_quality"`
	AudioQuality       string    `json:"audio_quality" db:"audio_quality"`
	BandwidthLimit     int       `json:"bandwidth_limit" db:"bandwidth_limit"`
	LastSyncedAt       time.Time `json:"last_synced_at" db:"last_synced_at"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// ProfileSettings represents user's profile display preferences
type ProfileSettings struct {
	ID                   int       `json:"id" db:"id"`
	UserID               int       `json:"user_id" db:"user_id"`
	DisplayName          string    `json:"display_name" db:"display_name"`
	ProfilePictureURL    string    `json:"profile_picture_url" db:"profile_picture_url"`
	Status               string    `json:"status" db:"status"`
	StatusMessage        string    `json:"status_message" db:"status_message"`
	TimezonePreference   string    `json:"timezone_preference" db:"timezone_preference"`
	LanguagePreference   string    `json:"language_preference" db:"language_preference"`
	DateFormatPreference string    `json:"date_format_preference" db:"date_format_preference"`
	TimeFormatPreference string    `json:"time_format_preference" db:"time_format_preference"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

// PrivacySettings represents user's privacy preferences
type PrivacySettings struct {
	ID                      int       `json:"id" db:"id"`
	UserID                  int       `json:"user_id" db:"user_id"`
	ShowOnlineStatus        bool      `json:"show_online_status" db:"show_online_status"`
	AllowDirectMessages     bool      `json:"allow_direct_messages" db:"allow_direct_messages"`
	ShareParticipationStats bool      `json:"share_participation_stats" db:"share_participation_stats"`
	DataCollectionConsent   bool      `json:"data_collection_consent" db:"data_collection_consent"`
	AllowRecordingConsent   bool      `json:"allow_recording_consent" db:"allow_recording_consent"`
	SharePresenceInfo       bool      `json:"share_presence_info" db:"share_presence_info"`
	AllowMeetingAnalytics   bool      `json:"allow_meeting_analytics" db:"allow_meeting_analytics"`
	CreatedAt               time.Time `json:"created_at" db:"created_at"`
	UpdatedAt               time.Time `json:"updated_at" db:"updated_at"`
}

// ============================================================================
// DEFAULT PREFERENCES MANAGEMENT
// ============================================================================

// GetDefaultPreferences retrieves organization-wide default preferences
func (s *userPreferenceService) GetDefaultPreferences(ctx context.Context, organizationID int) (*db.UserPreference, error) {
	var prefs db.UserPreference
	query := `
		SELECT * FROM organization_default_preferences 
		WHERE organization_id = $1`

	err := s.db.GetContext(ctx, &prefs, query, organizationID)
	if err != nil {
		// Return system defaults if organization defaults don't exist
		return s.getSystemDefaults(), nil
	}

	return &prefs, nil
}

// SetOrganizationDefaults sets default preferences for an organization
func (s *userPreferenceService) SetOrganizationDefaults(ctx context.Context, organizationID int, defaults *db.UserPreference) error {
	query := `
		INSERT INTO organization_default_preferences (
			organization_id, default_audio_enabled, default_video_enabled, auto_join_audio, 
			preferred_camera_device, preferred_microphone_device, preferred_speaker_device, 
			notification_email_enabled, notification_browser_enabled, notification_meeting_reminders, 
			notification_chat_messages, notification_meeting_invites, theme_preference, 
			language_preference, timezone_preference, meeting_view_preference, chat_position, 
			show_participant_names, show_connection_quality, auto_hide_controls, 
			keyboard_shortcuts_enabled, high_contrast_mode, reduce_motion, 
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 
			$18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		) ON CONFLICT (organization_id) DO UPDATE SET
			default_audio_enabled = $2, default_video_enabled = $3, auto_join_audio = $4,
			preferred_camera_device = $5, preferred_microphone_device = $6, preferred_speaker_device = $7,
			notification_email_enabled = $8, notification_browser_enabled = $9, notification_meeting_reminders = $10,
			notification_chat_messages = $11, notification_meeting_invites = $12, theme_preference = $13,
			language_preference = $14, timezone_preference = $15, meeting_view_preference = $16, chat_position = $17,
			show_participant_names = $18, show_connection_quality = $19, auto_hide_controls = $20,
			keyboard_shortcuts_enabled = $21, high_contrast_mode = $22, reduce_motion = $23, 
			updated_at = CURRENT_TIMESTAMP`

	_, err := s.db.ExecContext(ctx, query,
		organizationID,
		defaults.DefaultAudioEnabled,
		defaults.DefaultVideoEnabled,
		defaults.AutoJoinAudio,
		defaults.PreferredCameraDevice,
		defaults.PreferredMicrophoneDevice,
		defaults.PreferredSpeakerDevice,
		defaults.NotificationEmailEnabled,
		defaults.NotificationBrowserEnabled,
		defaults.NotificationMeetingReminders,
		defaults.NotificationChatMessages,
		defaults.NotificationMeetingInvites,
		defaults.ThemePreference,
		defaults.LanguagePreference,
		defaults.TimezonePreference,
		defaults.MeetingViewPreference,
		defaults.ChatPosition,
		defaults.ShowParticipantNames,
		defaults.ShowConnectionQuality,
		defaults.AutoHideControls,
		defaults.KeyboardShortcutsEnabled,
		defaults.HighContrastMode,
		defaults.ReduceMotion,
	)

	return err
}

func (s *userPreferenceService) getSystemDefaults() *db.UserPreference {
	return &db.UserPreference{
		DefaultAudioEnabled:          true,
		DefaultVideoEnabled:          false,
		AutoJoinAudio:                false,
		PreferredCameraDevice:        nil,
		PreferredMicrophoneDevice:    nil,
		PreferredSpeakerDevice:       nil,
		NotificationEmailEnabled:     true,
		NotificationBrowserEnabled:   true,
		NotificationMeetingReminders: true,
		NotificationChatMessages:     true,
		NotificationMeetingInvites:   true,
		ThemePreference:              "system",
		LanguagePreference:           "en-US",
		TimezonePreference:           "UTC",
		MeetingViewPreference:        "grid",
		ChatPosition:                 "right",
		ShowParticipantNames:         true,
		ShowConnectionQuality:        true,
		AutoHideControls:             false,
		KeyboardShortcutsEnabled:     true,
		HighContrastMode:             false,
		ReduceMotion:                 false,
	}
}

// ============================================================================
// MEETING SETTINGS MANAGEMENT
// ============================================================================

// GetDefaultMeetingSettings retrieves user's meeting settings
func (s *userPreferenceService) GetDefaultMeetingSettings(ctx context.Context, userID int) (*MeetingSettings, error) {
	var settings MeetingSettings
	query := `
		SELECT id, user_id, default_audio_enabled, default_video_enabled, auto_join_audio,
			   preferred_camera_device, preferred_microphone_device, preferred_speaker_device,
			   meeting_view_preference, chat_position, show_participant_names, 
			   show_connection_quality, auto_hide_controls, keyboard_shortcuts_enabled,
			   background_blur_enabled, virtual_background_url, created_at, updated_at
		FROM user_meeting_settings WHERE user_id = $1`

	err := s.db.GetContext(ctx, &settings, query, userID)
	if err != nil {
		// Create default settings if none exist
		return s.createDefaultMeetingSettings(ctx, userID)
	}

	return &settings, nil
}

func (s *userPreferenceService) createDefaultMeetingSettings(ctx context.Context, userID int) (*MeetingSettings, error) {
	settings := &MeetingSettings{
		UserID:                   userID,
		DefaultAudioEnabled:      true,
		DefaultVideoEnabled:      false,
		AutoJoinAudio:            false,
		MeetingViewPreference:    "grid",
		ChatPosition:             "right",
		ShowParticipantNames:     true,
		ShowConnectionQuality:    true,
		AutoHideControls:         false,
		KeyboardShortcutsEnabled: true,
		BackgroundBlurEnabled:    false,
	}

	query := `
		INSERT INTO user_meeting_settings (
			user_id, default_audio_enabled, default_video_enabled, auto_join_audio,
			meeting_view_preference, chat_position, show_participant_names, 
			show_connection_quality, auto_hide_controls, keyboard_shortcuts_enabled,
			background_blur_enabled, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.QueryRowContext(ctx, query,
		settings.UserID, settings.DefaultAudioEnabled, settings.DefaultVideoEnabled,
		settings.AutoJoinAudio, settings.MeetingViewPreference, settings.ChatPosition,
		settings.ShowParticipantNames, settings.ShowConnectionQuality, settings.AutoHideControls,
		settings.KeyboardShortcutsEnabled, settings.BackgroundBlurEnabled,
	).Scan(&settings.ID, &settings.CreatedAt, &settings.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create default meeting settings: %w", err)
	}

	return settings, nil
}

// UpdateMeetingSettings updates user's meeting settings
func (s *userPreferenceService) UpdateMeetingSettings(ctx context.Context, userID int, settings *MeetingSettings) error {
	query := `
		UPDATE user_meeting_settings SET
			default_audio_enabled = $2, default_video_enabled = $3, auto_join_audio = $4,
			preferred_camera_device = $5, preferred_microphone_device = $6, preferred_speaker_device = $7,
			meeting_view_preference = $8, chat_position = $9, show_participant_names = $10,
			show_connection_quality = $11, auto_hide_controls = $12, keyboard_shortcuts_enabled = $13,
			background_blur_enabled = $14, virtual_background_url = $15, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1`

	_, err := s.db.ExecContext(ctx, query,
		userID, settings.DefaultAudioEnabled, settings.DefaultVideoEnabled, settings.AutoJoinAudio,
		settings.PreferredCameraDevice, settings.PreferredMicDevice, settings.PreferredSpeakerDevice,
		settings.MeetingViewPreference, settings.ChatPosition, settings.ShowParticipantNames,
		settings.ShowConnectionQuality, settings.AutoHideControls, settings.KeyboardShortcutsEnabled,
		settings.BackgroundBlurEnabled, settings.VirtualBackgroundURL)

	if err != nil {
		return fmt.Errorf("failed to update meeting settings: %w", err)
	}

	return nil
}

// ============================================================================
// NOTIFICATION PREFERENCES MANAGEMENT
// ============================================================================

// GetNotificationPreferences retrieves user's notification settings
func (s *userPreferenceService) GetNotificationPreferences(ctx context.Context, userID int) (*NotificationPreferences, error) {
	var prefs NotificationPreferences
	query := `
		SELECT id, user_id, notification_email_enabled, notification_browser_enabled, 
			   notification_mobile_enabled, notification_meeting_reminders, notification_chat_messages,
			   notification_meeting_invites, notification_system_updates, notification_participant_activity,
			   notification_permission_requests, notification_hand_raises, quiet_hours_start, 
			   quiet_hours_end, weekend_notifications, created_at, updated_at
		FROM user_notification_preferences WHERE user_id = $1`

	err := s.db.GetContext(ctx, &prefs, query, userID)
	if err != nil {
		return s.createDefaultNotificationPreferences(ctx, userID)
	}

	// Load reminder minutes from separate table
	var reminderMinutes []int
	reminderQuery := `SELECT minutes_before FROM user_reminder_preferences WHERE user_id = $1 ORDER BY minutes_before`
	err = s.db.SelectContext(ctx, &reminderMinutes, reminderQuery, userID)
	if err == nil {
		prefs.ReminderMinutesBefore = reminderMinutes
	}

	return &prefs, nil
}

func (s *userPreferenceService) createDefaultNotificationPreferences(ctx context.Context, userID int) (*NotificationPreferences, error) {
	prefs := &NotificationPreferences{
		UserID:                userID,
		EmailEnabled:          true,
		BrowserEnabled:        true,
		MobileEnabled:         true,
		MeetingReminders:      true,
		ChatMessages:          true,
		MeetingInvites:        true,
		SystemUpdates:         false,
		ParticipantJoinLeave:  false,
		PermissionRequests:    true,
		HandRaises:            true,
		ReminderMinutesBefore: []int{15, 5},
		QuietHoursStart:       "22:00",
		QuietHoursEnd:         "08:00",
		WeekendNotifications:  true,
	}

	query := `
		INSERT INTO user_notification_preferences (
			user_id, notification_email_enabled, notification_browser_enabled, notification_mobile_enabled,
			notification_meeting_reminders, notification_chat_messages, notification_meeting_invites,
			notification_system_updates, notification_participant_activity, notification_permission_requests,
			notification_hand_raises, quiet_hours_start, quiet_hours_end, weekend_notifications,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.QueryRowContext(ctx, query,
		prefs.UserID, prefs.EmailEnabled, prefs.BrowserEnabled, prefs.MobileEnabled,
		prefs.MeetingReminders, prefs.ChatMessages, prefs.MeetingInvites, prefs.SystemUpdates,
		prefs.ParticipantJoinLeave, prefs.PermissionRequests, prefs.HandRaises,
		prefs.QuietHoursStart, prefs.QuietHoursEnd, prefs.WeekendNotifications,
	).Scan(&prefs.ID, &prefs.CreatedAt, &prefs.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create default notification preferences: %w", err)
	}

	// Insert default reminder preferences
	for _, minutes := range prefs.ReminderMinutesBefore {
		_, err = s.db.ExecContext(ctx,
			"INSERT INTO user_reminder_preferences (user_id, minutes_before) VALUES ($1, $2)",
			userID, minutes)
		if err != nil {
			fmt.Printf("Failed to insert reminder preference: %v", err)
		}
	}

	return prefs, nil
}

// UpdateNotificationPreferences updates user's notification settings
func (s *userPreferenceService) UpdateNotificationPreferences(ctx context.Context, userID int, prefs *NotificationPreferences) error {
	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update main notification preferences
	query := `
		UPDATE user_notification_preferences SET
			notification_email_enabled = $2, notification_browser_enabled = $3, notification_mobile_enabled = $4,
			notification_meeting_reminders = $5, notification_chat_messages = $6, notification_meeting_invites = $7,
			notification_system_updates = $8, notification_participant_activity = $9, notification_permission_requests = $10,
			notification_hand_raises = $11, quiet_hours_start = $12, quiet_hours_end = $13, 
			weekend_notifications = $14, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1`

	_, err = tx.ExecContext(ctx, query,
		userID, prefs.EmailEnabled, prefs.BrowserEnabled, prefs.MobileEnabled,
		prefs.MeetingReminders, prefs.ChatMessages, prefs.MeetingInvites, prefs.SystemUpdates,
		prefs.ParticipantJoinLeave, prefs.PermissionRequests, prefs.HandRaises,
		prefs.QuietHoursStart, prefs.QuietHoursEnd, prefs.WeekendNotifications)

	if err != nil {
		return fmt.Errorf("failed to update notification preferences: %w", err)
	}

	// Update reminder preferences
	_, err = tx.ExecContext(ctx, "DELETE FROM user_reminder_preferences WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to delete old reminder preferences: %w", err)
	}

	for _, minutes := range prefs.ReminderMinutesBefore {
		_, err = tx.ExecContext(ctx,
			"INSERT INTO user_reminder_preferences (user_id, minutes_before) VALUES ($1, $2)",
			userID, minutes)
		if err != nil {
			return fmt.Errorf("failed to insert reminder preference: %w", err)
		}
	}

	return tx.Commit()
}

// ============================================================================
// DEVICE SYNCHRONIZATION
// ============================================================================

// SynchronizeDevicePreferences synchronizes preferences across devices
func (s *userPreferenceService) SynchronizeDevicePreferences(ctx context.Context, userID int, deviceID string, preferences *DevicePreferences) error {
	preferences.UserID = userID
	preferences.DeviceID = deviceID
	preferences.LastSyncedAt = time.Now()

	query := `
		INSERT INTO user_device_preferences (
			user_id, device_id, device_type, device_name, camera_device_id, 
			microphone_device_id, speaker_device_id, video_quality, audio_quality,
			bandwidth_limit, last_synced_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, device_id) DO UPDATE SET
			device_type = $3, device_name = $4, camera_device_id = $5,
			microphone_device_id = $6, speaker_device_id = $7, video_quality = $8,
			audio_quality = $9, bandwidth_limit = $10, last_synced_at = $11,
			updated_at = CURRENT_TIMESTAMP`

	_, err := s.db.ExecContext(ctx, query,
		preferences.UserID, preferences.DeviceID, preferences.DeviceType, preferences.DeviceName,
		preferences.CameraDeviceID, preferences.MicrophoneDeviceID, preferences.SpeakerDeviceID,
		preferences.VideoQuality, preferences.AudioQuality, preferences.BandwidthLimit,
		preferences.LastSyncedAt)

	if err != nil {
		return fmt.Errorf("failed to synchronize device preferences: %w", err)
	}

	return nil
}

// GetDevicePreferences retrieves device-specific preferences
func (s *userPreferenceService) GetDevicePreferences(ctx context.Context, userID int, deviceID string) (*DevicePreferences, error) {
	var prefs DevicePreferences
	query := `
		SELECT id, user_id, device_id, device_type, device_name, camera_device_id,
			   microphone_device_id, speaker_device_id, video_quality, audio_quality,
			   bandwidth_limit, last_synced_at, created_at, updated_at
		FROM user_device_preferences 
		WHERE user_id = $1 AND device_id = $2`

	err := s.db.GetContext(ctx, &prefs, query, userID, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get device preferences: %w", err)
	}

	return &prefs, nil
}

// ============================================================================
// PROFILE SETTINGS MANAGEMENT
// ============================================================================

// GetProfileSettings retrieves user's profile settings
func (s *userPreferenceService) GetProfileSettings(ctx context.Context, userID int) (*ProfileSettings, error) {
	var settings ProfileSettings
	query := `
		SELECT id, user_id, display_name, profile_picture_url, status, status_message,
			   timezone_preference, language_preference, date_format_preference, 
			   time_format_preference, created_at, updated_at
		FROM user_profile_settings WHERE user_id = $1`

	err := s.db.GetContext(ctx, &settings, query, userID)
	if err != nil {
		return s.createDefaultProfileSettings(ctx, userID)
	}

	return &settings, nil
}

func (s *userPreferenceService) createDefaultProfileSettings(ctx context.Context, userID int) (*ProfileSettings, error) {
	settings := &ProfileSettings{
		UserID:               userID,
		Status:               "available",
		TimezonePreference:   "UTC",
		LanguagePreference:   "en-US",
		DateFormatPreference: "MM/DD/YYYY",
		TimeFormatPreference: "12h",
	}

	query := `
		INSERT INTO user_profile_settings (
			user_id, status, timezone_preference, language_preference,
			date_format_preference, time_format_preference, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.QueryRowContext(ctx, query,
		settings.UserID, settings.Status, settings.TimezonePreference, settings.LanguagePreference,
		settings.DateFormatPreference, settings.TimeFormatPreference,
	).Scan(&settings.ID, &settings.CreatedAt, &settings.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create default profile settings: %w", err)
	}

	return settings, nil
}

// UpdateProfileSettings updates user's profile settings
func (s *userPreferenceService) UpdateProfileSettings(ctx context.Context, userID int, settings *ProfileSettings) error {
	query := `
		UPDATE user_profile_settings SET
			display_name = $2, profile_picture_url = $3, status = $4, status_message = $5,
			timezone_preference = $6, language_preference = $7, date_format_preference = $8,
			time_format_preference = $9, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1`

	_, err := s.db.ExecContext(ctx, query,
		userID, settings.DisplayName, settings.ProfilePictureURL, settings.Status, settings.StatusMessage,
		settings.TimezonePreference, settings.LanguagePreference, settings.DateFormatPreference,
		settings.TimeFormatPreference)

	if err != nil {
		return fmt.Errorf("failed to update profile settings: %w", err)
	}

	return nil
}

// ============================================================================
// PRIVACY SETTINGS MANAGEMENT
// ============================================================================

// GetPrivacySettings retrieves user's privacy settings
func (s *userPreferenceService) GetPrivacySettings(ctx context.Context, userID int) (*PrivacySettings, error) {
	var settings PrivacySettings
	query := `
		SELECT id, user_id, show_online_status, allow_direct_messages, share_participation_stats,
			   data_collection_consent, allow_recording_consent, share_presence_info,
			   allow_meeting_analytics, created_at, updated_at
		FROM user_privacy_settings WHERE user_id = $1`

	err := s.db.GetContext(ctx, &settings, query, userID)
	if err != nil {
		return s.createDefaultPrivacySettings(ctx, userID)
	}

	return &settings, nil
}

func (s *userPreferenceService) createDefaultPrivacySettings(ctx context.Context, userID int) (*PrivacySettings, error) {
	settings := &PrivacySettings{
		UserID:                  userID,
		ShowOnlineStatus:        true,
		AllowDirectMessages:     true,
		ShareParticipationStats: true,
		DataCollectionConsent:   false,
		AllowRecordingConsent:   true,
		SharePresenceInfo:       true,
		AllowMeetingAnalytics:   true,
	}

	query := `
		INSERT INTO user_privacy_settings (
			user_id, show_online_status, allow_direct_messages, share_participation_stats,
			data_collection_consent, allow_recording_consent, share_presence_info,
			allow_meeting_analytics, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.QueryRowContext(ctx, query,
		settings.UserID, settings.ShowOnlineStatus, settings.AllowDirectMessages,
		settings.ShareParticipationStats, settings.DataCollectionConsent, settings.AllowRecordingConsent,
		settings.SharePresenceInfo, settings.AllowMeetingAnalytics,
	).Scan(&settings.ID, &settings.CreatedAt, &settings.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create default privacy settings: %w", err)
	}

	return settings, nil
}

// UpdatePrivacySettings updates user's privacy settings
func (s *userPreferenceService) UpdatePrivacySettings(ctx context.Context, userID int, settings *PrivacySettings) error {
	query := `
		UPDATE user_privacy_settings SET
			show_online_status = $2, allow_direct_messages = $3, share_participation_stats = $4,
			data_collection_consent = $5, allow_recording_consent = $6, share_presence_info = $7,
			allow_meeting_analytics = $8, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1`

	_, err := s.db.ExecContext(ctx, query,
		userID, settings.ShowOnlineStatus, settings.AllowDirectMessages, settings.ShareParticipationStats,
		settings.DataCollectionConsent, settings.AllowRecordingConsent, settings.SharePresenceInfo,
		settings.AllowMeetingAnalytics)

	if err != nil {
		return fmt.Errorf("failed to update privacy settings: %w", err)
	}

	return nil
}
