package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

// UserAnalyticsService interface defines user engagement and activity tracking methods
type UserAnalyticsService interface {
	// Core Analytics Methods
	GetUserAnalytics(ctx context.Context, userID int) (*models.UserAnalytics, error)
	RecordMeetingParticipation(ctx context.Context, userID, clientID, durationMinutes int) error
	UpdateUserEngagementScore(ctx context.Context, userID int) error
	RecordChatMessage(ctx context.Context, userID int) error
	
	// Enhanced Analytics Methods
	RecordScreenShare(ctx context.Context, userID int, durationSeconds int) error
	RecordSpeakingActivity(ctx context.Context, userID int, durationSeconds int, audioLevel float64) error
	RecordHandRaise(ctx context.Context, userID int) error
	CalculateEngagementScore(ctx context.Context, userID int) (float64, error)
	GetUserTrends(ctx context.Context, userID int, days int) (*UserTrendAnalysis, error)
	GetParticipationMetrics(ctx context.Context, userID int) (*ParticipationMetrics, error)
	UpdateWeeklyActivity(ctx context.Context, userID int) error
	GetMeetingEffectiveness(ctx context.Context, userID int, meetingID int) (*MeetingEffectiveness, error)
	
	// Bulk Analytics Operations
	ProcessDailyAnalytics(ctx context.Context) error
	GenerateEngagementReport(ctx context.Context, clientID int, startDate, endDate time.Time) (*EngagementReport, error)
	GetTopEngagedUsers(ctx context.Context, clientID int, limit int) ([]*UserEngagementSummary, error)
}

// Analytics data structures
type UserTrendAnalysis struct {
	UserID           int                    `json:"user_id"`
	DailyMeetings    map[string]int         `json:"daily_meetings"`
	DailyDuration    map[string]int         `json:"daily_duration"`
	EngagementTrend  []float64              `json:"engagement_trend"`
	ActivityPattern  map[int]int            `json:"activity_pattern"` // Hour of day -> meeting count
	WeeklyComparison map[string]interface{} `json:"weekly_comparison"`
	TrendDirection   string                 `json:"trend_direction"` // "up", "down", "stable"
}

type ParticipationMetrics struct {
	UserID                 int     `json:"user_id"`
	TotalMeetings          int     `json:"total_meetings"`
	AverageParticipation   float64 `json:"average_participation"`
	SpeakingTimePercentage float64 `json:"speaking_time_percentage"`
	InteractionScore       float64 `json:"interaction_score"`
	AttendanceRate         float64 `json:"attendance_rate"`
	PunctualityScore       float64 `json:"punctuality_score"`
}

type MeetingEffectiveness struct {
	MeetingID            int     `json:"meeting_id"`
	UserID               int     `json:"user_id"`
	ParticipationScore   float64 `json:"participation_score"`
	EngagementLevel      string  `json:"engagement_level"` // "high", "medium", "low"
	SpeakingContribution float64 `json:"speaking_contribution"`
	InteractionCount     int     `json:"interaction_count"`
	OverallRating        float64 `json:"overall_rating"`
}

type EngagementReport struct {
	ClientID         int                      `json:"client_id"`
	StartDate        time.Time                `json:"start_date"`
	EndDate          time.Time                `json:"end_date"`
	TotalUsers       int                      `json:"total_users"`
	AverageScore     float64                  `json:"average_score"`
	TopPerformers    []*UserEngagementSummary `json:"top_performers"`
	EngagementTrends map[string]float64       `json:"engagement_trends"`
	Insights         []string                 `json:"insights"`
}

type UserEngagementSummary struct {
	UserID           int     `json:"user_id"`
	UserName         string  `json:"user_name"`
	Email            string  `json:"email"`
	EngagementScore  float64 `json:"engagement_score"`
	TotalMeetings    int     `json:"total_meetings"`
	TotalDuration    int     `json:"total_duration"`
	ParticipationRate float64 `json:"participation_rate"`
}

