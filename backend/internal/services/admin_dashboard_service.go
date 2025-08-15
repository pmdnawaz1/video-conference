package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/prisma/db"
	"video-conference-backend/prisma/db"
)

type AdminDashboard interface {
	// Dashboard Overview
	GetDashboardOverview(ctx context.Context, adminID int) (*AdminDashboardOverview, error)
	GetMeetingStats(ctx context.Context, clientID int, timeframe string) (*MeetingStatsCards, error)
	GetRecentMeetings(ctx context.Context, clientID int, limit int) ([]*RecentMeetingData, error)
	GetUpcomingMeetings(ctx context.Context, clientID int, limit int) ([]*UpcomingMeetingData, error)
	GetUserGroupsOverview(ctx context.Context, clientID int) (*UserGroupsOverviewData, error)
	
	// Quick Meeting Creation
	CreateInstantMeeting(ctx context.Context, req *InstantMeetingRequest) (*db.Meeting, error)
	CreateScheduledMeeting(ctx context.Context, req *ScheduledMeetingRequest) (*db.Meeting, error)
	CreateRecurringMeeting(ctx context.Context, req *RecurringMeetingRequest) ([]*db.Meeting, error)
	
	// User and Group Management
	GetAllUsers(ctx context.Context, clientID int, filters *UserFilters) ([]*UserSummary, error)
	GetUserGroups(ctx context.Context, clientID int) ([]*GroupSummary, error)
	CreateUserGroup(ctx context.Context, req *CreateGroupRequest) (*db.Group, error)
	InviteUser(ctx context.Context, req *UserInvitationRequest) (*db.UserInvitation, error)
	
	// Meeting Management
	GetMeetingDetails(ctx context.Context, meetingID int, adminID int) (*MeetingDetails, error)
	UpdateMeetingSettings(ctx context.Context, meetingID int, req *UpdateMeetingRequest) error
	EndMeeting(ctx context.Context, meetingID int, adminID int) error
	GetMeetingParticipants(ctx context.Context, meetingID int) ([]*MeetingParticipant, error)
}

// Request/Response types for Admin Dashboard operations
type AdminDashboardOverview struct {
	ClientID            int                    `json:"client_id"`
	OrganizationName    string                 `json:"organization_name"`
	AdminName           string                 `json:"admin_name"`
	TotalUsers          int                    `json:"total_users"`
	ActiveUsers         int                    `json:"active_users"`
	TotalMeetings       int                    `json:"total_meetings"`
	ActiveMeetings      int                    `json:"active_meetings"`
	MeetingsToday       int                    `json:"meetings_today"`
	MeetingsThisWeek    int                    `json:"meetings_this_week"`
	UserGroups          int                    `json:"user_groups"`
	StorageUsedMB       float64               `json:"storage_used_mb"`
	LastActivity        *time.Time            `json:"last_activity"`
	RecentActivity      []*AdminActivityLog   `json:"recent_activity"`
	SystemNotifications []*SystemNotification `json:"system_notifications"`
}

type MeetingStatsCards struct {
	TotalMeetingsToday    int     `json:"total_meetings_today"`
	AverageDurationToday  int     `json:"average_duration_today"`
	TotalParticipantsToday int    `json:"total_participants_today"`
	MeetingsThisWeek      int     `json:"meetings_this_week"`
	ParticipationRate     float64 `json:"participation_rate"`
	PopularMeetingTime    string  `json:"popular_meeting_time"`
}

type RecentMeetingData struct {
	ID               int                  `json:"id"`
	Title            string               `json:"title"`
	StartTime        time.Time           `json:"start_time"`
	EndTime          *time.Time          `json:"end_time,omitempty"`
	Duration         int                  `json:"duration"`
	ParticipantCount int                  `json:"participant_count"`
	Status           string               `json:"status"`
	CreatedBy        *UserBasicInfo      `json:"created_by"`
	Participants     []*ParticipantInfo  `json:"participants"`
}

type UpcomingMeetingData struct {
	ID               int                 `json:"id"`
	Title            string              `json:"title"`
	ScheduledStart   time.Time          `json:"scheduled_start"`
	ScheduledEnd     time.Time          `json:"scheduled_end"`
	InvitedCount     int                 `json:"invited_count"`
	ConfirmedCount   int                 `json:"confirmed_count"`
	MeetingType      string              `json:"meeting_type"`
	IsRecurring      bool                `json:"is_recurring"`
	CreatedBy        *UserBasicInfo     `json:"created_by"`
	TimeUntilStart   time.Duration      `json:"time_until_start"`
}

