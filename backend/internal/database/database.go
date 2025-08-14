package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"video-conference-backend/internal/config"
)

// DB wraps sqlx.DB with additional functionality
type DB struct {
	*sqlx.DB
}

// NewConnection creates a new database connection
func NewConnection(cfg config.DatabaseConfig) (*DB, error) {
	log.Printf("🔌 Initializing database connection to %s:%s/%s", cfg.Host, cfg.Port, cfg.Name)
	
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode,
	)

	log.Printf("🔄 Attempting to connect to PostgreSQL database...")
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		log.Printf("❌ Database connection failed: %v", err)
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Printf("⚙️  Configuring connection pool (max: %d, idle: %d, lifetime: %v)", 
		cfg.MaxConnections, cfg.MaxIdleConns, cfg.ConnMaxLifetime)
	
	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxConnections)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test the connection
	log.Printf("🏓 Testing database connectivity...")
	if err := db.Ping(); err != nil {
		log.Printf("❌ Database ping failed: %v", err)
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("✅ Database successfully connected and initialized")
	return &DB{db}, nil
}

// RunMigrations runs database migrations using the new migration system
func RunMigrations(db *DB) error {
	// Check if tables exist, only run initial migration if needed
	var tableCount int
	err := db.DB.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'").Scan(&tableCount)
	if err != nil {
		return fmt.Errorf("failed to check existing tables: %w", err)
	}
	
	if tableCount < 10 { // If we have fewer than 10 tables, run initial setup
		log.Printf("🔄 Running initial database schema setup...")
		return MigrateToNewSchema(db)
	} else {
		log.Printf("✅ Database schema already exists (%d tables found), skipping destructive migration", tableCount)
		// Run any additive migrations here if needed
		return ensureRefreshTokensTable(db)
	}
}

// ensureRefreshTokensTable creates refresh_tokens table if it doesn't exist
func ensureRefreshTokensTable(db *DB) error {
	query := `
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
	CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);`
	
	_, err := db.DB.Exec(query)
	if err != nil {
		log.Printf("⚠️ Note: refresh_tokens table might already exist")
	}
	return nil
}

// RunLegacyMigrations runs the old step-by-step migrations (for backward compatibility)
// Deprecated: Use RunMigrations instead
func RunLegacyMigrations(db *DB) error {
	return fmt.Errorf("legacy migrations are no longer supported, use RunMigrations instead")
}

// Transaction wraps a function in a database transaction
func (db *DB) Transaction(fn func(*sqlx.Tx) error) error {
	tx, err := db.Beginx()
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	err = fn(tx)
	return err
}

// HealthCheck performs a health check on the database
func (db *DB) HealthCheck() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var result int
	err := db.GetContext(ctx, &result, "SELECT 1")
	if err != nil {
		log.Printf("❌ Database health check failed: %v", err)
		return err
	}
	
	log.Printf("💚 Database health check passed")
	return nil
}