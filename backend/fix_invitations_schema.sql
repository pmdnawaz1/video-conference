-- Fix invitations table schema for hosted database
-- Run this on your hosted PostgreSQL database: 34.16.8.106:5432/videoconf_dev

-- Step 1: Add missing columns if they don't exist
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS client_id INTEGER,
ADD COLUMN IF NOT EXISTS invitation_type VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS group_id INTEGER,
ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invited_by INTEGER;

-- Step 2: Update existing records with default client_id (assuming client with ID 1 exists)
UPDATE invitations SET client_id = 1 WHERE client_id IS NULL;

-- Step 3: Make client_id NOT NULL after populating data
ALTER TABLE invitations ALTER COLUMN client_id SET NOT NULL;

-- Step 4: Add foreign key constraints
ALTER TABLE invitations 
ADD CONSTRAINT IF NOT EXISTS fk_invitations_client_id 
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE invitations 
ADD CONSTRAINT IF NOT EXISTS fk_invitations_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE invitations 
ADD CONSTRAINT IF NOT EXISTS fk_invitations_group_id 
    FOREIGN KEY (group_id) REFERENCES groups(id);

ALTER TABLE invitations 
ADD CONSTRAINT IF NOT EXISTS fk_invitations_invited_by 
    FOREIGN KEY (invited_by) REFERENCES users(id);

-- Step 5: Add check constraints
ALTER TABLE invitations 
ADD CONSTRAINT IF NOT EXISTS chk_invitations_invitation_type 
    CHECK (invitation_type IN ('email', 'group', 'user'));

-- Step 6: Update status constraint to include new values
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE invitations 
ADD CONSTRAINT invitations_status_check 
    CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'cancelled'));

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_client_id ON invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_user_id ON invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);

-- Step 8: Verify the schema
\d invitations;

-- Optional: Check if default client exists, if not create it
INSERT INTO clients (id, email, app_name, logo_url, theme, primary_color, created_at, updated_at)
VALUES (1, 'admin@videoconference.dev', 'Video Conference Platform', NULL, 'default', '#007bff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Optional: Verify the fix worked
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invitations' 
    AND table_schema = 'public'
ORDER BY ordinal_position;