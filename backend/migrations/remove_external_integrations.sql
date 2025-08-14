-- Remove unnecessary external integration columns from meetings table
-- Since we're building a standalone video conference platform

ALTER TABLE meetings 
DROP COLUMN IF EXISTS google_meet_link,
DROP COLUMN IF EXISTS zoom_meeting_id,
DROP COLUMN IF EXISTS teams_meeting_url;

-- Remove references to external platforms
COMMENT ON COLUMN meetings.calendar_event_id IS 'Internal calendar event ID for this platform only';