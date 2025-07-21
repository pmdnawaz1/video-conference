package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type RecordingService interface {
	StartRecording(ctx context.Context, recording *models.Recording) error
	StopRecording(ctx context.Context, recordingID int, stoppedBy int) error
	GetRecordingByID(ctx context.Context, id int) (*models.Recording, error)
	UpdateRecording(ctx context.Context, recording *models.Recording) error
	DeleteRecording(ctx context.Context, id int) error
	
	// Recording queries
	GetRecordingsByMeeting(ctx context.Context, meetingID int) ([]*models.Recording, error)
	GetRecordingsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Recording, error)
	GetPublicRecordings(ctx context.Context, clientID int, limit, offset int) ([]*models.Recording, error)
	GetRecordingsByStatus(ctx context.Context, status string, limit, offset int) ([]*models.Recording, error)
	GetRecordingsByDateRange(ctx context.Context, clientID int, start, end time.Time) ([]*models.Recording, error)
	
	// Recording processing
	ProcessRecording(ctx context.Context, recordingID int) error
	GenerateDownloadURL(ctx context.Context, recordingID int, expiresIn time.Duration) (string, error)
	GenerateStreamingURL(ctx context.Context, recordingID int) (string, error)
	
	// File management
	GetRecordingFilePath(ctx context.Context, recordingID int) (string, error)
	DeleteRecordingFile(ctx context.Context, recordingID int) error
	GetRecordingFileSize(ctx context.Context, recordingID int) (int64, error)
	
	// Recording permissions
	CanAccessRecording(ctx context.Context, recordingID, userID int) (bool, error)
	SetRecordingPassword(ctx context.Context, recordingID int, password string) error
	VerifyRecordingPassword(ctx context.Context, recordingID int, password string) (bool, error)
	
	// Recording statistics
	GetRecordingStats(ctx context.Context, clientID int) (*RecordingStats, error)
	GetStorageUsage(ctx context.Context, clientID int) (*StorageUsage, error)
	
	// Cleanup and maintenance
	CleanupExpiredRecordings(ctx context.Context) error
	ArchiveOldRecordings(ctx context.Context, olderThan time.Duration) error
}

type RecordingStats struct {
	TotalRecordings      int                    `json:"total_recordings"`
	TotalDurationMinutes int                    `json:"total_duration_minutes"`
	TotalSizeBytes       int64                  `json:"total_size_bytes"`
	RecordingsByStatus   map[string]int         `json:"recordings_by_status"`
	RecordingsByMonth    []MonthlyRecordings    `json:"recordings_by_month"`
	AverageDuration      float64                `json:"average_duration_minutes"`
}

type StorageUsage struct {
	TotalSizeBytes    int64   `json:"total_size_bytes"`
	TotalSizeMB       float64 `json:"total_size_mb"`
	TotalSizeGB       float64 `json:"total_size_gb"`
	RecordingCount    int     `json:"recording_count"`
	AverageFileSize   int64   `json:"average_file_size_bytes"`
	OldestRecording   *string `json:"oldest_recording"`
	NewestRecording   *string `json:"newest_recording"`
}

type MonthlyRecordings struct {
	Month       string `json:"month"`
	Year        int    `json:"year"`
	Count       int    `json:"count"`
	TotalSizeMB int64  `json:"total_size_mb"`
}

type recordingService struct {
	db     *database.DB
	config *config.StorageConfig
}

func NewRecordingService(db *database.DB, cfg *config.StorageConfig) RecordingService {
	return &recordingService{
		db:     db,
		config: cfg,
	}
}

