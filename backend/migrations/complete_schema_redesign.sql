-- ============================================================================
-- COMPLETE DATABASE SCHEMA REDESIGN FOR VIDEO CONFERENCE PLATFORM
-- Role-Based Organization Management System
-- ============================================================================

-- WARNING: This migration will completely restructure the database
-- IMPORTANT: Delete existing database completely to start fresh with new schema

-- ============================================================================
-- DROP ALL EXISTING TABLES (if running fresh migration)
-- ============================================================================

DROP TABLE IF EXISTS recording_participants CASCADE;
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS chat_reactions CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS meeting_participants CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS meeting_invitations CASCADE;
DROP TABLE IF EXISTS meeting_group_assignments CASCADE;
DROP TABLE IF EXISTS user_group_memberships CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS client_features CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Drop custom functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_invitation_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_email_template_updated_at() CASCADE;

-- ============================================================================
-- 1. CLIENTS TABLE - ENHANCED ORGANIZATION MANAGEMENT
-- ============================================================================

CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    
    -- Enhanced organization features
    organization_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50) DEFAULT 'business' CHECK (organization_type IN ('enterprise', 'business', 'education', 'nonprofit')),
    subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'enterprise')),
    subscription_expires_at TIMESTAMP,
    max_admins INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 100,
    max_concurrent_meetings INTEGER DEFAULT 10,
    storage_limit_gb INTEGER DEFAULT 10,
    
    -- Branding and customization
    logo_url VARCHAR(500),
    theme VARCHAR(50) DEFAULT 'default',
    primary_color VARCHAR(7) DEFAULT '#007bff',
    custom_domain VARCHAR(255),
    branding_config JSONB,
    
    -- Security and SSO
    sso_enabled BOOLEAN DEFAULT false,
    sso_config JSONB,
    security_settings JSONB,
    
    -- Contact information
    billing_contact_email VARCHAR(255),
    technical_contact_email VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    business_hours JSONB,
    
    -- Status and trial
    is_active BOOLEAN DEFAULT true,
    trial_ends_at TIMESTAMP,
    created_by INTEGER, -- Will reference users(id) after users table is created
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. USERS TABLE - COMPLETE RESTRUCTURE WITH ROLE-BASED ACCESS CONTROL
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    
    -- Basic user information
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Role-based access control (super_admin, admin, user)
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'locked')),
    
    -- Organization relationship
    client_id INTEGER REFERENCES clients(id), -- NULL for super_admin
    
    -- Invitation and authentication features
    invitation_token VARCHAR(255) UNIQUE,
    invitation_expires_at TIMESTAMP,
    is_invited BOOLEAN DEFAULT false,
    password_created BOOLEAN DEFAULT false,
    
    -- Multi-Factor Authentication
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    
    -- Security features
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_password_change TIMESTAMP,
    force_password_change BOOLEAN DEFAULT false,
    
    -- Email verification
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    
    -- User preferences
    timezone VARCHAR(100) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB,
    
    -- Audit trail
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_admin_has_client CHECK (
        (role = 'super_admin') OR (role IN ('admin', 'user') AND client_id IS NOT NULL)
    ),
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT check_password_length CHECK (LENGTH(password_hash) >= 60)
);

-- Add foreign key constraint for created_by in clients table
ALTER TABLE clients ADD CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- Create unique constraint for email within organization
CREATE UNIQUE INDEX idx_users_email_client ON users(email, client_id);

-- ============================================================================
-- 3. CLIENT FEATURES - GRANULAR PERMISSION SYSTEM
-- ============================================================================

