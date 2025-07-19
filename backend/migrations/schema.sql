-- Enterprise Video Conferencing Platform Database Schema
-- Multi-tenant SaaS architecture with comprehensive user management

-- ============================================================================
-- MULTI-TENANT CLIENT SYSTEM
-- ============================================================================

-- Organizational accounts with customizable branding
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    theme VARCHAR(50) DEFAULT 'default',
    primary_color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-client feature toggles for customization
CREATE TABLE client_features (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    chat_enabled BOOLEAN DEFAULT true,
    reactions_enabled BOOLEAN DEFAULT true,
    screen_sharing_enabled BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT false,
    raise_hand_enabled BOOLEAN DEFAULT true,
    waiting_room_enabled BOOLEAN DEFAULT false,
    max_participants INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- USER MANAGEMENT & ROLE-BASED ACCESS CONTROL
-- ============================================================================

-- User accounts with hierarchical role system
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_level INTEGER NOT NULL CHECK (role_level IN (1, 2, 3)), -- 1=Super Admin, 2=Admin, 3=User
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, email)
);

-- ============================================================================
-- GROUP-BASED ORGANIZATION SYSTEM
-- ============================================================================

-- User groups for organizing participants within client
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, name)
);

-- Many-to-many relationship between users and groups
CREATE TABLE user_group_memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, group_id)
);

-- ============================================================================
-- MEETING MANAGEMENT WORKFLOW
-- ============================================================================

-- Meeting creation with comprehensive scheduling
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL, -- Secure access token (no exposed IDs)
    host_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_private BOOLEAN DEFAULT false,
    require_approval BOOLEAN DEFAULT false,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern JSONB, -- Store recurring meeting patterns
    google_calendar_event_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INVITATION SYSTEM - DUAL APPROACH
-- ============================================================================

-- Group-based invitations for streamlined team meetings
CREATE TABLE meeting_group_assignments (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_id, group_id)
);

-- Individual invitations for direct email-based invitations
CREATE TABLE meeting_invitations (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for external guests
    email VARCHAR(255) NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL, -- Links back to originating group
    sent_by INTEGER REFERENCES users(id),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- ============================================================================
-- EMAIL NOTIFICATION SYSTEM
-- ============================================================================

-- Customizable email templates per client
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL, -- meeting_invitation, user_registration, meeting_reminder
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    variables JSONB, -- Available template variables
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, template_type)
);

-- Email delivery tracking and logging
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MEETING PARTICIPATION TRACKING
-- ============================================================================

-- Real-time participation tracking
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for guests
    email VARCHAR(255), -- For guest participants
    role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('host', 'participant', 'guest')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    duration_seconds INTEGER
);

