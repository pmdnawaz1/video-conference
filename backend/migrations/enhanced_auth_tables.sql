-- ============================================================================
-- ENHANCED AUTHENTICATION SYSTEM ADDITIONAL TABLES
-- These tables extend the enhanced authentication system beyond the core tables
-- ============================================================================

-- User backup codes for MFA recovery
CREATE TABLE IF NOT EXISTS user_backup_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the backup code
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_backup_codes_user_id ON user_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_backup_codes_code_hash ON user_backup_codes(code_hash);

-- User sessions for advanced session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY, -- Session ID
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    device_info JSONB, -- Device information including user agent, IP, etc.
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at);

-- OAuth account linkages
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- google, microsoft, etc.
    provider_id VARCHAR(255) NOT NULL, -- Provider's user ID
    email VARCHAR(255), -- Email from OAuth provider
    name VARCHAR(255), -- Name from OAuth provider
    token_info JSONB, -- Access token, refresh token, expires_at, etc.
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user_id ON user_oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_provider ON user_oauth_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_provider_id ON user_oauth_accounts(provider_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_email ON user_oauth_accounts(email);

-- Login attempts tracking for security
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255), -- Email attempted
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- 'invalid_credentials', 'account_locked', 'mfa_failed', etc.
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- Password history to prevent reuse
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- Security events logging
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'mfa_enabled', 'password_changed', etc.
    event_details JSONB,
    ip_address INET,
    user_agent TEXT,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Add triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to relevant tables
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraints for data integrity
ALTER TABLE user_backup_codes 
ADD CONSTRAINT chk_backup_code_not_empty CHECK (LENGTH(code_hash) > 0);

ALTER TABLE user_sessions 
ADD CONSTRAINT chk_session_expires_future CHECK (expires_at > created_at);

ALTER TABLE user_oauth_accounts 
ADD CONSTRAINT chk_oauth_provider_valid CHECK (provider IN ('google', 'microsoft', 'facebook', 'github', 'system'));

ALTER TABLE login_attempts 
ADD CONSTRAINT chk_login_attempt_reason CHECK (
    (success = true AND failure_reason IS NULL) OR 
    (success = false AND failure_reason IS NOT NULL)
);

ALTER TABLE security_events 
ADD CONSTRAINT chk_security_event_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'));

COMMENT ON TABLE user_backup_codes IS 'Stores hashed backup codes for MFA recovery';
COMMENT ON TABLE user_sessions IS 'Advanced session management with device tracking';
COMMENT ON TABLE user_oauth_accounts IS 'OAuth provider account linkages for users';
COMMENT ON TABLE login_attempts IS 'Security tracking of login attempts';
COMMENT ON TABLE password_history IS 'Password history to prevent reuse';
COMMENT ON TABLE security_events IS 'Comprehensive security event logging';