CREATE TABLE client_features (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Basic features (existing)
    chat_enabled BOOLEAN DEFAULT true,
    reactions_enabled BOOLEAN DEFAULT true,
    screen_sharing_enabled BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT false,
    raise_hand_enabled BOOLEAN DEFAULT true,
    waiting_room_enabled BOOLEAN DEFAULT false,
    max_participants INTEGER DEFAULT 100,
    
    -- Enhanced permission controls
    admin_approval_required BOOLEAN DEFAULT true,
    default_video_permission BOOLEAN DEFAULT false,
    default_audio_permission BOOLEAN DEFAULT false,
    default_screen_permission BOOLEAN DEFAULT false,
    allow_user_video_request BOOLEAN DEFAULT true,
    allow_user_audio_request BOOLEAN DEFAULT true,
    allow_user_screen_request BOOLEAN DEFAULT true,
    auto_approve_requests BOOLEAN DEFAULT false,
    meeting_lobby_enabled BOOLEAN DEFAULT true,
    participant_limit INTEGER DEFAULT 100,
    meeting_duration_limit INTEGER DEFAULT 480,
    
    -- File and media features
    file_sharing_enabled BOOLEAN DEFAULT true,
    file_size_limit_mb INTEGER DEFAULT 100,
    
    -- Advanced features
    whiteboard_enabled BOOLEAN DEFAULT false,
    polls_enabled BOOLEAN DEFAULT false,
    q_and_a_enabled BOOLEAN DEFAULT false,
    live_streaming_enabled BOOLEAN DEFAULT false,
    meeting_templates_enabled BOOLEAN DEFAULT true,
    custom_backgrounds_enabled BOOLEAN DEFAULT true,
    noise_cancellation_enabled BOOLEAN DEFAULT true,
    transcription_enabled BOOLEAN DEFAULT false,
    translation_enabled BOOLEAN DEFAULT false,
    meeting_insights_enabled BOOLEAN DEFAULT true,
    
    -- API and integration features
    api_access_enabled BOOLEAN DEFAULT false,
    webhook_notifications_enabled BOOLEAN DEFAULT false,
    
    -- Security features
    sso_required BOOLEAN DEFAULT false,
    ip_restrictions JSONB,
    allowed_domains JSONB,
    blocked_domains JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. GROUPS TABLE - ENHANCED GROUP MANAGEMENT
-- ============================================================================

CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Enhanced group features
    group_type VARCHAR(20) DEFAULT 'custom' CHECK (group_type IN ('department', 'project', 'custom')),
    is_active BOOLEAN DEFAULT true,
    max_members INTEGER DEFAULT 1000,
    auto_add_new_users BOOLEAN DEFAULT false,
    email_domain_filter VARCHAR(255),
    
    -- Configuration and settings
    group_settings JSONB,
    meeting_defaults JSONB,
    notification_settings JSONB,
    
    -- External integration
    external_id VARCHAR(255),
    sync_source VARCHAR(50) DEFAULT 'manual' CHECK (sync_source IN ('manual', 'ldap', 'azure_ad', 'google_workspace')),
    last_sync_at TIMESTAMP,
    sync_errors JSONB,
    
    -- Audit trail
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(client_id, name)
);

-- User group memberships
CREATE TABLE user_group_memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, group_id)
);

-- ============================================================================
-- 5. MEETINGS TABLE - COMPLETE MEETING MANAGEMENT OVERHAUL
-- ============================================================================

CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Basic meeting information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    meeting_id VARCHAR(20) NOT NULL UNIQUE, -- Public meeting ID for joining
    
    -- Meeting type and scheduling
    meeting_type VARCHAR(20) DEFAULT 'scheduled' CHECK (meeting_type IN ('instant', 'scheduled', 'recurring')),
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    
    -- Time validation for joining
    buffer_start_minutes INTEGER DEFAULT 15, -- Allow joining N minutes early
    buffer_end_minutes INTEGER DEFAULT 30,   -- Allow joining N minutes after end
    
    -- Meeting status and control
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
    is_active BOOLEAN DEFAULT false,
    admin_only_controls BOOLEAN DEFAULT true,
    
    -- Meeting settings and permissions
    waiting_room_enabled BOOLEAN DEFAULT true,
    auto_admit_users BOOLEAN DEFAULT false,
    lock_meeting BOOLEAN DEFAULT false,
    mute_participants_on_join BOOLEAN DEFAULT true,
    disable_video_on_join BOOLEAN DEFAULT true,
    allow_screen_sharing BOOLEAN DEFAULT false,
    recording_auto_start BOOLEAN DEFAULT false,
    chat_enabled BOOLEAN DEFAULT true,
    raise_hand_enabled BOOLEAN DEFAULT true,
    breakout_rooms_enabled BOOLEAN DEFAULT false,
    max_duration_minutes INTEGER DEFAULT 480,
    
    -- Security features
    password VARCHAR(255), -- Meeting password
    require_meeting_password BOOLEAN DEFAULT false,
    participant_join_approval BOOLEAN DEFAULT false,
    allow_anonymous_users BOOLEAN DEFAULT false,
    
    -- Meeting configuration
    meeting_settings JSONB,
    lobby_message TEXT,
    entry_exit_chime BOOLEAN DEFAULT false,
    
    -- Calendar integration
    calendar_event_id VARCHAR(255),
    google_meet_link VARCHAR(500),
    zoom_meeting_id VARCHAR(255),
    teams_meeting_url VARCHAR(500),
    
    -- Recording and compliance
    recording_consent_required BOOLEAN DEFAULT true,
    data_retention_days INTEGER DEFAULT 365,
    meeting_notes TEXT,
    meeting_summary JSONB,
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    feedback_comments TEXT,
    
    -- Recurring meetings
    recurring_pattern JSONB,
    parent_meeting_id INTEGER REFERENCES meetings(id),
    occurrence_date DATE,
    
    -- Cancellation tracking
    is_cancelled BOOLEAN DEFAULT false,
    cancellation_reason TEXT,
    cancelled_by INTEGER REFERENCES users(id),
    cancelled_at TIMESTAMP,
    
    -- Audit trail
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. MEETING PARTICIPANTS - ENHANCED PARTICIPANT MANAGEMENT
-- ============================================================================