type UserGroupsOverviewData struct {
	TotalGroups     int             `json:"total_groups"`
	TotalMembers    int             `json:"total_members"`
	RecentGroups    []*GroupSummary `json:"recent_groups"`
	LargestGroups   []*GroupSummary `json:"largest_groups"`
	MostActiveGroups []*GroupSummary `json:"most_active_groups"`
}

type InstantMeetingRequest struct {
	Title            string   `json:"title" validate:"required"`
	Description      string   `json:"description,omitempty"`
	AdminID          int      `json:"admin_id" validate:"required"`
	ClientID         int      `json:"client_id" validate:"required"`
	InvitedUserIDs   []int    `json:"invited_user_ids,omitempty"`
	InvitedGroupIDs  []int    `json:"invited_group_ids,omitempty"`
	IsRecordingEnabled bool   `json:"is_recording_enabled"`
	WaitingRoomEnabled bool   `json:"waiting_room_enabled"`
	ChatEnabled       bool    `json:"chat_enabled"`
}

type ScheduledMeetingRequest struct {
	Title             string    `json:"title" validate:"required"`
	Description       string    `json:"description,omitempty"`
	AdminID           int       `json:"admin_id" validate:"required"`
	ClientID          int       `json:"client_id" validate:"required"`
	ScheduledStart    time.Time `json:"scheduled_start" validate:"required"`
	ScheduledEnd      time.Time `json:"scheduled_end" validate:"required"`
	InvitedUserIDs    []int     `json:"invited_user_ids,omitempty"`
	InvitedGroupIDs   []int     `json:"invited_group_ids,omitempty"`
	IsRecordingEnabled bool     `json:"is_recording_enabled"`
	WaitingRoomEnabled bool     `json:"waiting_room_enabled"`
	ChatEnabled        bool     `json:"chat_enabled"`
	BufferStartMinutes int      `json:"buffer_start_minutes"`
	BufferEndMinutes   int      `json:"buffer_end_minutes"`
	SendCalendarInvite bool     `json:"send_calendar_invite"`
}

type RecurringMeetingRequest struct {
	*ScheduledMeetingRequest
	RecurrencePattern string    `json:"recurrence_pattern" validate:"required,oneof=daily weekly monthly"`
	RecurrenceInterval int      `json:"recurrence_interval" validate:"min=1"`
	EndDate           *time.Time `json:"end_date,omitempty"`
	MaxOccurrences    int       `json:"max_occurrences,omitempty"`
}

type UserFilters struct {
	Status   string `json:"status,omitempty"`
	Role     string `json:"role,omitempty"`
	GroupID  int    `json:"group_id,omitempty"`
	Search   string `json:"search,omitempty"`
	Limit    int    `json:"limit,omitempty"`
	Offset   int    `json:"offset,omitempty"`
}

type UserSummary struct {
	ID          int        `json:"id"`
	Email       string     `json:"email"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	LastLogin   *time.Time `json:"last_login"`
	CreatedAt   time.Time  `json:"created_at"`
	GroupCount  int        `json:"group_count"`
	MeetingCount int       `json:"meeting_count"`
}

type GroupSummary struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	MemberCount int       `json:"member_count"`
	CreatedAt   time.Time `json:"created_at"`
	CreatedBy   *UserBasicInfo `json:"created_by"`
	RecentActivity *time.Time `json:"recent_activity"`
}

type CreateGroupRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description,omitempty"`
	AdminID     int    `json:"admin_id" validate:"required"`
	ClientID    int    `json:"client_id" validate:"required"`
	MemberIDs   []int  `json:"member_ids,omitempty"`
}

type UserInvitationRequest struct {
	Email       string `json:"email" validate:"required,email"`
	FirstName   string `json:"first_name" validate:"required"`
	LastName    string `json:"last_name" validate:"required"`
	Role        string `json:"role" validate:"required,oneof=user"`
	ClientID    int    `json:"client_id" validate:"required"`
	InvitedBy   int    `json:"invited_by" validate:"required"`
	GroupIDs    []int  `json:"group_ids,omitempty"`
	Message     string `json:"message,omitempty"`
}

type MeetingDetails struct {
	*db.Meeting
	ParticipantCount int                   `json:"participant_count"`
	ActiveUsers      []*MeetingParticipant `json:"active_users"`
	ChatMessageCount int                   `json:"chat_message_count"`
	Duration         int                   `json:"duration"`
	RecordingSize    float64              `json:"recording_size_mb"`
	Permissions      *MeetingPermissions   `json:"permissions"`
}