// userAnalyticsService handles user engagement and activity tracking
type userAnalyticsService struct {
	db *database.DB
}

// NewUserAnalyticsService creates a new user analytics service
func NewUserAnalyticsService(db *database.DB) UserAnalyticsService {
	return &userAnalyticsService{
		db: db,
	}
}


// RecordMeetingParticipation records a user's participation in a meeting
func (s *userAnalyticsService) RecordMeetingParticipation(ctx context.Context, userID, clientID, durationMinutes int) error {
	// Upsert logic: insert if not exists, update if exists
	query := `
		INSERT INTO user_analytics (user_id, client_id, total_meetings_joined, total_meeting_duration_minutes, last_meeting_date, created_at, updated_at)
		VALUES ($1, $2, 1, $3, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE SET
			total_meetings_joined = user_analytics.total_meetings_joined + 1,
			total_meeting_duration_minutes = user_analytics.total_meeting_duration_minutes + $3,
			last_meeting_date = CURRENT_DATE,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := s.db.ExecContext(ctx, query, userID, clientID, durationMinutes)
	if err != nil {
		return fmt.Errorf("failed to record meeting participation: %w", err)
	}

	return nil
}

// GetUserAnalytics retrieves analytics data for a specific user
func (s *userAnalyticsService) GetUserAnalytics(ctx context.Context, userID int) (*models.UserAnalytics, error) {
	var analytics models.UserAnalytics
	query := `SELECT * FROM user_analytics WHERE user_id = $1`

	err := s.db.GetContext(ctx, &analytics, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user analytics: %w", err)
	}

	return &analytics, nil
}

// UpdateUserEngagementScore calculates and updates the user's comprehensive engagement score
func (s *userAnalyticsService) UpdateUserEngagementScore(ctx context.Context, userID int) error {
	score, err := s.CalculateEngagementScore(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to calculate engagement score: %w", err)
	}

	query := `
		UPDATE user_analytics
		SET engagement_score = $1, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $2
	`

	_, err = s.db.ExecContext(ctx, query, score, userID)
	if err != nil {
		return fmt.Errorf("failed to update engagement score: %w", err)
	}

	return nil
}

// RecordChatMessage increments chat message count for a user
func (s *userAnalyticsService) RecordChatMessage(ctx context.Context, userID int) error {
	query := `
		UPDATE user_analytics
		SET total_chat_messages = total_chat_messages + 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
	`
	_, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to record chat message: %w", err)
	}

	// Update engagement score asynchronously
	go func() {
		if scoreErr := s.UpdateUserEngagementScore(context.Background(), userID); scoreErr != nil {
			log.Printf("Failed to update engagement score for user %d: %v", userID, scoreErr)
		}
	}()

	return nil
}

// ============================================================================
// ENHANCED ANALYTICS METHODS
// ============================================================================

// RecordScreenShare records screen sharing activity
func (s *userAnalyticsService) RecordScreenShare(ctx context.Context, userID int, durationSeconds int) error {
	query := `
		UPDATE user_analytics
		SET total_screen_shares = total_screen_shares + 1,
		    updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
	`
	
	_, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to record screen share: %w", err)
	}

	// Update engagement score
	go func() {
		if scoreErr := s.UpdateUserEngagementScore(context.Background(), userID); scoreErr != nil {
			log.Printf("Failed to update engagement score for user %d: %v", userID, scoreErr)
		}
	}()

	log.Printf("Recorded screen share for user %d, duration: %d seconds", userID, durationSeconds)
	return nil
}

// RecordSpeakingActivity records speaking time and audio levels
func (s *userAnalyticsService) RecordSpeakingActivity(ctx context.Context, userID int, durationSeconds int, audioLevel float64) error {
	// Update speaking time in user analytics
	query := `
		UPDATE user_analytics
		SET total_speaking_time_minutes = total_speaking_time_minutes + $2,
		    updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
	`
	
	speakingMinutes := durationSeconds / 60
	_, err := s.db.ExecContext(ctx, query, userID, speakingMinutes)
	if err != nil {
		return fmt.Errorf("failed to record speaking activity: %w", err)
	}

	// Update engagement score
	go func() {
		if scoreErr := s.UpdateUserEngagementScore(context.Background(), userID); scoreErr != nil {
			log.Printf("Failed to update engagement score for user %d: %v", userID, scoreErr)
		}
	}()

	log.Printf("Recorded speaking activity for user %d: %d seconds, audio level: %.2f", userID, durationSeconds, audioLevel)
	return nil
}

// RecordHandRaise records hand raise activity
func (s *userAnalyticsService) RecordHandRaise(ctx context.Context, userID int) error {
	query := `
		UPDATE user_analytics
		SET total_hand_raises = total_hand_raises + 1,
		    updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
	`
	
	_, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to record hand raise: %w", err)
	}

	// Update engagement score
	go func() {
		if scoreErr := s.UpdateUserEngagementScore(context.Background(), userID); scoreErr != nil {
			log.Printf("Failed to update engagement score for user %d: %v", userID, scoreErr)
		}
	}()

	log.Printf("Recorded hand raise for user %d", userID)
	return nil
}

// CalculateEngagementScore calculates a comprehensive engagement score
func (s *userAnalyticsService) CalculateEngagementScore(ctx context.Context, userID int) (float64, error) {
	var analytics models.UserAnalytics
	query := `SELECT * FROM user_analytics WHERE user_id = $1`
	
	err := s.db.GetContext(ctx, &analytics, query, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get user analytics: %w", err)
	}

	// Complex engagement score algorithm
	var score float64

	// Meeting participation weight (40%)
	meetingScore := float64(analytics.TotalMeetingsJoined) * 2.0
	if meetingScore > 100 {
		meetingScore = 100 // Cap at 100
	}

	// Duration weight (25%)
	durationScore := float64(analytics.TotalMeetingDurationMins) * 0.05
	if durationScore > 100 {
		durationScore = 100
	}

	// Speaking activity weight (20%)
	var speakingScore float64
	if analytics.TotalMeetingDurationMins > 0 {
		speakingRatio := float64(analytics.TotalSpeakingTimeMins) / float64(analytics.TotalMeetingDurationMins)
		speakingScore = speakingRatio * 200 // Scale appropriately
		if speakingScore > 100 {
			speakingScore = 100
		}
	}

	// Interaction weight (15%) - chat messages and hand raises
	interactionScore := (float64(analytics.TotalChatMessages)*0.5 + float64(analytics.TotalHandRaises)*2.0)
	if interactionScore > 100 {
		interactionScore = 100
	}

	// Calculate weighted score
	score = (meetingScore * 0.4) + (durationScore * 0.25) + (speakingScore * 0.2) + (interactionScore * 0.15)

	// Apply recency factor - boost score if user has been active recently
	if analytics.LastMeetingDate != nil {
		daysSinceLastMeeting := time.Since(*analytics.LastMeetingDate).Hours() / 24
		if daysSinceLastMeeting <= 7 {
			score *= 1.1 // 10% boost for recent activity
		} else if daysSinceLastMeeting <= 30 {
			score *= 1.05 // 5% boost
		}
	}

	// Ensure score is within bounds
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	return score, nil
}

// GetUserTrends analyzes user activity trends over specified days
func (s *userAnalyticsService) GetUserTrends(ctx context.Context, userID int, days int) (*UserTrendAnalysis, error) {
	trends := &UserTrendAnalysis{
		UserID:           userID,
		DailyMeetings:    make(map[string]int),
		DailyDuration:    make(map[string]int),
		EngagementTrend:  make([]float64, 0),
		ActivityPattern:  make(map[int]int),
		WeeklyComparison: make(map[string]interface{}),
	}

	// Get daily meeting counts for the period
	query := `
		SELECT DATE(actual_start) as meeting_date, COUNT(*) as meeting_count,
		       SUM(EXTRACT(EPOCH FROM (actual_end - actual_start))/60) as total_duration
		FROM meetings m
		JOIN meeting_participants mp ON m.id = mp.meeting_id
		WHERE mp.user_id = $1 AND m.actual_start >= $2
		GROUP BY DATE(actual_start)
		ORDER BY meeting_date
	`

	startDate := time.Now().AddDate(0, 0, -days)
	rows, err := s.db.QueryContext(ctx, query, userID, startDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get user trends: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var date time.Time
		var count int
		var duration *int

		err := rows.Scan(&date, &count, &duration)
		if err != nil {
			continue
		}

		dateStr := date.Format("2006-01-02")
		trends.DailyMeetings[dateStr] = count
		if duration != nil {
			trends.DailyDuration[dateStr] = *duration
		}
	}

	// Calculate trend direction
	trends.TrendDirection = s.calculateTrendDirection(trends.DailyMeetings)

	return trends, nil
}

// GetParticipationMetrics calculates detailed participation metrics
func (s *userAnalyticsService) GetParticipationMetrics(ctx context.Context, userID int) (*ParticipationMetrics, error) {
	analytics, err := s.GetUserAnalytics(ctx, userID)
	if err != nil {
		return nil, err
	}

	metrics := &ParticipationMetrics{
		UserID:        userID,
		TotalMeetings: analytics.TotalMeetingsJoined,
	}

	// Calculate speaking time percentage
	if analytics.TotalMeetingDurationMins > 0 {
		metrics.SpeakingTimePercentage = (float64(analytics.TotalSpeakingTimeMins) / float64(analytics.TotalMeetingDurationMins)) * 100
	}

	// Calculate interaction score
	metrics.InteractionScore = float64(analytics.TotalChatMessages)*0.5 + float64(analytics.TotalHandRaises)*2.0

	// Calculate average participation
	if analytics.TotalMeetingsJoined > 0 {
		metrics.AverageParticipation = float64(analytics.TotalMeetingDurationMins) / float64(analytics.TotalMeetingsJoined)
	}

	// Set attendance rate (simplified - assumes user joined all scheduled meetings)
	metrics.AttendanceRate = 0.85 // Placeholder - would need more complex logic

	// Calculate punctuality score
	metrics.PunctualityScore = s.calculatePunctualityScore(ctx, userID)

	return metrics, nil
}

// UpdateWeeklyActivity updates weekly activity patterns
func (s *userAnalyticsService) UpdateWeeklyActivity(ctx context.Context, userID int) error {
	// Get activity data for the current week
	query := `
		SELECT EXTRACT(DOW FROM actual_start) as day_of_week, COUNT(*) as meeting_count,
		       SUM(EXTRACT(EPOCH FROM (actual_end - actual_start))/60) as total_duration
		FROM meetings m
		JOIN meeting_participants mp ON m.id = mp.meeting_id
		WHERE mp.user_id = $1 AND actual_start >= date_trunc('week', CURRENT_DATE)
		GROUP BY EXTRACT(DOW FROM actual_start)
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to get weekly activity: %w", err)
	}
	defer rows.Close()

	weeklyData := make(map[string]interface{})
	for rows.Next() {
		var dayOfWeek int
		var meetingCount int
		var totalDuration *float64

		err := rows.Scan(&dayOfWeek, &meetingCount, &totalDuration)
		if err != nil {
			continue
		}

		dayName := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}[dayOfWeek]
		weeklyData[dayName] = map[string]interface{}{
			"meetings": meetingCount,
			"duration": totalDuration,
		}
	}

	// Update user analytics with weekly activity
	weeklyJSON, err := json.Marshal(weeklyData)
	if err != nil {
		return fmt.Errorf("failed to marshal weekly activity: %w", err)
	}

	updateQuery := `UPDATE user_analytics SET weekly_activity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`
	_, err = s.db.ExecContext(ctx, updateQuery, string(weeklyJSON), userID)
	if err != nil {
		return fmt.Errorf("failed to update weekly activity: %w", err)
	}

	return nil
}

