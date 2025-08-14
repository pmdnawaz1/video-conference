package models

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// Helper functions for model operations

// IntPtr returns a pointer to the given int
func IntPtr(i int) *int {
	return &i
}

// StringPtr returns a pointer to the given string
func StringPtr(s string) *string {
	return &s
}

// TimePtr returns a pointer to the given time
func TimePtr(t time.Time) *time.Time {
	return &t
}

// GenerateToken generates a random token for invitations
func GenerateToken() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based token
		return fmt.Sprintf("token_%d", time.Now().Unix())
	}
	return hex.EncodeToString(bytes)
}

// GenerateMeetingID generates a unique meeting ID
func GenerateMeetingID() string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based ID
		return fmt.Sprintf("meeting_%d", time.Now().Unix())
	}
	return hex.EncodeToString(bytes)
}

// FormatDuration formats a duration in seconds to a human-readable string
func FormatDuration(seconds int) string {
	if seconds < 60 {
		return fmt.Sprintf("%d seconds", seconds)
	}
	if seconds < 3600 {
		return fmt.Sprintf("%d minutes", seconds/60)
	}
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	if minutes == 0 {
		return fmt.Sprintf("%d hours", hours)
	}
	return fmt.Sprintf("%d hours %d minutes", hours, minutes)
}

// GetDurationInMinutes converts seconds to minutes
func GetDurationInMinutes(seconds int) int {
	return seconds / 60
}

// ValidateEmail performs basic email validation
func ValidateEmail(email string) bool {
	// Basic validation - could be enhanced with regex
	return len(email) > 5 && len(email) < 255 && 
		   len(email) > len("a@b.c") && 
		   email[0] != '@' && email[len(email)-1] != '@'
}