type MeetingParticipant struct {
	UserID        int        `json:"user_id"`
	FirstName     string     `json:"first_name"`
	LastName      string     `json:"last_name"`
	Email         string     `json:"email"`
	JoinedAt      time.Time  `json:"joined_at"`
	LeftAt        *time.Time `json:"left_at,omitempty"`
	Duration      int        `json:"duration"`
	IsSpeaking    bool       `json:"is_speaking"`
	HandRaised    bool       `json:"hand_raised"`
	VideoEnabled  bool       `json:"video_enabled"`
	AudioEnabled  bool       `json:"audio_enabled"`
	ScreenSharing bool       `json:"screen_sharing"`
}

type MeetingPermissions struct {
	CanUnmute       bool `json:"can_unmute"`
	CanEnableVideo  bool `json:"can_enable_video"`
	CanShareScreen  bool `json:"can_share_screen"`
	CanChat         bool `json:"can_chat"`
	CanRecord       bool `json:"can_record"`
}

type UpdateMeetingRequest struct {
	Title              string               `json:"title,omitempty"`
	Description        string               `json:"description,omitempty"`
	IsLocked           *bool                `json:"is_locked,omitempty"`
	WaitingRoomEnabled *bool                `json:"waiting_room_enabled,omitempty"`
	ChatEnabled        *bool                `json:"chat_enabled,omitempty"`
	RecordingEnabled   *bool                `json:"recording_enabled,omitempty"`
	DefaultPermissions *MeetingPermissions  `json:"default_permissions,omitempty"`
}