// GetMeetingEffectiveness analyzes effectiveness for a specific meeting
func (s *userAnalyticsService) GetMeetingEffectiveness(ctx context.Context, userID int, meetingID int) (*MeetingEffectiveness, error) {
	effectiveness := &MeetingEffectiveness{
		MeetingID: meetingID,
		UserID:    userID,
	}

	// Get meeting participation data
	query := `
		SELECT 
		    m.id,
		    EXTRACT(EPOCH FROM (mp.left_at - mp.joined_at))/60 as participation_minutes,
		    EXTRACT(EPOCH FROM (m.actual_end - m.actual_start))/60 as total_meeting_minutes
		FROM meetings m
		JOIN meeting_participants mp ON m.id = mp.meeting_id
		WHERE mp.user_id = $1 AND m.id = $2
	`

	var participationMins, totalMins *float64
	err := s.db.QueryRowContext(ctx, query, userID, meetingID).Scan(&meetingID, &participationMins, &totalMins)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting data: %w", err)
	}

	// Calculate participation score
	if participationMins != nil && totalMins != nil && *totalMins > 0 {
		effectiveness.ParticipationScore = (*participationMins / *totalMins) * 100
	}

	// Determine engagement level
	if effectiveness.ParticipationScore >= 80 {
		effectiveness.EngagementLevel = "high"
	} else if effectiveness.ParticipationScore >= 50 {
		effectiveness.EngagementLevel = "medium"
	} else {
		effectiveness.EngagementLevel = "low"
	}

	// Calculate overall rating
	effectiveness.OverallRating = effectiveness.ParticipationScore / 20 // Scale to 1-5

	return effectiveness, nil
}

