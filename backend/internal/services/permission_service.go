package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type PermissionService interface {
	// Permission Requests
	RequestPermission(ctx context.Context, req *PermissionRequest) (*models.MeetingPermission, error)
	GetPermissionRequest(ctx context.Context, requestID int) (*models.MeetingPermission, error)
	GetUserPermissionRequests(ctx context.Context, meetingID int, userID int) ([]*models.MeetingPermission, error)
	GetPendingPermissionRequests(ctx context.Context, meetingID int) ([]*PermissionRequestSummary, error)

	// Permission Management
	ApprovePermission(ctx context.Context, requestID int, adminID int, response string) error
	DenyPermission(ctx context.Context, requestID int, adminID int, response string) error
	BulkApprovePermissions(ctx context.Context, requestIDs []int, adminID int, response string) error
	BulkDenyPermissions(ctx context.Context, requestIDs []int, adminID int, response string) error

	// Permission Status
	GetUserPermissions(ctx context.Context, meetingID int, userID int) (*UserPermissionStatus, error)
	UpdateUserPermissions(ctx context.Context, meetingID int, userID int, permissions map[string]bool, adminID int) error
	RevokePermission(ctx context.Context, meetingID int, userID int, permissionType string, adminID int, reason string) error

	// Default Permission Templates
	CreatePermissionTemplate(ctx context.Context, template *PermissionTemplate) error
	GetPermissionTemplate(ctx context.Context, templateID int) (*PermissionTemplate, error)
	ApplyPermissionTemplate(ctx context.Context, meetingID int, templateID int, adminID int) error
	GetDefaultPermissions(ctx context.Context, meetingID int) (*DefaultPermissions, error)

	// Real-time Permission Updates
	GetPermissionUpdates(ctx context.Context, meetingID int, since time.Time) ([]*PermissionUpdate, error)
	BroadcastPermissionUpdate(ctx context.Context, update *PermissionUpdate) error
}

// Request/Response types for Permission operations
type PermissionRequest struct {
	MeetingID      int    `json:"meeting_id" validate:"required"`
	UserID         int    `json:"user_id" validate:"required"`
	PermissionType string `json:"permission_type" validate:"required,oneof=video audio screen_share chat recording"`
	RequestMessage string `json:"request_message,omitempty"`
}

type PermissionRequestSummary struct {
	ID             int       `json:"id"`
	MeetingID      int       `json:"meeting_id"`
	UserID         int       `json:"user_id"`
	UserName       string    `json:"user_name"`
	UserEmail      string    `json:"user_email"`
	PermissionType string    `json:"permission_type"`
	RequestMessage string    `json:"request_message,omitempty"`
	RequestedAt    time.Time `json:"requested_at"`
	TimeWaiting    int       `json:"time_waiting_minutes"`
}

type UserPermissionStatus struct {
	UserID          int                         `json:"user_id"`
	MeetingID       int                         `json:"meeting_id"`
	Permissions     map[string]bool             `json:"permissions"`
	PendingRequests []*models.MeetingPermission `json:"pending_requests"`
	LastUpdated     time.Time                   `json:"last_updated"`
	UpdatedBy       *int                        `json:"updated_by,omitempty"`
	AdminName       string                      `json:"admin_name,omitempty"`
}

