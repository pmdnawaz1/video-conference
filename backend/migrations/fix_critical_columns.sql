-- Fix critical missing database columns
-- These columns are referenced in Go code but missing from database

-- Add missing columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS enable_chat BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_recording BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_screen_sharing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_waiting_room BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_id INTEGER,
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

-- Add index for recurring meetings
CREATE INDEX IF NOT EXISTS idx_meetings_recurring_id ON meetings(recurring_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by_user_id ON meetings(created_by_user_id);

-- Comments for clarity
COMMENT ON COLUMN meetings.enable_chat IS 'Whether chat is enabled for this meeting';
COMMENT ON COLUMN meetings.enable_recording IS 'Whether recording is enabled for this meeting';
COMMENT ON COLUMN meetings.enable_screen_sharing IS 'Whether screen sharing is enabled for this meeting';
COMMENT ON COLUMN meetings.enable_waiting_room IS 'Whether waiting room is enabled for this meeting';
COMMENT ON COLUMN meetings.recurring_id IS 'ID linking to parent meeting for recurring instances';
COMMENT ON COLUMN meetings.created_by_user_id IS 'User ID who created this meeting';