func (s *recordingService) StartRecording(ctx context.Context, recording *models.Recording) error {
	// Set initial status and start time
	recording.Status = "recording"
	now := time.Now()
	recording.StartedAt = &now

	// Generate file path
	if recording.FilePath == nil {
		filePath := s.generateFilePath(recording.MeetingID)
		recording.FilePath = &filePath
	}

	query := `
		INSERT INTO recordings (client_id, meeting_id, title, description, status, started_at, 
		                       file_path, metadata, settings, started_by, is_public, password, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, recording, query,
		recording.ClientID, recording.MeetingID, recording.Title, recording.Description,
		recording.Status, recording.StartedAt, recording.FilePath, recording.Metadata,
		recording.Settings, recording.StartedBy, recording.IsPublic, recording.Password,
		recording.ExpiresAt)
	if err != nil {
		return fmt.Errorf("failed to start recording: %w", err)
	}

	return nil
}

func (s *recordingService) StopRecording(ctx context.Context, recordingID int, stoppedBy int) error {
	now := time.Now()
	
	// Get current recording to calculate duration
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.Status != "recording" {
		return fmt.Errorf("recording is not currently active")
	}

	// Calculate duration
	var duration *int
	if recording.StartedAt != nil {
		durationSeconds := int(now.Sub(*recording.StartedAt).Seconds())
		duration = &durationSeconds
	}

	query := `
		UPDATE recordings 
		SET status = $2, ended_at = $3, duration = $4, stopped_by = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, recordingID, "processing", now, duration, stoppedBy)
	if err != nil {
		return fmt.Errorf("failed to stop recording: %w", err)
	}

	// Update file size if file exists
	go s.updateFileSize(recordingID)

	return nil
}

func (s *recordingService) GetRecordingByID(ctx context.Context, id int) (*models.Recording, error) {
	recording := &models.Recording{}
	query := `SELECT * FROM recordings WHERE id = $1`
	
	err := s.db.GetContext(ctx, recording, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get recording by ID: %w", err)
	}
	
	return recording, nil
}

func (s *recordingService) UpdateRecording(ctx context.Context, recording *models.Recording) error {
	query := `
		UPDATE recordings 
		SET title = $2, description = $3, is_public = $4, password = $5, 
		    expires_at = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query,
		recording.ID, recording.Title, recording.Description, recording.IsPublic,
		recording.Password, recording.ExpiresAt)
	if err != nil {
		return fmt.Errorf("failed to update recording: %w", err)
	}
	
	return nil
}

func (s *recordingService) DeleteRecording(ctx context.Context, id int) error {
	recording, err := s.GetRecordingByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get recording: %w", err)
	}

	// Delete the physical file
	if recording.FilePath != nil {
		err = s.DeleteRecordingFile(ctx, id)
		if err != nil {
			// Log error but continue with database deletion
			fmt.Printf("Failed to delete recording file: %v\n", err)
		}
	}

	// Delete from database
	query := `DELETE FROM recordings WHERE id = $1`
	_, err = s.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete recording: %w", err)
	}
	
	return nil
}

func (s *recordingService) GetRecordingsByMeeting(ctx context.Context, meetingID int) ([]*models.Recording, error) {
	recordings := []*models.Recording{}
	query := `
		SELECT * FROM recordings 
		WHERE meeting_id = $1 
		ORDER BY started_at DESC`
	
	err := s.db.SelectContext(ctx, &recordings, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recordings by meeting: %w", err)
	}
	
	return recordings, nil
}

func (s *recordingService) GetRecordingsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Recording, error) {
	recordings := []*models.Recording{}
	query := `
		SELECT * FROM recordings 
		WHERE client_id = $1 
		ORDER BY started_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &recordings, query, clientID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get recordings by client: %w", err)
	}
	
	return recordings, nil
}

func (s *recordingService) GetPublicRecordings(ctx context.Context, clientID int, limit, offset int) ([]*models.Recording, error) {
	recordings := []*models.Recording{}
	query := `
		SELECT * FROM recordings 
		WHERE client_id = $1 AND is_public = true AND status = 'completed'
		ORDER BY started_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &recordings, query, clientID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get public recordings: %w", err)
	}
	
	return recordings, nil
}

func (s *recordingService) GetRecordingsByStatus(ctx context.Context, status string, limit, offset int) ([]*models.Recording, error) {
	recordings := []*models.Recording{}
	query := `
		SELECT * FROM recordings 
		WHERE status = $1 
		ORDER BY started_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &recordings, query, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get recordings by status: %w", err)
	}
	
	return recordings, nil
}

func (s *recordingService) GetRecordingsByDateRange(ctx context.Context, clientID int, start, end time.Time) ([]*models.Recording, error) {
	recordings := []*models.Recording{}
	query := `
		SELECT * FROM recordings 
		WHERE client_id = $1 AND started_at >= $2 AND started_at <= $3
		ORDER BY started_at DESC`
	
	err := s.db.SelectContext(ctx, &recordings, query, clientID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get recordings by date range: %w", err)
	}
	
	return recordings, nil
}

