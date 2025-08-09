package database

import (
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"github.com/jmoiron/sqlx"
)

// runNewMigrations executes the complete database schema redesign
func runNewMigrations(db *DB) error {
	log.Printf("🔄 Starting complete database schema redesign...")
	
	// Read the complete schema redesign SQL file
	schemaPath := filepath.Join("migrations", "complete_schema_redesign.sql")
	schemaSQL, err := ioutil.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}
	
	// Execute the complete schema
	if _, err := db.DB.Exec(string(schemaSQL)); err != nil {
		return fmt.Errorf("failed to execute schema redesign: %w", err)
	}
	
	log.Printf("✅ Complete database schema redesign completed successfully")
	return nil
}

// RunSchemaReset drops the entire public schema and recreates it
func RunSchemaReset(db *DB) error {
	log.Printf("⚠️  WARNING: Resetting entire database schema...")
	
	// Read the reset script
	resetPath := filepath.Join("migrations", "reset_database.sql")
	resetSQL, err := ioutil.ReadFile(resetPath)
	if err != nil {
		return fmt.Errorf("failed to read reset script: %w", err)
	}
	
	// Execute the reset
	if _, err := db.DB.Exec(string(resetSQL)); err != nil {
		return fmt.Errorf("failed to reset database: %w", err)
	}
	
	log.Printf("✅ Database reset completed")
	return nil
}

// MigrateToNewSchema performs the complete migration to the new schema
func MigrateToNewSchema(db *DB) error {
	log.Printf("🚀 Starting complete migration to new schema...")
	
	// Step 1: Reset the database
	if err := RunSchemaReset(db); err != nil {
		return fmt.Errorf("failed to reset database: %w", err)
	}
	
	// Step 2: Apply new schema
	if err := runNewMigrations(db); err != nil {
		return fmt.Errorf("failed to apply new schema: %w", err)
	}
	
	log.Printf("✅ Complete migration to new schema finished successfully")
	return nil
}

// checkTablesExist verifies that all required tables exist
func checkTablesExist(db *sqlx.DB) error {
	requiredTables := []string{
		"clients", "users", "client_features", "groups", "user_group_memberships",
		"meetings", "meeting_participants", "meeting_participant_extended",
		"admin_invitations", "user_invitations", "meeting_permissions",
		"raise_hands", "meeting_analytics", "speaking_activity",
		"user_analytics", "user_preferences", "user_meeting_bookmarks",
		"chat_messages", "recordings", "email_templates",
	}
	
	for _, table := range requiredTables {
		var exists bool
		query := `SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name = $1
		)`
		
		if err := db.QueryRow(query, table).Scan(&exists); err != nil {
			return fmt.Errorf("failed to check if table %s exists: %w", table, err)
		}
		
		if !exists {
			return fmt.Errorf("required table %s does not exist", table)
		}
	}
	
	log.Printf("✅ All required tables exist")
	return nil
}

// validateSampleData ensures sample data was inserted correctly
func validateSampleData(db *sqlx.DB) error {
	// Check if super admin user exists
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'super_admin'").Scan(&count); err != nil {
		return fmt.Errorf("failed to check super admin user: %w", err)
	}
	
	if count == 0 {
		return fmt.Errorf("no super admin user found")
	}
	
	// Check if demo organization exists
	if err := db.QueryRow("SELECT COUNT(*) FROM clients WHERE email = 'demo@organization.com'").Scan(&count); err != nil {
		return fmt.Errorf("failed to check demo organization: %w", err)
	}
	
	if count == 0 {
		return fmt.Errorf("demo organization not found")
	}
	
	log.Printf("✅ Sample data validation passed")
	return nil
}

// PostMigrationValidation runs comprehensive validation after migration
func PostMigrationValidation(db *DB) error {
	log.Printf("🔍 Running post-migration validation...")
	
	// Check all tables exist
	if err := checkTablesExist(db.DB); err != nil {
		return fmt.Errorf("table validation failed: %w", err)
	}
	
	// Validate sample data
	if err := validateSampleData(db.DB); err != nil {
		return fmt.Errorf("sample data validation failed: %w", err)
	}
	
	// Check foreign key constraints
	var constraintCount int
	if err := db.DB.QueryRow(`
		SELECT COUNT(*) 
		FROM information_schema.table_constraints 
		WHERE constraint_type = 'FOREIGN KEY' 
		AND table_schema = 'public'
	`).Scan(&constraintCount); err != nil {
		return fmt.Errorf("failed to check foreign key constraints: %w", err)
	}
	
	if constraintCount < 30 {
		return fmt.Errorf("expected at least 30 foreign key constraints, found %d", constraintCount)
	}
	
	log.Printf("✅ Post-migration validation completed successfully")
	return nil
}