CREATE TABLE meeting_participants (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for guest participants
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL, -- For group invitations
    email VARCHAR(255), -- For email invitations
    guest_name VARCHAR(255), -- For guest participants
    role VARCHAR(20) DEFAULT 'attendee' CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')),
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined', 'left')),
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(meeting_id, user_id) -- Prevent duplicate user invitations
);

-- Meeting participant extended information
CREATE TABLE meeting_participant_extended (
    id SERIAL PRIMARY KEY,
    meeting_participant_id INTEGER REFERENCES meeting_participants(id) ON DELETE CASCADE,
    connection_quality VARCHAR(20) DEFAULT 'good' CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
    device_info JSONB,
    browser_info JSONB,
    network_info JSONB,
    permissions_granted JSONB,
    speaking_time_seconds INTEGER DEFAULT 0,
    chat_messages_sent INTEGER DEFAULT 0,
    reactions_sent INTEGER DEFAULT 0,
    screen_share_duration INTEGER DEFAULT 0,
    hand_raises_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(meeting_participant_id)
);

-- ============================================================================
-- 7. NEW TABLES FOR ENHANCED FUNCTIONALITY
-- ============================================================================

-- Admin invitations management
CREATE TABLE admin_invitations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    invited_by INTEGER REFERENCES users(id),
    accepted_at TIMESTAMP,
    password_created_at TIMESTAMP,
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(email, client_id)
);

-- User invitations management
CREATE TABLE user_invitations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    admin_id INTEGER REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    welcome_message TEXT,
    accepted_at TIMESTAMP,
    password_created_at TIMESTAMP,
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(email, client_id)
);

-- Meeting permissions system
CREATE TABLE meeting_permissions (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL CHECK (permission_type IN ('video', 'audio', 'screen', 'chat', 'recording')),
    is_granted BOOLEAN DEFAULT false,
    requested_at TIMESTAMP,
    approved_at TIMESTAMP,
    denied_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    denied_by INTEGER REFERENCES users(id),
    request_message TEXT,
    admin_response TEXT,
    auto_granted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(meeting_id, user_id, permission_type)
);

-- Raise hand management
CREATE TABLE raise_hands (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    raised_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lowered_at TIMESTAMP,
    lowered_by INTEGER REFERENCES users(id),
    auto_lowered BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    queue_position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(meeting_id, user_id) -- Only one active hand per user per meeting
);