-- Chat system for meeting communication
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_email VARCHAR(255), -- For guest senders
    message TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- For private messages
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-time reactions during meetings
CREATE TABLE reactions (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255), -- For guest reactions
    reaction_type VARCHAR(50) NOT NULL, -- emoji type
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recording management
CREATE TABLE recordings (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Client and tenant isolation indexes
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_groups_client_id ON groups(client_id);
CREATE INDEX idx_meetings_client_id ON meetings(client_id);
CREATE INDEX idx_email_templates_client_id ON email_templates(client_id);
CREATE INDEX idx_email_logs_client_id ON email_logs(client_id);

-- Authentication and access indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_meetings_token ON meetings(token);
CREATE INDEX idx_meeting_invitations_token ON meeting_invitations(invitation_token);
CREATE INDEX idx_meeting_invitations_email ON meeting_invitations(email);

-- Meeting and participation indexes
CREATE INDEX idx_meetings_start_time ON meetings(start_time);
CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_participants_meeting_id ON participants(meeting_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_chat_messages_meeting_id ON chat_messages(meeting_id);
CREATE INDEX idx_reactions_meeting_id ON reactions(meeting_id);

-- Group and membership indexes
CREATE INDEX idx_user_group_memberships_user_id ON user_group_memberships(user_id);
CREATE INDEX idx_user_group_memberships_group_id ON user_group_memberships(group_id);
CREATE INDEX idx_meeting_group_assignments_meeting_id ON meeting_group_assignments(meeting_id);
CREATE INDEX idx_meeting_group_assignments_group_id ON meeting_group_assignments(group_id);

-- Compound indexes for common queries
CREATE INDEX idx_users_client_email ON users(client_id, email);
CREATE INDEX idx_meetings_client_token ON meetings(client_id, token);
CREATE INDEX idx_participants_meeting_user ON participants(meeting_id, user_id);

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert default super admin client (for platform management)
INSERT INTO clients (email, app_name, theme, primary_color) 
VALUES ('admin@platform.com', 'Video Platform Admin', 'admin', '#dc3545');

-- Insert default client features for admin client
INSERT INTO client_features (client_id, chat_enabled, reactions_enabled, screen_sharing_enabled, recording_enabled, raise_hand_enabled, waiting_room_enabled, max_participants)
VALUES (1, true, true, true, true, true, true, 1000);

-- Insert super admin user
INSERT INTO users (client_id, email, password_hash, first_name, last_name, role_level, is_active, email_verified)
VALUES (1, 'admin@platform.com', '$2a$10$example_hash_here', 'Super', 'Admin', 1, true, true);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
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
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- MEETING MANAGEMENT TABLES
-- ============================================================================

-- Meeting management tables
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_id VARCHAR(20) NOT NULL UNIQUE, -- Unique meeting identifier for joining
    password VARCHAR(255), -- Optional meeting password
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
    recurrence_end TIMESTAMP WITH TIME ZONE,
    parent_meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE, -- For recurring meetings
    settings JSONB NOT NULL DEFAULT '{}', -- Meeting configuration settings
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting participants table
CREATE TABLE meeting_participants (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for guest participants
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL, -- For group invitations
    email VARCHAR(255), -- For email invitations
    guest_name VARCHAR(255), -- For guest participants
    role VARCHAR(20) NOT NULL DEFAULT 'attendee' CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')),
    status VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined', 'left')),
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_id, user_id) -- Prevent duplicate user invitations
);

-- Indexes for meeting management
CREATE INDEX idx_meetings_client_id ON meetings(client_id);
CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_meetings_meeting_id ON meetings(meeting_id);
CREATE INDEX idx_meetings_scheduled_start ON meetings(scheduled_start);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_recurrence ON meetings(recurrence_type, recurrence_end);

CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_group_id ON meeting_participants(group_id);
CREATE INDEX idx_meeting_participants_email ON meeting_participants(email);
CREATE INDEX idx_meeting_participants_status ON meeting_participants(status);

-- Additional tables for future phases:
-- - invitations (email invitation system)
-- - email_templates (customizable email templates)
-- - meeting_sessions (real-time meeting tracking)
-- - meeting_recordings (recording management)
-- - meeting_chat (chat messages during meetings)
-- - meeting_reactions (reactions and feedback during meetings)



-- ============================================================================
-- INVITATION SYSTEM TABLES
-- ============================================================================

-- Invitations table
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    invitation_type VARCHAR(20) NOT NULL CHECK (invitation_type IN ('email', 'group', 'user')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- For user invitations
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL, -- For group invitations
    email VARCHAR(255), -- For email invitations
    guest_name VARCHAR(255), -- For guest invitations
    token VARCHAR(64) NOT NULL UNIQUE, -- Unique invitation token
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
    role VARCHAR(20) NOT NULL DEFAULT 'attendee' CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')),
    message TEXT, -- Custom invitation message
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_id, user_id), -- Prevent duplicate user invitations
    UNIQUE(meeting_id, email) -- Prevent duplicate email invitations
);

-- Email templates table
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('invitation', 'reminder', 'cancellation', 'update', 'welcome', 'password_reset', 'meeting_started', 'meeting_ended', 'recording_ready')),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables JSONB DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, type, is_default) -- Only one default template per type per client
);