type PermissionTemplate struct {
	ID                   int             `json:"id"`
	ClientID             int             `json:"client_id"`
	Name                 string          `json:"name"`
	Description          string          `json:"description"`
	MeetingType          string          `json:"meeting_type"` // all, instant, scheduled, recurring
	DefaultPermissions   map[string]bool `json:"default_permissions"`
	AutoGrantPermissions []string        `json:"auto_grant_permissions"`
	IsActive             bool            `json:"is_active"`
	CreatedBy            int             `json:"created_by"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

type DefaultPermissions struct {
	MeetingID            int      `json:"meeting_id"`
	VideoEnabled         bool     `json:"video_enabled"`
	AudioEnabled         bool     `json:"audio_enabled"`
	ScreenShareEnabled   bool     `json:"screen_share_enabled"`
	ChatEnabled          bool     `json:"chat_enabled"`
	RecordingEnabled     bool     `json:"recording_enabled"`
	AutoGrantVideo       bool     `json:"auto_grant_video"`
	AutoGrantAudio       bool     `json:"auto_grant_audio"`
	AutoGrantScreenShare bool     `json:"auto_grant_screen_share"`
	AutoGrantChat        bool     `json:"auto_grant_chat"`
	RequireApproval      []string `json:"require_approval"`
}

type PermissionUpdate struct {
	ID             int       `json:"id"`
	MeetingID      int       `json:"meeting_id"`
	UserID         int       `json:"user_id"`
	PermissionType string    `json:"permission_type"`
	Action         string    `json:"action"` // granted, denied, revoked, requested
	AdminID        *int      `json:"admin_id,omitempty"`
	Reason         string    `json:"reason,omitempty"`
	Timestamp      time.Time `json:"timestamp"`
	UserName       string    `json:"user_name,omitempty"`
	AdminName      string    `json:"admin_name,omitempty"`
}

type permissionService struct {
	db *database.DB
}

func NewPermissionService(db *database.DB) PermissionService {
	return &permissionService{
		db: db,
	}
}

// ============================================================================
// PERMISSION REQUESTS IMPLEMENTATION
// ============================================================================

func (s *permissionService) RequestPermission(ctx context.Context, req *PermissionRequest) (*models.MeetingPermission, error) {
	// Check if there's already a pending request for this permission type
	var existingID int
	checkQuery := `
		SELECT id FROM meeting_permissions 
		WHERE meeting_id = $1 AND user_id = $2 AND permission_type = $3 
		AND (approved_at IS NULL AND denied_at IS NULL)`

	err := s.db.GetContext(ctx, &existingID, checkQuery, req.MeetingID, req.UserID, req.PermissionType)
	if err == nil {
		return nil, fmt.Errorf("permission request already pending for %s", req.PermissionType)
	}

	// Create new permission request
	permission := &models.MeetingPermission{
		MeetingID:      models.IntPtr(req.MeetingID),
		UserID:         models.IntPtr(req.UserID),
		PermissionType: req.PermissionType,
		IsGranted:      false,
		RequestedAt:    &time.Time{},
		RequestMessage: &req.RequestMessage,
		AutoGranted:    false,
	}

	*permission.RequestedAt = time.Now()

	query := `
		INSERT INTO meeting_permissions (meeting_id, user_id, permission_type, is_granted, 
			requested_at, request_message, auto_granted, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err = s.db.GetContext(ctx, permission, query,
		*permission.MeetingID, *permission.UserID, permission.PermissionType,
		permission.IsGranted, permission.RequestedAt, permission.RequestMessage,
		permission.AutoGranted)
	if err != nil {
		return nil, fmt.Errorf("failed to create permission request: %w", err)
	}

	// Check if this permission type should be auto-granted
	autoGranted, err := s.checkAutoGrantPermission(ctx, req.MeetingID, req.PermissionType)
	if err == nil && autoGranted {
		// Auto-grant the permission
		err = s.ApprovePermission(ctx, permission.ID, 0, "Auto-granted by system policy")
		if err != nil {
			return permission, nil // Return the request even if auto-grant fails
		}

		// Update the permission object
		permission.IsGranted = true
		permission.AutoGranted = true
		now := time.Now()
		permission.ApprovedAt = &now
	}

	return permission, nil
}

func (s *permissionService) GetPermissionRequest(ctx context.Context, requestID int) (*models.MeetingPermission, error) {
	permission := &models.MeetingPermission{}

	query := `
		SELECT id, meeting_id, user_id, permission_type, is_granted, requested_at,
			   approved_at, denied_at, approved_by, denied_by, request_message,
			   admin_response, auto_granted, created_at, updated_at
		FROM meeting_permissions
		WHERE id = $1`

	err := s.db.GetContext(ctx, permission, query, requestID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permission request: %w", err)
	}

	return permission, nil
}

func (s *permissionService) GetUserPermissionRequests(ctx context.Context, meetingID int, userID int) ([]*models.MeetingPermission, error) {
	var permissions []*models.MeetingPermission

	query := `
		SELECT id, meeting_id, user_id, permission_type, is_granted, requested_at,
			   approved_at, denied_at, approved_by, denied_by, request_message,
			   admin_response, auto_granted, created_at, updated_at
		FROM meeting_permissions
		WHERE meeting_id = $1 AND user_id = $2
		ORDER BY requested_at DESC`

	err := s.db.SelectContext(ctx, &permissions, query, meetingID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permission requests: %w", err)
	}

	return permissions, nil
}

func (s *permissionService) GetPendingPermissionRequests(ctx context.Context, meetingID int) ([]*PermissionRequestSummary, error) {
	var requests []*PermissionRequestSummary

	query := `
		SELECT 
			mp.id, mp.meeting_id, mp.user_id, mp.permission_type, 
			COALESCE(mp.request_message, '') as request_message, mp.requested_at,
			u.first_name || ' ' || u.last_name as user_name, u.email as user_email,
			EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - mp.requested_at))/60 as time_waiting
		FROM meeting_permissions mp
		JOIN users u ON mp.user_id = u.id
		WHERE mp.meeting_id = $1 
		AND mp.approved_at IS NULL 
		AND mp.denied_at IS NULL
		ORDER BY mp.requested_at ASC`

	err := s.db.SelectContext(ctx, &requests, query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending permission requests: %w", err)
	}

	return requests, nil
}

// ============================================================================
// PERMISSION MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *permissionService) ApprovePermission(ctx context.Context, requestID int, adminID int, response string) error {
	now := time.Now()

	query := `
		UPDATE meeting_permissions 
		SET is_granted = true, approved_at = $1, approved_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4 AND approved_at IS NULL AND denied_at IS NULL`

	result, err := s.db.ExecContext(ctx, query, now, adminID, response, requestID)
	if err != nil {
		return fmt.Errorf("failed to approve permission: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("permission request not found or already processed")
	}

	// Get permission details for broadcasting
	permission, err := s.GetPermissionRequest(ctx, requestID)
	if err != nil {
		return err // Permission approved but broadcast may fail
	}

	// Broadcast permission update
	update := &PermissionUpdate{
		MeetingID:      *permission.MeetingID,
		UserID:         *permission.UserID,
		PermissionType: permission.PermissionType,
		Action:         "granted",
		AdminID:        &adminID,
		Reason:         response,
		Timestamp:      now,
	}

	s.BroadcastPermissionUpdate(ctx, update)

	return nil
}

func (s *permissionService) DenyPermission(ctx context.Context, requestID int, adminID int, response string) error {
	now := time.Now()

	query := `
		UPDATE meeting_permissions 
		SET is_granted = false, denied_at = $1, denied_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4 AND approved_at IS NULL AND denied_at IS NULL`

	result, err := s.db.ExecContext(ctx, query, now, adminID, response, requestID)
	if err != nil {
		return fmt.Errorf("failed to deny permission: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("permission request not found or already processed")
	}

	// Get permission details for broadcasting
	permission, err := s.GetPermissionRequest(ctx, requestID)
	if err != nil {
		return err // Permission denied but broadcast may fail
	}

	// Broadcast permission update
	update := &PermissionUpdate{
		MeetingID:      *permission.MeetingID,
		UserID:         *permission.UserID,
		PermissionType: permission.PermissionType,
		Action:         "denied",
		AdminID:        &adminID,
		Reason:         response,
		Timestamp:      now,
	}

	s.BroadcastPermissionUpdate(ctx, update)

	return nil
}

func (s *permissionService) BulkApprovePermissions(ctx context.Context, requestIDs []int, adminID int, response string) error {
	if len(requestIDs) == 0 {
		return fmt.Errorf("no permission requests to approve")
	}

	now := time.Now()

	// Build placeholders for IN clause
	placeholders := make([]string, len(requestIDs))
	args := make([]interface{}, len(requestIDs)+3)
	args[0] = now
	args[1] = adminID
	args[2] = response

	for i, id := range requestIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+4)
		args[i+3] = id
	}

	query := fmt.Sprintf(`
		UPDATE meeting_permissions 
		SET is_granted = true, approved_at = $1, approved_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id IN (%s) AND approved_at IS NULL AND denied_at IS NULL`,
		fmt.Sprintf("%s", placeholders))

	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to bulk approve permissions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no permission requests were approved")
	}

	// Broadcast updates for each approved permission
	for _, requestID := range requestIDs {
		permission, err := s.GetPermissionRequest(ctx, requestID)
		if err == nil {
			update := &PermissionUpdate{
				MeetingID:      *permission.MeetingID,
				UserID:         *permission.UserID,
				PermissionType: permission.PermissionType,
				Action:         "granted",
				AdminID:        &adminID,
				Reason:         response,
				Timestamp:      now,
			}
			s.BroadcastPermissionUpdate(ctx, update)
		}
	}

	return nil
}