func (s *recordingService) ProcessRecording(ctx context.Context, recordingID int) error {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.Status != "processing" {
		return fmt.Errorf("recording is not in processing state")
	}

	// Simulate processing (in reality, this would involve video transcoding, etc.)
	// Update status to completed
	query := `
		UPDATE recordings 
		SET status = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, recordingID, "completed")
	if err != nil {
		return fmt.Errorf("failed to update recording status: %w", err)
	}

	// Generate URLs
	downloadURL, _ := s.GenerateDownloadURL(ctx, recordingID, 24*time.Hour)
	streamingURL, _ := s.GenerateStreamingURL(ctx, recordingID)

	// Update URLs
	query = `
		UPDATE recordings 
		SET download_url = $2, streaming_url = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, recordingID, downloadURL, streamingURL)
	if err != nil {
		return fmt.Errorf("failed to update recording URLs: %w", err)
	}

	return nil
}

func (s *recordingService) GenerateDownloadURL(ctx context.Context, recordingID int, expiresIn time.Duration) (string, error) {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return "", fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.FilePath == nil {
		return "", fmt.Errorf("recording file path not found")
	}

	// Generate a temporary download URL
	// This is a simplified implementation - in production, you'd use signed URLs
	baseURL := "http://localhost:8081" // TODO: Make configurable
	downloadURL := fmt.Sprintf("%s/api/recordings/%d/download", baseURL, recordingID)
	
	return downloadURL, nil
}

func (s *recordingService) GenerateStreamingURL(ctx context.Context, recordingID int) (string, error) {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return "", fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.FilePath == nil {
		return "", fmt.Errorf("recording file path not found")
	}

	// Generate a streaming URL
	baseURL := "http://localhost:8081" // TODO: Make configurable
	streamingURL := fmt.Sprintf("%s/api/recordings/%d/stream", baseURL, recordingID)
	
	return streamingURL, nil
}

func (s *recordingService) GetRecordingFilePath(ctx context.Context, recordingID int) (string, error) {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return "", fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.FilePath == nil {
		return "", fmt.Errorf("recording file path not found")
	}

	return *recording.FilePath, nil
}

func (s *recordingService) DeleteRecordingFile(ctx context.Context, recordingID int) error {
	filePath, err := s.GetRecordingFilePath(ctx, recordingID)
	if err != nil {
		return fmt.Errorf("failed to get file path: %w", err)
	}

	fullPath := filepath.Join(s.config.RecordingPath, filePath)
	err = os.Remove(fullPath)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

func (s *recordingService) GetRecordingFileSize(ctx context.Context, recordingID int) (int64, error) {
	filePath, err := s.GetRecordingFilePath(ctx, recordingID)
	if err != nil {
		return 0, fmt.Errorf("failed to get file path: %w", err)
	}

	fullPath := filepath.Join(s.config.RecordingPath, filePath)
	fileInfo, err := os.Stat(fullPath)
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %w", err)
	}

	return fileInfo.Size(), nil
}

func (s *recordingService) CanAccessRecording(ctx context.Context, recordingID, userID int) (bool, error) {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return false, fmt.Errorf("failed to get recording: %w", err)
	}

	// Check if recording is public
	if recording.IsPublic {
		return true, nil
	}

	// Check if user is the meeting host or participant
	query := `
		SELECT COUNT(*) FROM meetings m
		LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
		WHERE m.id = $1 AND (m.host_id = $2 OR mp.user_id = $2)`
	
	var count int
	err = s.db.GetContext(ctx, &count, query, recording.MeetingID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check access: %w", err)
	}

	return count > 0, nil
}