// ProcessDailyAnalytics runs daily analytics processing for all users
func (s *userAnalyticsService) ProcessDailyAnalytics(ctx context.Context) error {
	log.Printf("Starting daily analytics processing...")

	// Get all active users
	query := `SELECT id FROM users WHERE status = 'active'`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to get active users: %w", err)
	}
	defer rows.Close()

	var processed int
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		// Update engagement score
		if err := s.UpdateUserEngagementScore(ctx, userID); err != nil {
			log.Printf("Failed to update engagement score for user %d: %v", userID, err)
			continue
		}

		// Update weekly activity
		if err := s.UpdateWeeklyActivity(ctx, userID); err != nil {
			log.Printf("Failed to update weekly activity for user %d: %v", userID, err)
			continue
		}

		processed++
	}

	log.Printf("Daily analytics processing completed for %d users", processed)
	return nil
}

// GenerateEngagementReport generates comprehensive engagement report for a client
func (s *userAnalyticsService) GenerateEngagementReport(ctx context.Context, clientID int, startDate, endDate time.Time) (*EngagementReport, error) {
	report := &EngagementReport{
		ClientID:         clientID,
		StartDate:        startDate,
		EndDate:          endDate,
		EngagementTrends: make(map[string]float64),
		Insights:         make([]string, 0),
	}

	// Get overall statistics
	query := `
		SELECT COUNT(*) as total_users, AVG(engagement_score) as avg_score
		FROM user_analytics ua
		JOIN users u ON ua.user_id = u.id
		WHERE u.client_id = $1 AND u.status = 'active'
	`

	err := s.db.QueryRowContext(ctx, query, clientID).Scan(&report.TotalUsers, &report.AverageScore)
	if err != nil {
		return nil, fmt.Errorf("failed to get report stats: %w", err)
	}

	// Get top performers
	topPerformers, err := s.GetTopEngagedUsers(ctx, clientID, 10)
	if err != nil {
		log.Printf("Failed to get top performers: %v", err)
	} else {
		report.TopPerformers = topPerformers
	}

	// Generate insights
	if report.AverageScore > 70 {
		report.Insights = append(report.Insights, "High overall engagement across the organization")
	} else if report.AverageScore > 50 {
		report.Insights = append(report.Insights, "Moderate engagement levels - consider engagement initiatives")
	} else {
		report.Insights = append(report.Insights, "Low engagement detected - immediate action recommended")
	}

	return report, nil
}