func (s *permissionService) BulkDenyPermissions(ctx context.Context, requestIDs []int, adminID int, response string) error {
	if len(requestIDs) == 0 {
		return fmt.Errorf("no permission requests to deny")
	}

	now := time.Now()

	// Build placeholders for IN clause
	placeholders := make([]string, len(requestIDs))
	args := make([]interface{}, len(requestIDs)+3)
	args[0] = now
	args[1] = adminID
	args[2] = response

	for i, id := range requestIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+4)
		args[i+3] = id
	}

	query := fmt.Sprintf(`
		UPDATE meeting_permissions 
		SET is_granted = false, denied_at = $1, denied_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id IN (%s) AND approved_at IS NULL AND denied_at IS NULL`,
		fmt.Sprintf("%s", placeholders))

	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to bulk deny permissions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no permission requests were denied")
	}

	return nil
}

// ============================================================================
// PERMISSION STATUS IMPLEMENTATION
// ============================================================================

func (s *permissionService) GetUserPermissions(ctx context.Context, meetingID int, userID int) (*UserPermissionStatus, error) {
	status := &UserPermissionStatus{
		UserID:      userID,
		MeetingID:   meetingID,
		Permissions: make(map[string]bool),
		LastUpdated: time.Now(),
	}

	// Get granted permissions
	grantedQuery := `
		SELECT permission_type, is_granted, approved_at, approved_by
		FROM meeting_permissions 
		WHERE meeting_id = $1 AND user_id = $2 AND approved_at IS NOT NULL`

	rows, err := s.db.QueryContext(ctx, grantedQuery, meetingID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}
	defer rows.Close()

	var latestUpdate time.Time
	var approvedBy *int

	for rows.Next() {
		var permissionType string
		var isGranted bool
		var approvedAt *time.Time
		var approver *int

		err := rows.Scan(&permissionType, &isGranted, &approvedAt, &approver)
		if err != nil {
			continue
		}

		status.Permissions[permissionType] = isGranted

		if approvedAt != nil && approvedAt.After(latestUpdate) {
			latestUpdate = *approvedAt
			approvedBy = approver
		}
	}

	status.LastUpdated = latestUpdate
	status.UpdatedBy = approvedBy

	// Get admin name if available
	if approvedBy != nil {
		var adminName string
		adminQuery := `SELECT first_name || ' ' || last_name FROM users WHERE id = $1`
		err = s.db.GetContext(ctx, &adminName, adminQuery, *approvedBy)
		if err == nil {
			status.AdminName = adminName
		}
	}

	// Get pending requests
	pendingRequests, err := s.GetUserPermissionRequests(ctx, meetingID, userID)
	if err == nil {
		for _, req := range pendingRequests {
			if req.ApprovedAt == nil && req.DeniedAt == nil {
				status.PendingRequests = append(status.PendingRequests, req)
			}
		}
	}

	return status, nil
}