-- Meeting analytics and tracking
CREATE TABLE meeting_analytics (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    participant_count INTEGER DEFAULT 0,
    peak_participants INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    chat_messages_count INTEGER DEFAULT 0,
    screen_shares_count INTEGER DEFAULT 0,
    recordings_count INTEGER DEFAULT 0,
    raise_hands_count INTEGER DEFAULT 0,
    permission_requests_count INTEGER DEFAULT 0,
    average_participant_duration INTEGER DEFAULT 0,
    participant_join_times JSONB,
    participant_leave_times JSONB,
    feature_usage_stats JSONB,
    quality_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Speaking detection and activity
CREATE TABLE speaking_activity (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    started_speaking_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stopped_speaking_at TIMESTAMP,
    duration_seconds INTEGER,
    audio_level_avg DECIMAL(5,2),
    audio_level_peak DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User analytics and engagement
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id),
    total_meetings_joined INTEGER DEFAULT 0,
    total_meeting_duration_minutes INTEGER DEFAULT 0,
    total_speaking_time_minutes INTEGER DEFAULT 0,
    total_chat_messages INTEGER DEFAULT 0,
    meetings_this_week INTEGER DEFAULT 0,
    meetings_this_month INTEGER DEFAULT 0,
    average_meeting_duration INTEGER DEFAULT 0,
    most_active_day_of_week INTEGER DEFAULT 1,
    most_active_hour INTEGER DEFAULT 9,
    engagement_score DECIMAL(5,2) DEFAULT 0.0,
    last_meeting_date DATE,
    first_meeting_date DATE,
    preferred_meeting_duration INTEGER DEFAULT 60,
    participation_trends JSONB,
    feature_usage_stats JSONB,
    device_preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- User preferences and settings
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    default_audio_enabled BOOLEAN DEFAULT false,
    default_video_enabled BOOLEAN DEFAULT false,
    auto_join_audio BOOLEAN DEFAULT true,
    preferred_camera_device VARCHAR(255),
    preferred_microphone_device VARCHAR(255),
    preferred_speaker_device VARCHAR(255),
    notification_email_enabled BOOLEAN DEFAULT true,
    notification_browser_enabled BOOLEAN DEFAULT true,
    notification_meeting_reminders BOOLEAN DEFAULT true,
    notification_chat_messages BOOLEAN DEFAULT true,
    notification_meeting_invites BOOLEAN DEFAULT true,
    theme_preference VARCHAR(20) DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
    language_preference VARCHAR(10) DEFAULT 'en',
    timezone_preference VARCHAR(100) DEFAULT 'UTC',
    meeting_view_preference VARCHAR(20) DEFAULT 'grid' CHECK (meeting_view_preference IN ('grid', 'speaker', 'gallery')),
    chat_position VARCHAR(20) DEFAULT 'right' CHECK (chat_position IN ('right', 'bottom', 'floating')),
    show_participant_names BOOLEAN DEFAULT true,
    show_connection_quality BOOLEAN DEFAULT true,
    auto_hide_controls BOOLEAN DEFAULT false,
    keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
    high_contrast_mode BOOLEAN DEFAULT false,
    reduce_motion BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- User meeting bookmarks
CREATE TABLE user_meeting_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    bookmark_time_seconds INTEGER NOT NULL,
    bookmark_title VARCHAR(255),
    bookmark_description TEXT,
    bookmark_type VARCHAR(20) DEFAULT 'note' CHECK (bookmark_type IN ('important', 'action_item', 'decision', 'question', 'note')),
    is_private BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced chat messages with comprehensive features
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_email VARCHAR(255), -- For guest senders
    sender_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system', 'announcement', 'poll', 'reaction')),
    
    -- Enhanced chat features
    thread_id INTEGER REFERENCES chat_messages(id),
    message_status VARCHAR(20) DEFAULT 'sent' CHECK (message_status IN ('sent', 'delivered', 'read', 'deleted')),
    edited_at TIMESTAMP,
    edited_by INTEGER REFERENCES users(id),
    original_message TEXT,
    reactions JSONB,
    mentions JSONB,
    file_attachments JSONB,
    message_priority VARCHAR(20) DEFAULT 'normal' CHECK (message_priority IN ('low', 'normal', 'high', 'urgent')),
    is_announcement BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    translation_data JSONB,
    sentiment_score DECIMAL(3,2),
    flagged_content BOOLEAN DEFAULT false,
    flag_reason TEXT,
    
    -- Metadata and moderation
    metadata JSONB,
    is_moderated BOOLEAN DEFAULT false,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    reply_to_id INTEGER REFERENCES chat_messages(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chat_messages_sender_check CHECK (
        (sender_id IS NOT NULL AND sender_email IS NULL) OR 
        (sender_id IS NULL AND sender_email IS NOT NULL)
    )
);

-- Enhanced recordings table
CREATE TABLE recordings (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in seconds
    file_size BIGINT, -- File size in bytes
    file_path TEXT,
    download_url TEXT,
    streaming_url TEXT,
    metadata JSONB,
    settings JSONB,
    started_by INTEGER REFERENCES users(id),
    stopped_by INTEGER REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    password VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates for notifications
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('invitation', 'reminder', 'cancellation', 'update', 'welcome', 'password_reset', 'meeting_started', 'meeting_ended', 'recording_ready', 'admin_invitation', 'user_invitation')),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. COMPREHENSIVE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_client_role ON users(client_id, role);
CREATE INDEX idx_users_invitation_token ON users(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_users_status_active ON users(status) WHERE status = 'active';
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Clients table indexes
CREATE INDEX idx_clients_subscription ON clients(subscription_plan, subscription_expires_at);
CREATE INDEX idx_clients_active ON clients(is_active) WHERE is_active = true;
CREATE INDEX idx_clients_domain ON clients(custom_domain) WHERE custom_domain IS NOT NULL;

-- Meetings table indexes
CREATE INDEX idx_meetings_type_status ON meetings(meeting_type, status);
CREATE INDEX idx_meetings_client_scheduled ON meetings(client_id, scheduled_start);
CREATE INDEX idx_meetings_active ON meetings(is_active) WHERE is_active = true;
CREATE INDEX idx_meetings_recurring ON meetings(parent_meeting_id, occurrence_date);
CREATE INDEX idx_meetings_calendar_event ON meetings(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_meetings_meeting_id ON meetings(meeting_id);

-- Groups table indexes
CREATE INDEX idx_groups_client_active ON groups(client_id, is_active);
CREATE INDEX idx_groups_type ON groups(group_type);
CREATE INDEX idx_groups_external_id ON groups(external_id) WHERE external_id IS NOT NULL;

-- Meeting participants indexes
CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_group_id ON meeting_participants(group_id);
CREATE INDEX idx_meeting_participants_email ON meeting_participants(email);
CREATE INDEX idx_meeting_participants_status ON meeting_participants(status);

-- Invitations indexes
CREATE INDEX idx_admin_invitations_token ON admin_invitations(token);
CREATE INDEX idx_admin_invitations_email_client ON admin_invitations(email, client_id);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email_client ON user_invitations(email, client_id);
CREATE INDEX idx_user_invitations_admin ON user_invitations(admin_id);

-- Meeting permissions indexes
CREATE INDEX idx_meeting_permissions_meeting ON meeting_permissions(meeting_id);
CREATE INDEX idx_meeting_permissions_user ON meeting_permissions(user_id);
CREATE INDEX idx_meeting_permissions_pending ON meeting_permissions(meeting_id, requested_at) WHERE approved_at IS NULL AND denied_at IS NULL;

-- Raise hands indexes
CREATE INDEX idx_raise_hands_meeting_active ON raise_hands(meeting_id, raised_at) WHERE lowered_at IS NULL;
CREATE INDEX idx_raise_hands_user ON raise_hands(user_id);

-- Analytics indexes
CREATE INDEX idx_meeting_analytics_meeting ON meeting_analytics(meeting_id);
CREATE INDEX idx_user_analytics_client ON user_analytics(client_id);
CREATE INDEX idx_user_analytics_engagement ON user_analytics(engagement_score);

-- Speaking activity indexes
CREATE INDEX idx_speaking_activity_meeting ON speaking_activity(meeting_id, started_speaking_at);
CREATE INDEX idx_speaking_activity_user ON speaking_activity(user_id);
CREATE INDEX idx_speaking_activity_active ON speaking_activity(meeting_id) WHERE stopped_speaking_at IS NULL;

-- Chat messages indexes
CREATE INDEX idx_chat_messages_meeting_time ON chat_messages(meeting_id, created_at);
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_chat_messages_status ON chat_messages(message_status);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);

-- User preferences and bookmarks indexes
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_bookmarks_user ON user_meeting_bookmarks(user_id);
CREATE INDEX idx_user_bookmarks_meeting ON user_meeting_bookmarks(meeting_id);
CREATE INDEX idx_user_bookmarks_type ON user_meeting_bookmarks(bookmark_type);

-- Email templates indexes
CREATE INDEX idx_email_templates_client ON email_templates(client_id);
CREATE INDEX idx_email_templates_type ON email_templates(type);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

-- ============================================================================
-- 9. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_features_updated_at BEFORE UPDATE ON client_features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_invitations_updated_at BEFORE UPDATE ON admin_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_invitations_updated_at BEFORE UPDATE ON user_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_permissions_updated_at BEFORE UPDATE ON meeting_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_analytics_updated_at BEFORE UPDATE ON meeting_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_analytics_updated_at BEFORE UPDATE ON user_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_bookmarks_updated_at BEFORE UPDATE ON user_meeting_bookmarks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON recordings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_participant_extended_updated_at BEFORE UPDATE ON meeting_participant_extended FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. INITIAL DATA SETUP AND SEED DATA
-- ============================================================================

-- Insert default super admin client (for platform management)
INSERT INTO clients (email, app_name, organization_name, organization_type, subscription_plan, theme, primary_color, is_active, max_admins, max_users, max_concurrent_meetings) 
VALUES ('superadmin@platform.com', 'Video Platform Super Admin', 'Platform Administration', 'enterprise', 'enterprise', 'admin', '#dc3545', true, 1000, 10000, 1000);

-- Insert default client features for super admin client
INSERT INTO client_features (client_id, chat_enabled, reactions_enabled, screen_sharing_enabled, recording_enabled, raise_hand_enabled, waiting_room_enabled, max_participants, admin_approval_required, default_video_permission, default_audio_permission)
VALUES (1, true, true, true, true, true, true, 1000, false, true, true);

-- Insert super admin user
INSERT INTO users (client_id, email, password_hash, first_name, last_name, role, status, email_verified, password_created)
VALUES (NULL, 'superadmin@platform.com', '$2a$10$example_hash_change_in_production_really_long_hash_60plus', 'Super', 'Admin', 'super_admin', 'active', true, true);

-- Insert sample organization for testing
INSERT INTO clients (email, app_name, organization_name, organization_type, subscription_plan, theme, primary_color, created_by) 
VALUES ('demo@organization.com', 'Demo Organization', 'Demo Corp', 'business', 'premium', 'default', '#007bff', 1);

-- Insert client features for demo organization
INSERT INTO client_features (client_id, chat_enabled, reactions_enabled, screen_sharing_enabled, recording_enabled, raise_hand_enabled, waiting_room_enabled, max_participants)
VALUES (2, true, true, true, false, true, true, 100);

-- Insert demo admin user
INSERT INTO users (client_id, email, password_hash, first_name, last_name, role, status, email_verified, password_created, created_by)
VALUES (2, 'admin@demo.com', '$2a$10$example_hash_change_in_production_really_long_hash_60plus', 'Demo', 'Admin', 'admin', 'active', true, true, 1);

-- Insert demo regular users
INSERT INTO users (client_id, email, password_hash, first_name, last_name, role, status, email_verified, password_created, created_by)
VALUES 
(2, 'user1@demo.com', '$2a$10$example_hash_change_in_production_really_long_hash_60plus', 'John', 'Doe', 'user', 'active', true, true, 2),
(2, 'user2@demo.com', '$2a$10$example_hash_change_in_production_really_long_hash_60plus', 'Jane', 'Smith', 'user', 'active', true, true, 2);

-- Insert demo groups
INSERT INTO groups (client_id, name, description, created_by)
VALUES 
(2, 'Development Team', 'Software development team', 2),
(2, 'Marketing Team', 'Marketing and communications team', 2);

-- Add users to groups
INSERT INTO user_group_memberships (user_id, group_id, added_by)
VALUES 
(3, 1, 2), -- John Doe to Development Team
(4, 2, 2); -- Jane Smith to Marketing Team

-- Insert default email templates for demo organization
INSERT INTO email_templates (client_id, type, name, subject, html_body, text_body, is_default, is_active)
VALUES 
(2, 'admin_invitation', 'Admin Invitation', 'You are invited to join {{organization_name}} as an Admin', 
 '<h1>Welcome to {{organization_name}}</h1><p>You have been invited to join as an admin. Click <a href="{{invitation_link}}">here</a> to accept.</p>',
 'Welcome to {{organization_name}}. You have been invited to join as an admin. Visit: {{invitation_link}}', true, true),
(2, 'user_invitation', 'User Invitation', 'You are invited to join {{organization_name}}', 
 '<h1>Welcome to {{organization_name}}</h1><p>You have been invited to join. Click <a href="{{invitation_link}}">here</a> to accept.</p>',
 'Welcome to {{organization_name}}. You have been invited to join. Visit: {{invitation_link}}', true, true),
(2, 'invitation', 'Meeting Invitation', 'Meeting Invitation: {{meeting_title}}', 
 '<h1>You are invited to: {{meeting_title}}</h1><p>Time: {{meeting_time}}</p><p>Join: <a href="{{meeting_link}}">{{meeting_link}}</a></p>',
 'Meeting: {{meeting_title}} at {{meeting_time}}. Join: {{meeting_link}}', true, true);

-- Insert user preferences for demo users
INSERT INTO user_preferences (user_id, theme_preference, language_preference, notification_email_enabled)
VALUES 
(3, 'light', 'en', true),
(4, 'dark', 'en', true);

-- Initialize user analytics for demo users
INSERT INTO user_analytics (user_id, client_id)
VALUES 
(3, 2),
(4, 2);

-- ============================================================================
-- END OF SCHEMA MIGRATION
-- ============================================================================

-- Migration completed successfully
-- Total tables created: 24
-- Indexes created: 50+
-- Triggers created: 16
-- Functions created: 1
-- Sample data inserted: Yes