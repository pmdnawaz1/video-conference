-- ============================================================================
-- DATABASE RESET SCRIPT
-- This script will completely reset the database and apply the new schema
-- WARNING: This will delete ALL existing data
-- ============================================================================

-- Terminate all active connections to the database
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() 
  AND pid <> pg_backend_pid();

-- Drop all existing tables and objects
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Grant permissions to current user
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;

-- Comment to confirm reset
COMMENT ON SCHEMA public IS 'Database reset for video conference platform redesign';