func (s *permissionService) UpdateUserPermissions(ctx context.Context, meetingID int, userID int, permissions map[string]bool, adminID int) error {
	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()

	for permissionType, granted := range permissions {
		if granted {
			// Grant permission
			query := `
				INSERT INTO meeting_permissions (meeting_id, user_id, permission_type, is_granted, 
					approved_at, approved_by, admin_response, auto_granted, created_at, updated_at)
				VALUES ($1, $2, $3, true, $4, $5, 'Updated by admin', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				ON CONFLICT (meeting_id, user_id, permission_type)
				DO UPDATE SET 
					is_granted = true, 
					approved_at = $4, 
					approved_by = $5, 
					denied_at = NULL, 
					denied_by = NULL,
					admin_response = 'Updated by admin',
					updated_at = CURRENT_TIMESTAMP`

			_, err = tx.ExecContext(ctx, query, meetingID, userID, permissionType, now, adminID)
			if err != nil {
				return fmt.Errorf("failed to grant permission %s: %w", permissionType, err)
			}
		} else {
			// Revoke permission
			query := `
				UPDATE meeting_permissions 
				SET is_granted = false, denied_at = $1, denied_by = $2, 
					admin_response = 'Revoked by admin', updated_at = CURRENT_TIMESTAMP
				WHERE meeting_id = $3 AND user_id = $4 AND permission_type = $5`

			_, err = tx.ExecContext(ctx, query, now, adminID, meetingID, userID, permissionType)
			if err != nil {
				return fmt.Errorf("failed to revoke permission %s: %w", permissionType, err)
			}
		}

		// Broadcast update
		update := &PermissionUpdate{
			MeetingID:      meetingID,
			UserID:         userID,
			PermissionType: permissionType,
			Action:         map[bool]string{true: "granted", false: "revoked"}[granted],
			AdminID:        &adminID,
			Reason:         "Updated by admin",
			Timestamp:      now,
		}
		s.BroadcastPermissionUpdate(ctx, update)
	}

	return tx.Commit()
}