// GetTopEngagedUsers returns the most engaged users for a client
func (s *userAnalyticsService) GetTopEngagedUsers(ctx context.Context, clientID int, limit int) ([]*UserEngagementSummary, error) {
	query := `
		SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email,
		       ua.engagement_score, ua.total_meetings_joined, ua.total_meeting_duration_minutes
		FROM user_analytics ua
		JOIN users u ON ua.user_id = u.id
		WHERE u.client_id = $1 AND u.status = 'active'
		ORDER BY ua.engagement_score DESC
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, clientID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top engaged users: %w", err)
	}
	defer rows.Close()

	var users []*UserEngagementSummary
	for rows.Next() {
		user := &UserEngagementSummary{}
		err := rows.Scan(&user.UserID, &user.UserName, &user.Email,
			&user.EngagementScore, &user.TotalMeetings, &user.TotalDuration)
		if err != nil {
			log.Printf("Failed to scan user engagement summary: %v", err)
			continue
		}

		// Calculate participation rate
		if user.TotalMeetings > 0 {
			user.ParticipationRate = user.EngagementScore / 10 // Simplified calculation
		}

		users = append(users, user)
	}

	return users, nil
}

// ============================================================================
// HELPER METHODS
// ============================================================================

func (s *userAnalyticsService) calculateTrendDirection(dailyMeetings map[string]int) string {
	if len(dailyMeetings) < 2 {
		return "stable"
	}

	// Simple trend calculation based on first half vs second half
	var firstHalf, secondHalf, firstCount, secondCount int
	
	dates := make([]string, 0, len(dailyMeetings))
	for date := range dailyMeetings {
		dates = append(dates, date)
	}

	midpoint := len(dates) / 2
	for i, date := range dates {
		if i < midpoint {
			firstHalf += dailyMeetings[date]
			firstCount++
		} else {
			secondHalf += dailyMeetings[date]
			secondCount++
		}
	}

	if firstCount == 0 || secondCount == 0 {
		return "stable"
	}

	firstAvg := float64(firstHalf) / float64(firstCount)
	secondAvg := float64(secondHalf) / float64(secondCount)

	if secondAvg > firstAvg*1.1 {
		return "up"
	} else if secondAvg < firstAvg*0.9 {
		return "down"
	}
	return "stable"
}

func (s *userAnalyticsService) calculatePunctualityScore(ctx context.Context, userID int) float64 {
	// Simplified punctuality calculation
	// In a real system, this would analyze join times vs meeting start times
	query := `
		SELECT COUNT(*) as total_meetings,
		       COUNT(CASE WHEN mp.joined_at <= m.scheduled_start + interval '5 minutes' THEN 1 END) as on_time_meetings
		FROM meeting_participants mp
		JOIN meetings m ON mp.meeting_id = m.id
		WHERE mp.user_id = $1 AND mp.joined_at IS NOT NULL
		AND m.scheduled_start >= CURRENT_DATE - interval '30 days'
	`

	var totalMeetings, onTimeMeetings int
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&totalMeetings, &onTimeMeetings)
	if err != nil || totalMeetings == 0 {
		return 0.8 // Default score
	}

	return (float64(onTimeMeetings) / float64(totalMeetings)) * 100
}