type AdminActivityLog struct {
	ID          int       `json:"id"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	ResourceID  int       `json:"resource_id"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type SystemNotification struct {
	ID       int       `json:"id"`
	Type     string    `json:"type"`
	Title    string    `json:"title"`
	Message  string    `json:"message"`
	Priority string    `json:"priority"`
	IsRead   bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type UserBasicInfo struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
}

type ParticipantInfo struct {
	UserID    int    `json:"user_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Duration  int    `json:"duration"`
}

type adminDashboardService struct {
	db         *db.DB
	userSvc    UserService
	meetingSvc MeetingService
	groupSvc   GroupService
}

func AdminDashboardService(db *db.DB, userSvc UserService, meetingSvc MeetingService, groupSvc GroupService) AdminDashboard {
	return &adminDashboardService{
		db:         db,
		userSvc:    userSvc,
		meetingSvc: meetingSvc,
		groupSvc:   groupSvc,
	}
}

// ============================================================================
// DASHBOARD OVERVIEW IMPLEMENTATION
// ============================================================================

func (s *adminDashboardService) GetDashboardOverview(ctx context.Context, adminID int) (*AdminDashboardOverview, error) {
	// Get admin user to get client ID
	admin, err := s.userSvc.GetUserByID(ctx, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed to get admin user: %w", err)
	}

	overview := &AdminDashboardOverview{
		ClientID:     admin.ClientID,
		AdminName:    admin.FirstName + " " + admin.LastName,
		LastActivity: nil, // LastLogin field not available in current schema
	}

	// Get organization name
	var orgName string
	err = s.db.GetContext(ctx, &orgName, "SELECT organization_name FROM clients WHERE id = $1", admin.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization name: %w", err)
	}
	overview.OrganizationName = orgName

	// Get comprehensive statistics
	statsQuery := `
		SELECT 
			COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'user') as total_users,
			COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'user' AND u.status = 'active' AND u.last_login > CURRENT_TIMESTAMP - INTERVAL '30 days') as active_users,
			COUNT(DISTINCT m.id) as total_meetings,
			COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as active_meetings,
			COUNT(DISTINCT m.id) FILTER (WHERE m.created_at::date = CURRENT_DATE) as meetings_today,
			COUNT(DISTINCT m.id) FILTER (WHERE m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as meetings_this_week,
			COUNT(DISTINCT g.id) as user_groups
		FROM clients c
		LEFT JOIN users u ON c.id = u.client_id AND u.role IN ('user')
		LEFT JOIN meetings m ON c.id = m.client_id
		LEFT JOIN groups g ON c.id = g.client_id
		WHERE c.id = $1`

	err = s.db.GetContext(ctx, overview, statsQuery, admin.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard stats: %w", err)
	}

	// Get recent admin activity
	activityQuery := `
		SELECT id, action, resource, resource_id, description, created_at
		FROM admin_activity_logs
		WHERE admin_id = $1
		ORDER BY created_at DESC
		LIMIT 10`

	err = s.db.SelectContext(ctx, &overview.RecentActivity, activityQuery, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent activity: %w", err)
	}

	return overview, nil
}

func (s *adminDashboardService) GetMeetingStats(ctx context.Context, clientID int, timeframe string) (*MeetingStatsCards, error) {
	var timeCondition string
	switch timeframe {
	case "today":
		timeCondition = "AND m.created_at::date = CURRENT_DATE"
	case "week":
		timeCondition = "AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'"
	case "month":
		timeCondition = "AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'"
	default:
		timeCondition = "AND m.created_at::date = CURRENT_DATE"
	}

	stats := &MeetingStatsCards{}
	
	query := fmt.Sprintf(`
		SELECT 
			COUNT(m.id) as total_meetings_today,
			COALESCE(AVG(EXTRACT(EPOCH FROM (m.actual_end - m.actual_start))/60), 0) as average_duration_today,
			COALESCE(SUM(mp.participant_count), 0) as total_participants_today,
			COUNT(m.id) FILTER (WHERE m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as meetings_this_week
		FROM meetings m
		LEFT JOIN (
			SELECT meeting_id, COUNT(*) as participant_count
			FROM meeting_participants
			GROUP BY meeting_id
		) mp ON m.id = mp.meeting_id
		WHERE m.client_id = $1 %s`, timeCondition)

	err := s.db.GetContext(ctx, stats, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting stats: %w", err)
	}

	return stats, nil
}

func (s *adminDashboardService) GetRecentMeetings(ctx context.Context, clientID int, limit int) ([]*RecentMeetingData, error) {
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT 
			m.id, m.title, m.actual_start as start_time, m.actual_end as end_time,
			COALESCE(EXTRACT(EPOCH FROM (m.actual_end - m.actual_start))/60, 0) as duration,
			m.status,
			u.id as created_by_id, u.first_name as created_by_first_name, 
			u.last_name as created_by_last_name, u.email as created_by_email,
			COALESCE(mp.participant_count, 0) as participant_count
		FROM meetings m
		JOIN users u ON m.created_by_user_id = u.id
		LEFT JOIN (
			SELECT meeting_id, COUNT(*) as participant_count
			FROM meeting_participants
			GROUP BY meeting_id
		) mp ON m.id = mp.meeting_id
		WHERE m.client_id = $1 AND m.actual_start IS NOT NULL
		ORDER BY m.actual_start DESC
		LIMIT $2`

	rows, err := s.db.QueryContext(ctx, query, clientID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent meetings: %w", err)
	}
	defer rows.Close()

	var meetings []*RecentMeetingData
	for rows.Next() {
		var meeting RecentMeetingData
		var createdBy UserBasicInfo
		
		err := rows.Scan(
			&meeting.ID, &meeting.Title, &meeting.StartTime, &meeting.EndTime,
			&meeting.Duration, &meeting.Status, 
			&createdBy.ID, &createdBy.FirstName, &createdBy.LastName, &createdBy.Email,
			&meeting.ParticipantCount,
		)
		if err != nil {
			continue
		}
		
		meeting.CreatedBy = &createdBy
		meetings = append(meetings, &meeting)
	}

	return meetings, nil
}

func (s *adminDashboardService) GetUpcomingMeetings(ctx context.Context, clientID int, limit int) ([]*UpcomingMeetingData, error) {
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT 
			m.id, m.title, m.scheduled_start, m.scheduled_end,
			m.meeting_type, m.is_recurring,
			u.id as created_by_id, u.first_name as created_by_first_name,
			u.last_name as created_by_last_name, u.email as created_by_email,
			COALESCE(mi.invited_count, 0) as invited_count,
			COALESCE(mi.confirmed_count, 0) as confirmed_count
		FROM meetings m
		JOIN users u ON m.created_by_user_id = u.id
		LEFT JOIN (
			SELECT meeting_id, 
				   COUNT(*) as invited_count,
				   COUNT(*) FILTER (WHERE status = 'accepted') as confirmed_count
			FROM meeting_invitations
			GROUP BY meeting_id
		) mi ON m.id = mi.meeting_id
		WHERE m.client_id = $1 AND m.scheduled_start > CURRENT_TIMESTAMP
		ORDER BY m.scheduled_start ASC
		LIMIT $2`

	rows, err := s.db.QueryContext(ctx, query, clientID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming meetings: %w", err)
	}
	defer rows.Close()

	var meetings []*UpcomingMeetingData
	for rows.Next() {
		var meeting UpcomingMeetingData
		var createdBy UserBasicInfo
		
		err := rows.Scan(
			&meeting.ID, &meeting.Title, &meeting.ScheduledStart, &meeting.ScheduledEnd,
			&meeting.MeetingType, &meeting.IsRecurring,
			&createdBy.ID, &createdBy.FirstName, &createdBy.LastName, &createdBy.Email,
			&meeting.InvitedCount, &meeting.ConfirmedCount,
		)
		if err != nil {
			continue
		}
		
		meeting.CreatedBy = &createdBy
		meeting.TimeUntilStart = time.Until(meeting.ScheduledStart)
		meetings = append(meetings, &meeting)
	}

	return meetings, nil
}

func (s *adminDashboardService) GetUserGroupsOverview(ctx context.Context, clientID int) (*UserGroupsOverviewData, error) {
	overview := &UserGroupsOverviewData{}

	// Get basic counts
	countsQuery := `
		SELECT 
			COUNT(DISTINCT g.id) as total_groups,
			COUNT(DISTINCT gm.user_id) as total_members
		FROM groups g
		LEFT JOIN group_members gm ON g.id = gm.group_id
		WHERE g.client_id = $1`

	err := s.db.GetContext(ctx, overview, countsQuery, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group counts: %w", err)
	}

	// Get recent groups
	recentQuery := `
		SELECT g.id, g.name, g.description, g.created_at,
			   u.id as created_by_id, u.first_name, u.last_name, u.email,
			   COALESCE(gm.member_count, 0) as member_count
		FROM groups g
		JOIN users u ON g.created_by = u.id
		LEFT JOIN (
			SELECT group_id, COUNT(*) as member_count
			FROM group_members
			GROUP BY group_id
		) gm ON g.id = gm.group_id
		WHERE g.client_id = $1
		ORDER BY g.created_at DESC
		LIMIT 5`

	rows, err := s.db.QueryContext(ctx, recentQuery, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent groups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var group GroupSummary
		var createdBy UserBasicInfo
		
		err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.CreatedAt,
			&createdBy.ID, &createdBy.FirstName, &createdBy.LastName, &createdBy.Email,
			&group.MemberCount,
		)
		if err != nil {
			continue
		}
		
		group.CreatedBy = &createdBy
		overview.RecentGroups = append(overview.RecentGroups, &group)
	}

	return overview, nil
}

// ============================================================================
// QUICK MEETING CREATION IMPLEMENTATION
// ============================================================================

func (s *adminDashboardService) CreateInstantMeeting(ctx context.Context, req *InstantMeetingRequest) (*db.Meeting, error) {
	// Create meeting using existing meeting service
	meeting := &db.Meeting{
		ClientID:            req.ClientID,
		CreatedBy:     &req.AdminID,
		Title:               req.Title,
		Description:         &req.Description,
		MeetingID:           db.GenerateMeetingID(),
		ScheduledStart:      time.Now(),
		ScheduledEnd:        time.Now().Add(1 * time.Hour), // Default 1 hour
		Status:              "active",
		MaxDurationMinutes:     60,
		WaitingRoomEnabled:   req.WaitingRoomEnabled,
		ChatEnabled:          req.ChatEnabled,
		RecordingAutoStart:     req.IsRecordingEnabled,
		MeetingSettings:            nil,
	}

	err := s.meetingSvc.CreateMeeting(ctx, meeting)
	if err != nil {
		return nil, fmt.Errorf("failed to create instant meeting: %w", err)
	}

	// Add participants if specified
	if len(req.InvitedUserIDs) > 0 || len(req.InvitedGroupIDs) > 0 {
		err = s.addMeetingParticipants(ctx, meeting.ID, req.InvitedUserIDs, req.InvitedGroupIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to add participants: %w", err)
		}
	}

	return meeting, nil
}

func (s *adminDashboardService) CreateScheduledMeeting(ctx context.Context, req *ScheduledMeetingRequest) (*db.Meeting, error) {
	meeting := &db.Meeting{
		ClientID:            req.ClientID,
		CreatedBy:     &req.AdminID,
		Title:               req.Title,
		Description:         &req.Description,
		MeetingID:           db.GenerateMeetingID(),
		ScheduledStart:      req.ScheduledStart,
		ScheduledEnd:        req.ScheduledEnd,
		Status:              "scheduled",
		MaxDurationMinutes:     60,
		WaitingRoomEnabled:   req.WaitingRoomEnabled,
		ChatEnabled:          req.ChatEnabled,
		RecordingAutoStart:     req.IsRecordingEnabled,
		MeetingSettings:            nil,
	}

	err := s.meetingSvc.CreateMeeting(ctx, meeting)
	if err != nil {
		return nil, fmt.Errorf("failed to create scheduled meeting: %w", err)
	}

	// Add participants if specified
	if len(req.InvitedUserIDs) > 0 || len(req.InvitedGroupIDs) > 0 {
		err = s.addMeetingParticipants(ctx, meeting.ID, req.InvitedUserIDs, req.InvitedGroupIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to add participants: %w", err)
		}
	}

	return meeting, nil
}

func (s *adminDashboardService) CreateRecurringMeeting(ctx context.Context, req *RecurringMeetingRequest) ([]*db.Meeting, error) {
	var meetings []*db.Meeting
	
	// Generate recurring meeting dates based on pattern
	dates := s.generateRecurringDates(req.ScheduledStart, req.ScheduledEnd, req.RecurrencePattern, req.RecurrenceInterval, req.EndDate, req.MaxOccurrences)
	
	for _, dateRange := range dates {
		meeting := &db.Meeting{
			ClientID:            req.ClientID,
			CreatedBy:     &req.AdminID,
			Title:               req.Title,
			Description:         &req.Description,
			MeetingID:           db.GenerateMeetingID(),
			ScheduledStart:      dateRange.Start,
			ScheduledEnd:        dateRange.End,
			Status:              "scheduled",
			MaxDurationMinutes:     60,
			WaitingRoomEnabled:   req.WaitingRoomEnabled,
			ChatEnabled:          req.ChatEnabled,
			RecordingAutoStart:     req.IsRecordingEnabled,
			MeetingSettings:            nil,
		}

		err := s.meetingSvc.CreateMeeting(ctx, meeting)
		if err != nil {
			continue // Skip failed meetings but continue with others
		}

		// Add participants
		if len(req.InvitedUserIDs) > 0 || len(req.InvitedGroupIDs) > 0 {
			s.addMeetingParticipants(ctx, meeting.ID, req.InvitedUserIDs, req.InvitedGroupIDs)
		}

		meetings = append(meetings, meeting)
	}

	return meetings, nil
}

type DateRange struct {
	Start time.Time
	End   time.Time
}

func (s *adminDashboardService) generateRecurringDates(start, end time.Time, pattern string, interval int, endDate *time.Time, maxOccurrences int) []DateRange {
	var dates []DateRange
	
	current := start
	duration := end.Sub(start)
	count := 0
	
	for {
		if maxOccurrences > 0 && count >= maxOccurrences {
			break
		}
		if endDate != nil && current.After(*endDate) {
			break
		}
		
		dates = append(dates, DateRange{
			Start: current,
			End:   current.Add(duration),
		})
		
		// Calculate next occurrence
		switch pattern {
		case "daily":
			current = current.AddDate(0, 0, interval)
		case "weekly":
			current = current.AddDate(0, 0, 7*interval)
		case "monthly":
			current = current.AddDate(0, interval, 0)
		}
		
		count++
		
		// Safety limit
		if count > 365 {
			break
		}
	}
	
	return dates
}

func (s *adminDashboardService) addMeetingParticipants(ctx context.Context, meetingID int, userIDs []int, groupIDs []int) error {
	// Add individual users
	for _, userID := range userIDs {
		query := `INSERT INTO meeting_participants (meeting_id, user_id, status, created_at) VALUES ($1, $2, 'invited', CURRENT_TIMESTAMP)`
		_, err := s.db.ExecContext(ctx, query, meetingID, userID)
		if err != nil {
			continue // Skip failed inserts
		}
	}

	// Add group members
	for _, groupID := range groupIDs {
		query := `
			INSERT INTO meeting_participants (meeting_id, user_id, status, created_at)
			SELECT $1, gm.user_id, 'invited', CURRENT_TIMESTAMP
			FROM group_members gm
			WHERE gm.group_id = $2`
		_, err := s.db.ExecContext(ctx, query, meetingID, groupID)
		if err != nil {
			continue // Skip failed inserts
		}
	}

	return nil
}

// ============================================================================
// USER AND GROUP MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *adminDashboardService) GetAllUsers(ctx context.Context, clientID int, filters *UserFilters) ([]*UserSummary, error) {
	query := `
		SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.last_login, u.created_at,
			   COALESCE(gm.group_count, 0) as group_count,
			   COALESCE(mp.meeting_count, 0) as meeting_count
		FROM users u
		LEFT JOIN (
			SELECT user_id, COUNT(*) as group_count
			FROM group_members
			GROUP BY user_id
		) gm ON u.id = gm.user_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) as meeting_count
			FROM meeting_participants
			GROUP BY user_id
		) mp ON u.id = mp.user_id
		WHERE u.client_id = $1 AND u.role = 'user'`

	args := []interface{}{clientID}
	argIndex := 2

	if filters != nil {
		if filters.Status != "" {
			query += fmt.Sprintf(" AND u.status = $%d", argIndex)
			args = append(args, filters.Status)
			argIndex++
		}

		if filters.GroupID > 0 {
			query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM group_members WHERE user_id = u.id AND group_id = $%d)", argIndex)
			args = append(args, filters.GroupID)
			argIndex++
		}

		if filters.Search != "" {
			query += fmt.Sprintf(" AND (u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.email ILIKE $%d)", argIndex, argIndex, argIndex)
			args = append(args, "%"+filters.Search+"%")
			argIndex++
		}
	}

	query += " ORDER BY u.created_at DESC"

	if filters != nil && filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, filters.Limit)
		argIndex++

		if filters.Offset > 0 {
			query += fmt.Sprintf(" OFFSET $%d", argIndex)
			args = append(args, filters.Offset)
		}
	}

	var users []*UserSummary
	err := s.db.SelectContext(ctx, &users, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	return users, nil
}

func (s *adminDashboardService) GetUserGroups(ctx context.Context, clientID int) ([]*GroupSummary, error) {
	query := `
		SELECT g.id, g.name, g.description, g.created_at,
			   u.id as created_by_id, u.first_name, u.last_name, u.email,
			   COALESCE(gm.member_count, 0) as member_count,
			   gm.recent_activity
		FROM groups g
		JOIN users u ON g.created_by = u.id
		LEFT JOIN (
			SELECT group_id, COUNT(*) as member_count, MAX(created_at) as recent_activity
			FROM group_members
			GROUP BY group_id
		) gm ON g.id = gm.group_id
		WHERE g.client_id = $1
		ORDER BY g.created_at DESC`

	rows, err := s.db.QueryContext(ctx, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user groups: %w", err)
	}
	defer rows.Close()

	var groups []*GroupSummary
	for rows.Next() {
		var group GroupSummary
		var createdBy UserBasicInfo
		
		err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.CreatedAt,
			&createdBy.ID, &createdBy.FirstName, &createdBy.LastName, &createdBy.Email,
			&group.MemberCount, &group.RecentActivity,
		)
		if err != nil {
			continue
		}
		
		group.CreatedBy = &createdBy
		groups = append(groups, &group)
	}

	return groups, nil
}

func (s *adminDashboardService) CreateUserGroup(ctx context.Context, req *CreateGroupRequest) (*db.Group, error) {
	// Create group directly in database
	group := &db.Group{
		ClientID:    req.ClientID,
		Name:        req.Name,
		Description: &req.Description,
		CreatedBy:   &req.AdminID,
	}

	query := `
		INSERT INTO groups (client_id, name, description, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.GetContext(ctx, group, query, group.ClientID, group.Name, group.Description, group.CreatedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}

	// Add members if specified
	if len(req.MemberIDs) > 0 {
		for _, memberID := range req.MemberIDs {
			memberQuery := `INSERT INTO group_members (group_id, user_id, added_by, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`
			_, err := s.db.ExecContext(ctx, memberQuery, group.ID, memberID, req.AdminID)
			if err != nil {
				continue // Skip failed member additions
			}
		}
	}

	return group, nil
}