func (s *permissionService) RevokePermission(ctx context.Context, meetingID int, userID int, permissionType string, adminID int, reason string) error {
	now := time.Now()

	query := `
		UPDATE meeting_permissions 
		SET is_granted = false, denied_at = $1, denied_by = $2, admin_response = $3, updated_at = CURRENT_TIMESTAMP
		WHERE meeting_id = $4 AND user_id = $5 AND permission_type = $6 AND is_granted = true`

	result, err := s.db.ExecContext(ctx, query, now, adminID, reason, meetingID, userID, permissionType)
	if err != nil {
		return fmt.Errorf("failed to revoke permission: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("permission not found or already revoked")
	}

	// Broadcast permission update
	update := &PermissionUpdate{
		MeetingID:      meetingID,
		UserID:         userID,
		PermissionType: permissionType,
		Action:         "revoked",
		AdminID:        &adminID,
		Reason:         reason,
		Timestamp:      now,
	}

	s.BroadcastPermissionUpdate(ctx, update)

	return nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func (s *permissionService) checkAutoGrantPermission(ctx context.Context, meetingID int, permissionType string) (bool, error) {
	// Get meeting's default permissions or template
	defaults, err := s.GetDefaultPermissions(ctx, meetingID)
	if err != nil {
		return false, err
	}

	// Check if this permission type should be auto-granted
	switch permissionType {
	case "video":
		return defaults.AutoGrantVideo, nil
	case "audio":
		return defaults.AutoGrantAudio, nil
	case "screen_share":
		return defaults.AutoGrantScreenShare, nil
	case "chat":
		return defaults.AutoGrantChat, nil
	default:
		return false, nil
	}
}

// ============================================================================
// PERMISSION TEMPLATES IMPLEMENTATION
// ============================================================================

func (s *permissionService) CreatePermissionTemplate(ctx context.Context, template *PermissionTemplate) error {
	// This would be implemented based on requirements
	return fmt.Errorf("permission templates not yet implemented")
}

func (s *permissionService) GetPermissionTemplate(ctx context.Context, templateID int) (*PermissionTemplate, error) {
	// This would be implemented based on requirements
	return nil, fmt.Errorf("permission templates not yet implemented")
}

func (s *permissionService) ApplyPermissionTemplate(ctx context.Context, meetingID int, templateID int, adminID int) error {
	// This would be implemented based on requirements
	return fmt.Errorf("permission templates not yet implemented")
}

func (s *permissionService) GetDefaultPermissions(ctx context.Context, meetingID int) (*DefaultPermissions, error) {
	defaults := &DefaultPermissions{
		MeetingID:            meetingID,
		VideoEnabled:         true,
		AudioEnabled:         true,
		ScreenShareEnabled:   true,
		ChatEnabled:          true,
		RecordingEnabled:     false,
		AutoGrantVideo:       false,
		AutoGrantAudio:       true, // Audio often auto-granted
		AutoGrantScreenShare: false,
		AutoGrantChat:        true, // Chat often auto-granted
		RequireApproval:      []string{"video", "screen_share", "recording"},
	}

	return defaults, nil
}

// ============================================================================
// REAL-TIME UPDATES IMPLEMENTATION
// ============================================================================

func (s *permissionService) GetPermissionUpdates(ctx context.Context, meetingID int, since time.Time) ([]*PermissionUpdate, error) {
	// This would integrate with WebSocket system to get recent updates
	// For now, return empty array
	return []*PermissionUpdate{}, nil
}

func (s *permissionService) BroadcastPermissionUpdate(ctx context.Context, update *PermissionUpdate) error {
	// This would integrate with WebSocket system to broadcast updates
	// For now, just log the update
	fmt.Printf("Broadcasting permission update: %+v", update)
	return nil
}
