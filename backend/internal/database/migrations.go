package database

import (
	"fmt"
	"log"
	"github.com/jmoiron/sqlx"
)

// runMigrationsFromCode executes all database migrations
func runMigrationsFromCode(db *DB) error {
	log.Printf("🔄 Starting database migrations...")
	
	// Create migrations table if it doesn't exist
	if err := createMigrationsTable(db.DB); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// List of migrations to run in order
	migrations := []Migration{
		{Version: 1, Description: "Create clients table", SQL: createClientsTable},
		{Version: 2, Description: "Create users table", SQL: createUsersTable},
		{Version: 3, Description: "Create groups table", SQL: createGroupsTable},
		{Version: 4, Description: "Create user_group_memberships table", SQL: createUserGroupMembershipsTable},
		{Version: 5, Description: "Create meetings table", SQL: createMeetingsTable},
		{Version: 6, Description: "Create meeting_participants table", SQL: createMeetingParticipantsTable},
		{Version: 7, Description: "Create invitations table", SQL: createInvitationsTable},
		{Version: 8, Description: "Create chat_messages table", SQL: createChatMessagesTable},
		{Version: 9, Description: "Create recordings table", SQL: createRecordingsTable},
		{Version: 10, Description: "Create refresh_tokens table", SQL: createRefreshTokensTable},
		{Version: 11, Description: "Create password_reset_tokens table", SQL: createPasswordResetTokensTable},
		{Version: 12, Description: "Insert default client", SQL: insertDefaultClient},
		{Version: 13, Description: "Add missing columns to invitations table", SQL: updateInvitationsTable},
	}

	// Execute migrations
	for _, migration := range migrations {
		if err := runMigration(db.DB, migration); err != nil {
			return fmt.Errorf("migration %d failed: %w", migration.Version, err)
		}
	}

	log.Printf("✅ All migrations completed successfully")
	return nil
}

type Migration struct {
	Version     int
	Description string
	SQL         string
}

