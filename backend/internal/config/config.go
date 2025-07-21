package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds the application configuration
type Config struct {
	Server      ServerConfig
	Database    DatabaseConfig
	Auth        AuthConfig
	Email       EmailConfig
	WebRTC      WebRTCConfig
	Storage     StorageConfig
	Redis       RedisConfig
	Features    FeatureConfig
	Development DevelopmentConfig
}

type ServerConfig struct {
	Port        string
	Environment string
	Debug       bool
	CORSOrigins []string
}

type DatabaseConfig struct {
	Host            string
	Port            string
	Name            string
	User            string
	Password        string
	SSLMode         string
	MaxConnections  int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type AuthConfig struct {
	JWTSecret             string
	AccessTokenExpiry     time.Duration
	RefreshTokenExpiry    time.Duration
	PasswordResetExpiry   time.Duration
	BCryptCost            int
}

type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromName     string
	FromEmail    string
}

type WebRTCConfig struct {
	STUNServers    []string
	TURNServerURL  string
	TURNUsername   string
	TURNCredential string
}

type StorageConfig struct {
	Type              string // "local" or "s3"
	LocalPath         string
	RecordingPath     string
	MaxSizeMB         int
	AllowedTypes      []string
	AWSRegion         string
	AWSBucket         string
	AWSAccessKey      string
	AWSSecretKey      string
}

type RedisConfig struct {
	URL        string
	Password   string
	DB         int
	MaxRetries int
}

type FeatureConfig struct {
	Chat          bool
	Reactions     bool
	ScreenSharing bool
	Recording     bool
	WaitingRoom   bool
	BreakoutRooms bool
}

type DevelopmentConfig struct {
	AutoMigrate bool
	SeedData    bool
}

// Load loads the configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// .env file is optional
	}

	config := &Config{
		Server: ServerConfig{
			Port:        getEnv("PORT", "8081"),
			Environment: getEnv("ENV", "development"),
			Debug:       getBoolEnv("DEBUG", true),
			CORSOrigins: strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"), ","),
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			Name:            getEnv("DB_NAME", "video_conference"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", ""),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxConnections:  getIntEnv("DB_MAX_CONNECTIONS", 25),
			MaxIdleConns:    getIntEnv("DB_MAX_IDLE_CONNECTIONS", 10),
			ConnMaxLifetime: time.Duration(getIntEnv("DB_MAX_LIFETIME_MINUTES", 60)) * time.Minute,
		},
		Auth: AuthConfig{
			JWTSecret:           getEnv("JWT_SECRET", ""),
			AccessTokenExpiry:   time.Duration(getIntEnv("JWT_ACCESS_EXPIRY_MINUTES", 15)) * time.Minute,
			RefreshTokenExpiry:  time.Duration(getIntEnv("JWT_REFRESH_EXPIRY_DAYS", 7)) * 24 * time.Hour,
			PasswordResetExpiry: time.Duration(getIntEnv("PASSWORD_RESET_EXPIRY_HOURS", 1)) * time.Hour,
			BCryptCost:          getIntEnv("BCRYPT_COST", 12),
		},
		Email: EmailConfig{
			SMTPHost:     getEnv("SMTP_HOST", ""),
			SMTPPort:     getIntEnv("SMTP_PORT", 587),
			SMTPUsername: getEnv("SMTP_USERNAME", ""),
			SMTPPassword: getEnv("SMTP_PASSWORD", ""),
			FromName:     getEnv("SMTP_FROM_NAME", "Video Conference Platform"),
			FromEmail:    getEnv("SMTP_FROM_EMAIL", ""),
		},
		WebRTC: WebRTCConfig{
			STUNServers:    strings.Split(getEnv("STUN_SERVERS", "stun:stun.l.google.com:19302"), ","),
			TURNServerURL:  getEnv("TURN_SERVER_URL", ""),
			TURNUsername:   getEnv("TURN_USERNAME", ""),
			TURNCredential: getEnv("TURN_CREDENTIAL", ""),
		},
		Storage: StorageConfig{
			Type:          getEnv("STORAGE_TYPE", "local"),
			LocalPath:     getEnv("STORAGE_PATH", "./uploads"),
			RecordingPath: getEnv("RECORDING_STORAGE_PATH", "./recordings"),
			MaxSizeMB:     getIntEnv("UPLOAD_MAX_SIZE_MB", 100),
			AllowedTypes:  strings.Split(getEnv("UPLOAD_ALLOWED_TYPES", "jpg,jpeg,png,gif,pdf,doc,docx"), ","),
			AWSRegion:     getEnv("AWS_REGION", ""),
			AWSBucket:     getEnv("AWS_S3_BUCKET", ""),
			AWSAccessKey:  getEnv("AWS_ACCESS_KEY_ID", ""),
			AWSSecretKey:  getEnv("AWS_SECRET_ACCESS_KEY", ""),
		},
		Redis: RedisConfig{
			URL:        getEnv("REDIS_URL", "redis://localhost:6379"),
			Password:   getEnv("REDIS_PASSWORD", ""),
			DB:         getIntEnv("REDIS_DB", 0),
			MaxRetries: getIntEnv("REDIS_MAX_RETRIES", 3),
		},
		Features: FeatureConfig{
			Chat:          getBoolEnv("FEATURE_CHAT", true),
			Reactions:     getBoolEnv("FEATURE_REACTIONS", true),
			ScreenSharing: getBoolEnv("FEATURE_SCREEN_SHARING", true),
			Recording:     getBoolEnv("FEATURE_RECORDING", true),
			WaitingRoom:   getBoolEnv("FEATURE_WAITING_ROOM", true),
			BreakoutRooms: getBoolEnv("FEATURE_BREAKOUT_ROOMS", false),
		},
		Development: DevelopmentConfig{
			AutoMigrate: getBoolEnv("DEV_AUTO_MIGRATE", true),
			SeedData:    getBoolEnv("DEV_SEED_DATA", false),
		},
	}

	// Validate required configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return config, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Database.Password == "" {
		return fmt.Errorf("DB_PASSWORD is required")
	}

	if c.Auth.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}

	if len(c.Auth.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters long")
	}

	return nil
}

// Helper functions to get environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}