func (s *recordingService) SetRecordingPassword(ctx context.Context, recordingID int, password string) error {
	query := `
		UPDATE recordings 
		SET password = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, recordingID, password)
	if err != nil {
		return fmt.Errorf("failed to set recording password: %w", err)
	}
	
	return nil
}

func (s *recordingService) VerifyRecordingPassword(ctx context.Context, recordingID int, password string) (bool, error) {
	recording, err := s.GetRecordingByID(ctx, recordingID)
	if err != nil {
		return false, fmt.Errorf("failed to get recording: %w", err)
	}

	if recording.Password == nil {
		return true, nil // No password required
	}

	return *recording.Password == password, nil
}

func (s *recordingService) GetRecordingStats(ctx context.Context, clientID int) (*RecordingStats, error) {
	stats := &RecordingStats{
		RecordingsByStatus: make(map[string]int),
		RecordingsByMonth:  []MonthlyRecordings{},
	}

	// Total recordings
	query := `SELECT COUNT(*) FROM recordings WHERE client_id = $1`
	err := s.db.GetContext(ctx, &stats.TotalRecordings, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total recordings: %w", err)
	}

	// Total duration and size
	query = `
		SELECT COALESCE(SUM(duration), 0) as total_duration, COALESCE(SUM(file_size), 0) as total_size
		FROM recordings WHERE client_id = $1 AND status = 'completed'`
	
	err = s.db.QueryRowContext(ctx, query, clientID).Scan(&stats.TotalDurationMinutes, &stats.TotalSizeBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to get duration and size stats: %w", err)
	}
	
	// Convert seconds to minutes
	stats.TotalDurationMinutes = stats.TotalDurationMinutes / 60

	// Average duration
	if stats.TotalRecordings > 0 {
		stats.AverageDuration = float64(stats.TotalDurationMinutes) / float64(stats.TotalRecordings)
	}

	// Recordings by status
	query = `
		SELECT status, COUNT(*) 
		FROM recordings 
		WHERE client_id = $1 
		GROUP BY status`
	
	rows, err := s.db.QueryContext(ctx, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recordings by status: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			continue
		}
		stats.RecordingsByStatus[status] = count
	}

	return stats, nil
}

func (s *recordingService) GetStorageUsage(ctx context.Context, clientID int) (*StorageUsage, error) {
	usage := &StorageUsage{}

	query := `
		SELECT 
			COALESCE(SUM(file_size), 0) as total_size,
			COUNT(*) as recording_count,
			COALESCE(AVG(file_size), 0) as avg_size,
			MIN(created_at) as oldest,
			MAX(created_at) as newest
		FROM recordings 
		WHERE client_id = $1 AND file_size IS NOT NULL`
	
	var oldest, newest *string
	err := s.db.QueryRowContext(ctx, query, clientID).Scan(
		&usage.TotalSizeBytes, &usage.RecordingCount, &usage.AverageFileSize, &oldest, &newest)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage usage: %w", err)
	}

	usage.TotalSizeMB = float64(usage.TotalSizeBytes) / (1024 * 1024)
	usage.TotalSizeGB = float64(usage.TotalSizeBytes) / (1024 * 1024 * 1024)
	usage.OldestRecording = oldest
	usage.NewestRecording = newest

	return usage, nil
}

func (s *recordingService) CleanupExpiredRecordings(ctx context.Context) error {
	// Get expired recordings
	query := `SELECT id FROM recordings WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`
	
	var recordingIDs []int
	err := s.db.SelectContext(ctx, &recordingIDs, query)
	if err != nil {
		return fmt.Errorf("failed to get expired recordings: %w", err)
	}

	// Delete each expired recording
	for _, id := range recordingIDs {
		err = s.DeleteRecording(ctx, id)
		if err != nil {
			fmt.Printf("Failed to delete expired recording %d: %v\n", id, err)
		}
	}

	return nil
}

func (s *recordingService) ArchiveOldRecordings(ctx context.Context, olderThan time.Duration) error {
	cutoffTime := time.Now().Add(-olderThan)
	
	query := `
		UPDATE recordings 
		SET status = 'archived', updated_at = CURRENT_TIMESTAMP
		WHERE created_at < $1 AND status = 'completed'`
	
	_, err := s.db.ExecContext(ctx, query, cutoffTime)
	if err != nil {
		return fmt.Errorf("failed to archive old recordings: %w", err)
	}
	
	return nil
}

// Helper methods

func (s *recordingService) generateFilePath(meetingID int) string {
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("meeting_%d_%s.mp4", meetingID, timestamp)
	return filename
}

func (s *recordingService) updateFileSize(recordingID int) {
	ctx := context.Background()
	
	fileSize, err := s.GetRecordingFileSize(ctx, recordingID)
	if err != nil {
		return
	}

	query := `UPDATE recordings SET file_size = $2 WHERE id = $1`
	s.db.ExecContext(ctx, query, recordingID, fileSize)
}