func createMigrationsTable(db *sqlx.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS migrations (
		version INTEGER PRIMARY KEY,
		description TEXT NOT NULL,
		executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	)`
	_, err := db.Exec(query)
	return err
}

func runMigration(db *sqlx.DB, migration Migration) error {
	// Check if migration has already been run
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM migrations WHERE version = $1", migration.Version).Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Printf("⏭️  Skipping migration %d: %s (already executed)", migration.Version, migration.Description)
		return nil
	}

	log.Printf("▶️  Running migration %d: %s", migration.Version, migration.Description)

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Execute migration SQL
	if _, err := tx.Exec(migration.SQL); err != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Record migration as completed
	if _, err := tx.Exec("INSERT INTO migrations (version, description) VALUES ($1, $2)", migration.Version, migration.Description); err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("✅ Migration %d completed", migration.Version)
	return nil
}

// Migration SQL statements
const createClientsTable = `
CREATE TABLE IF NOT EXISTS clients (
	id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	app_name VARCHAR(255) NOT NULL,
	logo_url TEXT,
	theme VARCHAR(50) DEFAULT 'default',
	primary_color VARCHAR(7) DEFAULT '#007bff',
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
`

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	email VARCHAR(255) NOT NULL,
	password_hash TEXT NOT NULL,
	first_name VARCHAR(100) NOT NULL,
	last_name VARCHAR(100) NOT NULL,
	role VARCHAR(20) NOT NULL DEFAULT 'user',
	status VARCHAR(20) NOT NULL DEFAULT 'active',
	profile_picture TEXT,
	last_login TIMESTAMP WITH TIME ZONE,
	created_by INTEGER REFERENCES users(id),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	
	CONSTRAINT users_client_email_unique UNIQUE(client_id, email),
	CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'user')),
	CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
`

const createGroupsTable = `
CREATE TABLE IF NOT EXISTS groups (
	id SERIAL PRIMARY KEY,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	name VARCHAR(255) NOT NULL,
	description TEXT,
	created_by INTEGER REFERENCES users(id),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	
	UNIQUE(client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_groups_client_id ON groups(client_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
`

const createUserGroupMembershipsTable = `
CREATE TABLE IF NOT EXISTS user_group_memberships (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
	added_by INTEGER REFERENCES users(id),
	added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	
	UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_memberships_user_id ON user_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group_id ON user_group_memberships(group_id);
`

const createMeetingsTable = `
CREATE TABLE IF NOT EXISTS meetings (
	id SERIAL PRIMARY KEY,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	created_by_user_id INTEGER NOT NULL REFERENCES users(id),
	title VARCHAR(255) NOT NULL,
	description TEXT,
	meeting_id VARCHAR(50) NOT NULL UNIQUE,
	password VARCHAR(255),
	scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
	scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
	actual_start TIMESTAMP WITH TIME ZONE,
	actual_end TIMESTAMP WITH TIME ZONE,
	status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
	max_participants INTEGER DEFAULT 100,
	allow_anonymous BOOLEAN DEFAULT false,
	require_approval BOOLEAN DEFAULT false,
	enable_waiting_room BOOLEAN DEFAULT false,
	enable_chat BOOLEAN DEFAULT true,
	enable_screen_sharing BOOLEAN DEFAULT true,
	enable_recording BOOLEAN DEFAULT false,
	settings JSONB DEFAULT '{}',
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	
	CONSTRAINT meetings_status_check CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_id ON meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_start ON meetings(scheduled_start);
`

const createMeetingParticipantsTable = `
CREATE TABLE IF NOT EXISTS meeting_participants (
	id SERIAL PRIMARY KEY,
	meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
	user_id INTEGER REFERENCES users(id),
	email VARCHAR(255),
	name VARCHAR(255),
	role VARCHAR(20) NOT NULL DEFAULT 'attendee' CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')),
	status VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined', 'left')),
	joined_at TIMESTAMP WITH TIME ZONE,
	left_at TIMESTAMP WITH TIME ZONE,
	duration_seconds INTEGER DEFAULT 0,
	is_anonymous BOOLEAN DEFAULT false,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_email ON meeting_participants(email);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(status);
`

const createInvitationsTable = `
CREATE TABLE IF NOT EXISTS invitations (
	id SERIAL PRIMARY KEY,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
	invitation_type VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (invitation_type IN ('email', 'group', 'user')),
	user_id INTEGER REFERENCES users(id),
	group_id INTEGER REFERENCES groups(id),
	email VARCHAR(255),
	guest_name VARCHAR(255),
	token VARCHAR(255) NOT NULL UNIQUE,
	status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
	role VARCHAR(20) NOT NULL DEFAULT 'attendee' CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')),
	message TEXT,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	sent_at TIMESTAMP WITH TIME ZONE,
	responded_at TIMESTAMP WITH TIME ZONE,
	invited_by INTEGER NOT NULL REFERENCES users(id),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_client_id ON invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_meeting_id ON invitations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_invitations_user_id ON invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
`

const createChatMessagesTable = `
CREATE TABLE IF NOT EXISTS chat_messages (
	id SERIAL PRIMARY KEY,
	meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
	sender_user_id INTEGER REFERENCES users(id),
	sender_name VARCHAR(255) NOT NULL,
	sender_email VARCHAR(255),
	message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'emoji', 'system')),
	content TEXT NOT NULL,
	file_url TEXT,
	file_name VARCHAR(255),
	file_size INTEGER,
	is_private BOOLEAN DEFAULT false,
	recipient_user_id INTEGER REFERENCES users(id),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_private ON chat_messages(is_private);
`

const createRecordingsTable = `
CREATE TABLE IF NOT EXISTS recordings (
	id SERIAL PRIMARY KEY,
	meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
	started_by_user_id INTEGER NOT NULL REFERENCES users(id),
	file_name VARCHAR(255) NOT NULL,
	file_path TEXT NOT NULL,
	file_size INTEGER DEFAULT 0,
	duration_seconds INTEGER DEFAULT 0,
	format VARCHAR(10) DEFAULT 'mp4',
	status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
	download_url TEXT,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE,
	processed_at TIMESTAMP WITH TIME ZONE,
	expires_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_started_by ON recordings(started_by_user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_started_at ON recordings(started_at);
`

const createRefreshTokensTable = `
CREATE TABLE IF NOT EXISTS refresh_tokens (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
`

const createPasswordResetTokensTable = `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
	id SERIAL PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	used_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
`

const insertDefaultClient = `
INSERT INTO clients (id, email, app_name, logo_url, theme, primary_color, created_at, updated_at)
VALUES (1, 'admin@videoconference.dev', 'Video Conference Platform', NULL, 'default', '#007bff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
`

const updateInvitationsTable = `
-- Add missing columns to existing invitations table
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS client_id INTEGER,
ADD COLUMN IF NOT EXISTS invitation_type VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS group_id INTEGER,
ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invited_by INTEGER;

-- Update client_id for existing records (set to default client)
UPDATE invitations SET client_id = 1 WHERE client_id IS NULL;

-- Add constraints after populating data
ALTER TABLE invitations 
ALTER COLUMN client_id SET NOT NULL,
ADD CONSTRAINT fk_invitations_client_id FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_invitations_user_id FOREIGN KEY (user_id) REFERENCES users(id),
ADD CONSTRAINT fk_invitations_group_id FOREIGN KEY (group_id) REFERENCES groups(id),
ADD CONSTRAINT fk_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users(id);

-- Add check constraint for invitation_type
ALTER TABLE invitations 
ADD CONSTRAINT chk_invitations_invitation_type CHECK (invitation_type IN ('email', 'group', 'user'));

-- Update status constraint to include new values
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE invitations 
ADD CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_invitations_client_id ON invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_user_id ON invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON invitations(group_id);
`

