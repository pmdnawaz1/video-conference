-- Video Conference Database Initialization Script

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types if needed
DO $$ BEGIN
    CREATE TYPE meeting_status AS ENUM ('scheduled', 'active', 'ended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance (Prisma will handle table creation)
-- These will be created after Prisma migrations

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Database settings for performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Note: RESTART required for some settings to take effect
SELECT pg_reload_conf();

-- Create monitoring user for Prometheus PostgreSQL exporter
DO $$ BEGIN
    CREATE ROLE postgres_exporter WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT pg_monitor TO postgres_exporter;
    GRANT SELECT ON pg_stat_database TO postgres_exporter;
    GRANT SELECT ON pg_stat_replication TO postgres_exporter;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;