-- Indexes for invitation system
CREATE INDEX idx_invitations_client_id ON invitations(client_id);
CREATE INDEX idx_invitations_meeting_id ON invitations(meeting_id);
CREATE INDEX idx_invitations_user_id ON invitations(user_id);
CREATE INDEX idx_invitations_group_id ON invitations(group_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX idx_invitations_invited_by ON invitations(invited_by);

CREATE INDEX idx_email_templates_client_id ON email_templates(client_id);
CREATE INDEX idx_email_templates_type ON email_templates(type);
CREATE INDEX idx_email_templates_is_default ON email_templates(is_default);
CREATE INDEX idx_email_templates_is_active ON email_templates(is_active);

-- Triggers for invitation system
CREATE OR REPLACE FUNCTION update_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invitation_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_updated_at();

CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_template_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_email_template_updated_at();


-- =============================
-- CHAT AND COMMUNICATION TABLES
-- =============================

-- Chat messages table
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system', 'announcement', 'poll', 'reaction')),
    metadata JSONB,
    is_moderated BOOLEAN NOT NULL DEFAULT false,
    moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    reply_to_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chat_messages_sender_check CHECK (
        (sender_id IS NOT NULL AND sender_email IS NULL) OR 
        (sender_id IS NULL AND sender_email IS NOT NULL)
    )
);

-- Chat reactions table
CREATE TABLE chat_reactions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255) NOT NULL,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chat_reactions_user_check CHECK (
        (user_id IS NOT NULL AND user_email IS NULL) OR 
        (user_id IS NULL AND user_email IS NOT NULL)
    ),
    UNIQUE(client_id, message_id, COALESCE(user_id, 0), COALESCE(user_email, ''), emoji)
);

-- =============================
-- RECORDING TABLES
-- =============================

-- Recordings table
CREATE TABLE recordings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in seconds
    file_size BIGINT, -- File size in bytes
    file_path TEXT,
    download_url TEXT,
    streaming_url TEXT,
    metadata JSONB,
    settings JSONB,
    started_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    stopped_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    password VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recording participants table
CREATE TABLE recording_participants (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    recording_id INTEGER NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    left_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in seconds
    speaking_time INTEGER, -- Speaking time in seconds
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT recording_participants_user_check CHECK (
        (user_id IS NOT NULL AND user_email IS NULL) OR 
        (user_id IS NULL AND user_email IS NOT NULL)
    )
);

-- =============================
-- INDEXES FOR CHAT AND RECORDING TABLES
-- =============================

-- Chat message indexes
CREATE INDEX idx_chat_messages_client_meeting ON chat_messages(client_id, meeting_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_sender_email ON chat_messages(sender_email);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_message_type ON chat_messages(message_type);
CREATE INDEX idx_chat_messages_is_moderated ON chat_messages(is_moderated);
CREATE INDEX idx_chat_messages_reply_to ON chat_messages(reply_to_id);

-- Chat reaction indexes
CREATE INDEX idx_chat_reactions_client_message ON chat_reactions(client_id, message_id);
CREATE INDEX idx_chat_reactions_user_id ON chat_reactions(user_id);
CREATE INDEX idx_chat_reactions_user_email ON chat_reactions(user_email);
CREATE INDEX idx_chat_reactions_emoji ON chat_reactions(emoji);

-- Recording indexes
CREATE INDEX idx_recordings_client_id ON recordings(client_id);
CREATE INDEX idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_started_by ON recordings(started_by);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);
CREATE INDEX idx_recordings_is_public ON recordings(is_public);
CREATE INDEX idx_recordings_expires_at ON recordings(expires_at);

-- Recording participant indexes
CREATE INDEX idx_recording_participants_client_recording ON recording_participants(client_id, recording_id);
CREATE INDEX idx_recording_participants_user_id ON recording_participants(user_id);
CREATE INDEX idx_recording_participants_user_email ON recording_participants(user_email);
CREATE INDEX idx_recording_participants_joined_at ON recording_participants(joined_at);

-- Full-text search indexes for chat messages
CREATE INDEX idx_chat_messages_message_fts ON chat_messages USING gin(to_tsvector('english', message));
CREATE INDEX idx_chat_messages_sender_name_fts ON chat_messages USING gin(to_tsvector('english', sender_name));