func (s *adminDashboardService) InviteUser(ctx context.Context, req *UserInvitationRequest) (*db.UserInvitation, error) {
	// Create user invitation
	invitation := &db.UserInvitation{
		ClientID:        &req.ClientID,
		AdminID:         &req.InvitedBy,
		Email:           req.Email,
		FirstName:       req.FirstName,
		LastName:        req.LastName,
		Token:           db.GenerateToken(),
		ExpiresAt:       time.Now().Add(7 * 24 * time.Hour), // 7 days
		Status:          "pending",
		WelcomeMessage:  &req.Message,
	}

	query := `
		INSERT INTO user_invitations (client_id, admin_id, email, first_name, last_name, 
			token, expires_at, status, welcome_message, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err := s.db.GetContext(ctx, invitation, query,
		invitation.ClientID, invitation.AdminID, invitation.Email, invitation.FirstName, 
		invitation.LastName, invitation.Token, invitation.ExpiresAt, invitation.Status, 
		invitation.WelcomeMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to create user invitation: %w", err)
	}

	return invitation, nil
}

// ============================================================================
// MEETING MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *adminDashboardService) GetMeetingDetails(ctx context.Context, meetingID int, adminID int) (*MeetingDetails, error) {
	// Get meeting using existing service
	meeting, err := s.meetingSvc.GetMeetingByID(ctx, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting: %w", err)
	}

	details := &MeetingDetails{
		Meeting: meeting,
	}

	// Get additional details
	statsQuery := `
		SELECT 
			COALESCE(mp.participant_count, 0) as participant_count,
			COALESCE(cm.message_count, 0) as chat_message_count,
			COALESCE(EXTRACT(EPOCH FROM (m.actual_end - m.actual_start))/60, 0) as duration
		FROM meetings m
		LEFT JOIN (
			SELECT meeting_id, COUNT(*) as participant_count
			FROM meeting_participants
			GROUP BY meeting_id
		) mp ON m.id = mp.meeting_id
		LEFT JOIN (
			SELECT meeting_id, COUNT(*) as message_count
			FROM chat_messages
			GROUP BY meeting_id
		) cm ON m.id = cm.meeting_id
		WHERE m.id = $1`

	err = s.db.GetContext(ctx, details, statsQuery, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting stats: %w", err)
	}

	// Get active participants
	participants, err := s.GetMeetingParticipants(ctx, meetingID)
	if err == nil {
		details.ActiveUsers = participants
	}

	return details, nil
}

func (s *adminDashboardService) GetMeetingParticipants(ctx context.Context, meetingID int) ([]*MeetingParticipant, error) {
	query := `
		SELECT 
			mp.user_id, u.first_name, u.last_name, u.email,
			mp.joined_at, mp.left_at,
			COALESCE(EXTRACT(EPOCH FROM (COALESCE(mp.left_at, CURRENT_TIMESTAMP) - mp.joined_at))/60, 0) as duration,
			COALESCE(rh.is_raised, false) as hand_raised
		FROM meeting_participants mp
		JOIN users u ON mp.user_id = u.id
		LEFT JOIN raise_hands rh ON mp.meeting_id = rh.meeting_id AND mp.user_id = rh.user_id AND rh.is_raised = true
		WHERE mp.meeting_id = $1
		ORDER BY mp.joined_at ASC`

	var participants []*MeetingParticipant
	err := s.db.SelectContext(ctx, &participants, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting participants: %w", err)
	}

	return participants, nil
}

func (s *adminDashboardService) UpdateMeetingSettings(ctx context.Context, meetingID int, req *UpdateMeetingRequest) error {
	// Build dynamic update query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.Title != "" {
		setParts = append(setParts, fmt.Sprintf("title = $%d", argIndex))
		args = append(args, req.Title)
		argIndex++
	}

	if req.Description != "" {
		setParts = append(setParts, fmt.Sprintf("description = $%d", argIndex))
		args = append(args, req.Description)
		argIndex++
	}

	if req.IsLocked != nil {
		setParts = append(setParts, fmt.Sprintf("is_locked = $%d", argIndex))
		args = append(args, *req.IsLocked)
		argIndex++
	}

	if req.WaitingRoomEnabled != nil {
		setParts = append(setParts, fmt.Sprintf("waiting_room_enabled = $%d", argIndex))
		args = append(args, *req.WaitingRoomEnabled)
		argIndex++
	}

	if req.ChatEnabled != nil {
		setParts = append(setParts, fmt.Sprintf("chat_enabled = $%d", argIndex))
		args = append(args, *req.ChatEnabled)
		argIndex++
	}

	if req.RecordingEnabled != nil {
		setParts = append(setParts, fmt.Sprintf("is_recording_enabled = $%d", argIndex))
		args = append(args, *req.RecordingEnabled)
		argIndex++
	}

	if len(setParts) == 0 {
		return fmt.Errorf("no fields to update")
	}

	setParts = append(setParts, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, meetingID)

	query := fmt.Sprintf("UPDATE meetings SET %s WHERE id = $%d", 
		fmt.Sprintf("%s", setParts), argIndex)

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update meeting: %w", err)
	}

	return nil
}

func (s *adminDashboardService) EndMeeting(ctx context.Context, meetingID int, adminID int) error {
	// Get meeting first to get the meeting ID string
	meeting, err := s.meetingSvc.GetMeetingByID(ctx, meetingID)
	if err != nil {
		return fmt.Errorf("failed to get meeting: %w", err)
	}
	
	// Use existing meeting service
	return s.meetingSvc.EndMeeting(ctx, meeting.MeetingID)
}