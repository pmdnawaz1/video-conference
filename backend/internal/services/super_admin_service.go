package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type SuperAdmin interface {
	// Organization Management
	CreateOrganization(ctx context.Context, req *CreateOrganizationRequest) (*models.Client, error)
	GetAllOrganizations(ctx context.Context) ([]*OrganizationSummary, error)
	GetOrganizationDetails(ctx context.Context, clientID int) (*OrganizationDetails, error)
	UpdateOrganization(ctx context.Context, clientID int, req *UpdateOrganizationRequest) error
	DeactivateOrganization(ctx context.Context, clientID int) error
	GetOrganizationMetrics(ctx context.Context, clientID int) (*OrganizationMetrics, error)

	// Admin Management (extends Admin interface)
	GetAllAdmins(ctx context.Context, filters *AdminFilters) ([]*AdminSummary, error)
	GetAdminDetails(ctx context.Context, adminID int) (*AdminDetails, error)
	SuspendAdmin(ctx context.Context, adminID int, reason string) error
	UnsuspendAdmin(ctx context.Context, adminID int) error
	DeleteAdmin(ctx context.Context, adminID int) error
	BulkInviteAdmins(ctx context.Context, invitations []*AdminInvitationRequest) ([]*models.AdminInvitation, error)

	// System Analytics and Health
	GetSystemMetrics(ctx context.Context, timeframe string) (*SystemMetrics, error)
	GetSystemHealth(ctx context.Context) (*SystemHealth, error)
	GetUsageReports(ctx context.Context, params *UsageReportParams) (*UsageReport, error)
	ExportData(ctx context.Context, dataType, format string, filters map[string]interface{}) ([]byte, error)
}

// Request/Response types for Super Admin operations
type CreateOrganizationRequest struct {
	OrganizationName string `json:"organization_name" validate:"required"`
	OrganizationType string `json:"organization_type" validate:"required,oneof=enterprise business education nonprofit"`
	AdminEmail       string `json:"admin_email" validate:"required,email"`
	AdminFirstName   string `json:"admin_first_name" validate:"required"`
	AdminLastName    string `json:"admin_last_name" validate:"required"`
	SubscriptionPlan string `json:"subscription_plan" validate:"required,oneof=free basic premium enterprise"`
	MaxAdmins        int    `json:"max_admins" validate:"min=1"`
	MaxUsers         int    `json:"max_users" validate:"min=1"`
	CustomDomain     string `json:"custom_domain,omitempty"`
}

type UpdateOrganizationRequest struct {
	OrganizationName      string `json:"organization_name,omitempty"`
	OrganizationType      string `json:"organization_type,omitempty"`
	SubscriptionPlan      string `json:"subscription_plan,omitempty"`
	MaxAdmins             int    `json:"max_admins,omitempty"`
	MaxUsers              int    `json:"max_users,omitempty"`
	MaxConcurrentMeetings int    `json:"max_concurrent_meetings,omitempty"`
	StorageLimitGB        int    `json:"storage_limit_gb,omitempty"`
}

type OrganizationSummary struct {
	ID                    int        `json:"id"`
	OrganizationName      string     `json:"organization_name"`
	OrganizationType      string     `json:"organization_type"`
	SubscriptionPlan      string     `json:"subscription_plan"`
	AdminCount            int        `json:"admin_count"`
	UserCount             int        `json:"user_count"`
	MeetingCount          int        `json:"meeting_count"`
	IsActive              bool       `json:"is_active"`
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at"`
	CreatedAt             time.Time  `json:"created_at"`
}

type OrganizationDetails struct {
	*models.Client
	AdminCount     int             `json:"admin_count"`
	UserCount      int             `json:"user_count"`
	ActiveMeetings int             `json:"active_meetings"`
	TotalMeetings  int             `json:"total_meetings"`
	StorageUsedGB  float64         `json:"storage_used_gb"`
	RecentAdmins   []*AdminSummary `json:"recent_admins"`
	RecentActivity []*ActivityLog  `json:"recent_activity"`
}

type OrganizationMetrics struct {
	ClientID               int     `json:"client_id"`
	TotalUsers             int     `json:"total_users"`
	ActiveUsers            int     `json:"active_users"`
	TotalMeetings          int     `json:"total_meetings"`
	MeetingsThisMonth      int     `json:"meetings_this_month"`
	AverageMeetingDuration int     `json:"average_meeting_duration"`
	StorageUsedGB          float64 `json:"storage_used_gb"`
	BandwidthUsedGB        float64 `json:"bandwidth_used_gb"`
}

type AdminFilters struct {
	ClientID int    `json:"client_id,omitempty"`
	Status   string `json:"status,omitempty"`
	Search   string `json:"search,omitempty"`
	Limit    int    `json:"limit,omitempty"`
	Offset   int    `json:"offset,omitempty"`
}

type AdminSummary struct {
	ID               int        `json:"id"`
	ClientID         int        `json:"client_id"`
	Email            string     `json:"email"`
	FirstName        string     `json:"first_name"`
	LastName         string     `json:"last_name"`
	Role             string     `json:"role"`
	Status           string     `json:"status"`
	LastLogin        *time.Time `json:"last_login"`
	CreatedAt        time.Time  `json:"created_at"`
	OrganizationName string     `json:"organization_name"`
}

type AdminDetails struct {
	*models.User
	OrganizationName string         `json:"organization_name"`
	MeetingsCreated  int            `json:"meetings_created"`
	UsersInvited     int            `json:"users_invited"`
	LastActivity     *time.Time     `json:"last_activity"`
	Sessions         []*UserSession `json:"sessions"`
	RecentActions    []*ActivityLog `json:"recent_actions"`
}

type SystemMetrics struct {
	TotalOrganizations  int                    `json:"total_organizations"`
	ActiveOrganizations int                    `json:"active_organizations"`
	TotalAdmins         int                    `json:"total_admins"`
	TotalUsers          int                    `json:"total_users"`
	ActiveMeetings      int                    `json:"active_meetings"`
	TotalMeetingsToday  int                    `json:"total_meetings_today"`
	SystemUptime        time.Duration          `json:"system_uptime"`
	DatabaseConnections int                    `json:"database_connections"`
	MemoryUsage         SystemResourceUsage    `json:"memory_usage"`
	CPUUsage            SystemResourceUsage    `json:"cpu_usage"`
	StorageUsage        SystemResourceUsage    `json:"storage_usage"`
	RecentSignups       []*OrganizationSummary `json:"recent_signups"`
}

type SystemHealth struct {
	Status             string        `json:"status"` // healthy, degraded, unhealthy
	DatabaseStatus     string        `json:"database_status"`
	EmailServiceStatus string        `json:"email_service_status"`
	StorageStatus      string        `json:"storage_status"`
	LastChecked        time.Time     `json:"last_checked"`
	Issues             []SystemIssue `json:"issues,omitempty"`
	Uptime             time.Duration `json:"uptime"`
}

type SystemResourceUsage struct {
	Used       float64 `json:"used"`
	Total      float64 `json:"total"`
	Percentage float64 `json:"percentage"`
}

type SystemIssue struct {
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	DetectedAt  time.Time `json:"detected_at"`
}

type UsageReportParams struct {
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	ClientID    int       `json:"client_id,omitempty"`
	ReportType  string    `json:"report_type"` // meetings, users, storage, bandwidth
	Granularity string    `json:"granularity"` // daily, weekly, monthly
}

type UsageReport struct {
	ReportType   string                   `json:"report_type"`
	Period       string                   `json:"period"`
	TotalRecords int                      `json:"total_records"`
	Data         []map[string]interface{} `json:"data"`
	Summary      map[string]interface{}   `json:"summary"`
	GeneratedAt  time.Time                `json:"generated_at"`
}

type ActivityLog struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	UserName    string    `json:"user_name"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	ResourceID  int       `json:"resource_id"`
	Description string    `json:"description"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	CreatedAt   time.Time `json:"created_at"`
}

type superAdminService struct {
	db        *database.DB
	adminSvc  Admin
	userSvc   UserService
	clientSvc ClientService
}

func SuperAdminService(db *database.DB, adminSvc Admin, userSvc UserService, clientSvc ClientService) SuperAdmin {
	return &superAdminService{
		db:        db,
		adminSvc:  adminSvc,
		userSvc:   userSvc,
		clientSvc: clientSvc,
	}
}

// ============================================================================
// ORGANIZATION MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *superAdminService) CreateOrganization(ctx context.Context, req *CreateOrganizationRequest) (*models.Client, error) {
	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Create organization
	client := &models.Client{
		Email:        req.AdminEmail,
		AppName:      req.OrganizationName,
		Theme:        "default",
		PrimaryColor: "#007bff",
	}

	// Insert client
	query := `
		INSERT INTO clients (email, app_name, organization_name, organization_type, subscription_plan, 
		                    max_admins, max_users, theme, primary_color, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, created_at, updated_at`

	err = tx.GetContext(ctx, client, query,
		client.Email, client.AppName, req.OrganizationName, req.OrganizationType,
		req.SubscriptionPlan, req.MaxAdmins, req.MaxUsers, client.Theme, client.PrimaryColor)
	if err != nil {
		return nil, fmt.Errorf("failed to create organization: %w", err)
	}

	// Create default client features
	featuresQuery := `
		INSERT INTO client_features (client_id, chat_enabled, reactions_enabled, screen_sharing_enabled,
		                           recording_enabled, raise_hand_enabled, waiting_room_enabled, max_participants)
		VALUES ($1, true, true, true, true, true, true, 1000)`

	_, err = tx.ExecContext(ctx, featuresQuery, client.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create client features: %w", err)
	}

	// Create admin invitation
	invitation := &AdminInvitationRequest{
		ClientID:  client.ID,
		Email:     req.AdminEmail,
		FirstName: req.AdminFirstName,
		LastName:  req.AdminLastName,
		Message:   fmt.Sprintf("Welcome! You've been assigned as the administrator for %s.", req.OrganizationName),
	}

	// Use admin service to create invitation (this will handle email sending)
	_, err = s.adminSvc.CreateAdminInvitation(ctx, invitation)
	if err != nil {
		return nil, fmt.Errorf("failed to create admin invitation: %w", err)
	}

	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return client, nil
}

func (s *superAdminService) GetAllOrganizations(ctx context.Context) ([]*OrganizationSummary, error) {
	query := `
		SELECT 
			c.id, c.organization_name, c.organization_type, c.subscription_plan,
			c.is_active, c.subscription_expires_at, c.created_at,
			COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
			COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'user') as user_count,
			COUNT(DISTINCT m.id) as meeting_count
		FROM clients c
		LEFT JOIN users u ON c.id = u.client_id AND u.role = 'admin'
		LEFT JOIN users u2 ON c.id = u2.client_id AND u2.role = 'user'
		LEFT JOIN meetings m ON c.id = m.client_id
		GROUP BY c.id, c.organization_name, c.organization_type, c.subscription_plan,
		         c.is_active, c.subscription_expires_at, c.created_at
		ORDER BY c.created_at DESC`

	var organizations []*OrganizationSummary
	err := s.db.SelectContext(ctx, &organizations, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get organizations: %w", err)
	}

	return organizations, nil
}

func (s *superAdminService) GetOrganizationDetails(ctx context.Context, clientID int) (*OrganizationDetails, error) {
	// Get client details
	client, err := s.clientSvc.GetClientByID(ctx, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	details := &OrganizationDetails{
		Client: client,
	}

	// Get counts and metrics
	statsQuery := `
		SELECT 
			COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
			COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'user') as user_count,
			COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as active_meetings,
			COUNT(DISTINCT m2.id) as total_meetings
		FROM clients c
		LEFT JOIN users u ON c.id = u.client_id AND u.role = 'admin'
		LEFT JOIN users u2 ON c.id = u2.client_id AND u2.role = 'user'  
		LEFT JOIN meetings m ON c.id = m.client_id AND m.status = 'active'
		LEFT JOIN meetings m2 ON c.id = m2.client_id
		WHERE c.id = $1`

	err = s.db.GetContext(ctx, details, statsQuery, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization stats: %w", err)
	}

	// Get recent admins
	adminQuery := `
		SELECT u.id, u.client_id, u.email, u.first_name, u.last_name, u.role, u.status, u.last_login, u.created_at,
		       c.organization_name
		FROM users u
		JOIN clients c ON u.client_id = c.id
		WHERE u.client_id = $1 AND u.role = 'admin'
		ORDER BY u.created_at DESC
		LIMIT 5`

	err = s.db.SelectContext(ctx, &details.RecentAdmins, adminQuery, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent admins: %w", err)
	}

	return details, nil
}

func (s *superAdminService) UpdateOrganization(ctx context.Context, clientID int, req *UpdateOrganizationRequest) error {
	// Build dynamic update query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.OrganizationName != "" {
		setParts = append(setParts, fmt.Sprintf("organization_name = $%d", argIndex))
		args = append(args, req.OrganizationName)
		argIndex++
	}

	if req.OrganizationType != "" {
		setParts = append(setParts, fmt.Sprintf("organization_type = $%d", argIndex))
		args = append(args, req.OrganizationType)
		argIndex++
	}

	if req.SubscriptionPlan != "" {
		setParts = append(setParts, fmt.Sprintf("subscription_plan = $%d", argIndex))
		args = append(args, req.SubscriptionPlan)
		argIndex++
	}

	if req.MaxAdmins > 0 {
		setParts = append(setParts, fmt.Sprintf("max_admins = $%d", argIndex))
		args = append(args, req.MaxAdmins)
		argIndex++
	}

	if req.MaxUsers > 0 {
		setParts = append(setParts, fmt.Sprintf("max_users = $%d", argIndex))
		args = append(args, req.MaxUsers)
		argIndex++
	}

	if len(setParts) == 0 {
		return fmt.Errorf("no fields to update")
	}

	setParts = append(setParts, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, clientID)

	query := fmt.Sprintf("UPDATE clients SET %s WHERE id = $%d",
		fmt.Sprintf("%s", setParts), argIndex)

	_, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update organization: %w", err)
	}

	return nil
}

func (s *superAdminService) DeactivateOrganization(ctx context.Context, clientID int) error {
	query := `UPDATE clients SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, clientID)
	if err != nil {
		return fmt.Errorf("failed to deactivate organization: %w", err)
	}
	return nil
}

func (s *superAdminService) GetOrganizationMetrics(ctx context.Context, clientID int) (*OrganizationMetrics, error) {
	metrics := &OrganizationMetrics{
		ClientID: clientID,
	}

	query := `
		SELECT 
			COUNT(DISTINCT u.id) as total_users,
			COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active' AND u.last_login > CURRENT_TIMESTAMP - INTERVAL '30 days') as active_users,
			COUNT(DISTINCT m.id) as total_meetings,
			COUNT(DISTINCT m.id) FILTER (WHERE m.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as meetings_this_month,
			COALESCE(AVG(EXTRACT(EPOCH FROM (m.actual_end - m.actual_start))/60), 0) as average_meeting_duration
		FROM clients c
		LEFT JOIN users u ON c.id = u.client_id AND u.role IN ('admin', 'user')
		LEFT JOIN meetings m ON c.id = m.client_id
		WHERE c.id = $1`

	err := s.db.GetContext(ctx, metrics, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization metrics: %w", err)
	}

	return metrics, nil
}

// ============================================================================
// ADMIN MANAGEMENT IMPLEMENTATION
// ============================================================================

func (s *superAdminService) GetAllAdmins(ctx context.Context, filters *AdminFilters) ([]*AdminSummary, error) {
	query := `
		SELECT u.id, u.client_id, u.email, u.first_name, u.last_name, u.role, u.status, 
		       u.last_login, u.created_at, c.organization_name
		FROM users u
		JOIN clients c ON u.client_id = c.id
		WHERE u.role = 'admin'`

	args := []interface{}{}
	argIndex := 1

	if filters != nil {
		if filters.ClientID > 0 {
			query += fmt.Sprintf(" AND u.client_id = $%d", argIndex)
			args = append(args, filters.ClientID)
			argIndex++
		}

		if filters.Status != "" {
			query += fmt.Sprintf(" AND u.status = $%d", argIndex)
			args = append(args, filters.Status)
			argIndex++
		}

		if filters.Search != "" {
			query += fmt.Sprintf(" AND (u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.email ILIKE $%d)",
				argIndex, argIndex, argIndex)
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

	var admins []*AdminSummary
	err := s.db.SelectContext(ctx, &admins, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get admins: %w", err)
	}

	return admins, nil
}

func (s *superAdminService) GetAdminDetails(ctx context.Context, adminID int) (*AdminDetails, error) {
	// Get admin user
	user, err := s.userSvc.GetUserByID(ctx, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed to get admin: %w", err)
	}

	if user.Role != models.RoleAdmin {
		return nil, fmt.Errorf("user is not an admin")
	}

	details := &AdminDetails{
		User: user,
	}

	// Get organization name
	var orgName string
	query := `SELECT organization_name FROM clients WHERE id = $1`
	err = s.db.GetContext(ctx, &orgName, query, user.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization name: %w", err)
	}
	details.OrganizationName = orgName

	// Get admin statistics
	statsQuery := `
		SELECT 
			COUNT(DISTINCT m.id) as meetings_created,
			COUNT(DISTINCT ai.id) as users_invited
		FROM users u
		LEFT JOIN meetings m ON u.id = m.created_by_user_id
		LEFT JOIN admin_invitations ai ON u.id = ai.invited_by
		WHERE u.id = $1`

	err = s.db.GetContext(ctx, details, statsQuery, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed to get admin stats: %w", err)
	}

	return details, nil
}

func (s *superAdminService) SuspendAdmin(ctx context.Context, adminID int, reason string) error {
	query := `UPDATE users SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND role = 'admin'`
	_, err := s.db.ExecContext(ctx, query, adminID)
	if err != nil {
		return fmt.Errorf("failed to suspend admin: %w", err)
	}
	return nil
}

func (s *superAdminService) UnsuspendAdmin(ctx context.Context, adminID int) error {
	query := `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND role = 'admin'`
	_, err := s.db.ExecContext(ctx, query, adminID)
	if err != nil {
		return fmt.Errorf("failed to unsuspend admin: %w", err)
	}
	return nil
}

func (s *superAdminService) DeleteAdmin(ctx context.Context, adminID int) error {
	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if admin exists and is not the last admin for the organization
	var clientID int
	var adminCount int
	countQuery := `
		SELECT u.client_id, COUNT(*) as admin_count
		FROM users u
		WHERE u.client_id = (SELECT client_id FROM users WHERE id = $1)
		AND u.role = 'admin'
		AND u.id != $1
		GROUP BY u.client_id`

	err = tx.GetContext(ctx, &struct {
		ClientID   int `db:"client_id"`
		AdminCount int `db:"admin_count"`
	}{ClientID: clientID, AdminCount: adminCount}, countQuery, adminID, adminID)

	if adminCount == 0 {
		return fmt.Errorf("cannot delete the last admin of an organization")
	}

	// Delete the admin
	deleteQuery := `DELETE FROM users WHERE id = $1 AND role = 'admin'`
	_, err = tx.ExecContext(ctx, deleteQuery, adminID)
	if err != nil {
		return fmt.Errorf("failed to delete admin: %w", err)
	}

	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *superAdminService) BulkInviteAdmins(ctx context.Context, invitations []*AdminInvitationRequest) ([]*models.AdminInvitation, error) {
	var results []*models.AdminInvitation

	for _, req := range invitations {
		invitation, err := s.adminSvc.CreateAdminInvitation(ctx, req)
		if err != nil {
			// Log error but continue with other invitations
			fmt.Printf("Failed to create invitation for %s: %v", req.Email, err)
			continue
		}
		results = append(results, invitation)
	}

	return results, nil
}

// ============================================================================
// SYSTEM ANALYTICS AND HEALTH IMPLEMENTATION
// ============================================================================

func (s *superAdminService) GetSystemMetrics(ctx context.Context, timeframe string) (*SystemMetrics, error) {
	metrics := &SystemMetrics{
		SystemUptime: time.Since(time.Now().Add(-24 * time.Hour)), // Placeholder
	}

	// Get basic counts
	countsQuery := `
		SELECT 
			COUNT(DISTINCT c.id) as total_organizations,
			COUNT(DISTINCT c.id) FILTER (WHERE c.is_active = true) as active_organizations,
			COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as total_admins,
			COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'user') as total_users,
			COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active') as active_meetings,
			COUNT(DISTINCT m2.id) FILTER (WHERE m2.created_at::date = CURRENT_DATE) as total_meetings_today
		FROM clients c
		LEFT JOIN users u ON c.id = u.client_id AND u.role = 'admin'
		LEFT JOIN users u2 ON c.id = u2.client_id AND u2.role = 'user'
		LEFT JOIN meetings m ON c.id = m.client_id AND m.status = 'active'
		LEFT JOIN meetings m2 ON c.id = m2.client_id AND m2.created_at::date = CURRENT_DATE`

	err := s.db.GetContext(ctx, metrics, countsQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to get system metrics: %w", err)
	}

	// Get recent signups (last 7 days)
	recentQuery := `
		SELECT id, organization_name, organization_type, subscription_plan, 0 as admin_count, 
		       0 as user_count, 0 as meeting_count, is_active, subscription_expires_at, created_at
		FROM clients
		WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
		ORDER BY created_at DESC
		LIMIT 10`

	err = s.db.SelectContext(ctx, &metrics.RecentSignups, recentQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent signups: %w", err)
	}

	// Placeholder resource usage data
	metrics.MemoryUsage = SystemResourceUsage{Used: 2.5, Total: 8.0, Percentage: 31.25}
	metrics.CPUUsage = SystemResourceUsage{Used: 1.2, Total: 4.0, Percentage: 30.0}
	metrics.StorageUsage = SystemResourceUsage{Used: 45.2, Total: 100.0, Percentage: 45.2}

	return metrics, nil
}

func (s *superAdminService) GetSystemHealth(ctx context.Context) (*SystemHealth, error) {
	health := &SystemHealth{
		Status:      "healthy",
		LastChecked: time.Now(),
		Uptime:      time.Since(time.Now().Add(-24 * time.Hour)),
	}

	// Check database
	err := s.db.DB.Ping()
	if err != nil {
		health.DatabaseStatus = "unhealthy"
		health.Status = "degraded"
		health.Issues = append(health.Issues, SystemIssue{
			Type:        "database",
			Severity:    "high",
			Description: "Database connectivity issues",
			DetectedAt:  time.Now(),
		})
	} else {
		health.DatabaseStatus = "healthy"
	}

	// Placeholder for other service checks
	health.EmailServiceStatus = "healthy"
	health.StorageStatus = "healthy"

	return health, nil
}

func (s *superAdminService) GetUsageReports(ctx context.Context, params *UsageReportParams) (*UsageReport, error) {
	report := &UsageReport{
		ReportType:  params.ReportType,
		Period:      fmt.Sprintf("%s to %s", params.StartDate.Format("2006-01-02"), params.EndDate.Format("2006-01-02")),
		GeneratedAt: time.Now(),
	}

	// Based on report type, generate appropriate query
	switch params.ReportType {
	case "meetings":
		query := `
			SELECT 
				DATE(created_at) as date,
				COUNT(*) as total_meetings,
				COUNT(*) FILTER (WHERE status = 'ended') as completed_meetings,
				AVG(EXTRACT(EPOCH FROM (actual_end - actual_start))/60) as avg_duration
			FROM meetings
			WHERE created_at BETWEEN $1 AND $2`

		if params.ClientID > 0 {
			query += " AND client_id = $3"
		}

		query += " GROUP BY DATE(created_at) ORDER BY date"

		var args []interface{}
		args = append(args, params.StartDate, params.EndDate)
		if params.ClientID > 0 {
			args = append(args, params.ClientID)
		}

		rows, err := s.db.QueryContext(ctx, query, args...)
		if err != nil {
			return nil, fmt.Errorf("failed to generate meetings report: %w", err)
		}
		defer rows.Close()

		var data []map[string]interface{}
		for rows.Next() {
			var date time.Time
			var totalMeetings, completedMeetings int
			var avgDuration float64

			err := rows.Scan(&date, &totalMeetings, &completedMeetings, &avgDuration)
			if err != nil {
				continue
			}

			data = append(data, map[string]interface{}{
				"date":               date.Format("2006-01-02"),
				"total_meetings":     totalMeetings,
				"completed_meetings": completedMeetings,
				"avg_duration":       avgDuration,
			})
		}

		report.Data = data
		report.TotalRecords = len(data)

	case "users":
		// Similar implementation for user reports
		report.Data = []map[string]interface{}{
			{"date": "2024-01-01", "new_users": 10, "active_users": 50},
		}
		report.TotalRecords = 1
	}

	return report, nil
}

func (s *superAdminService) ExportData(ctx context.Context, dataType, format string, filters map[string]interface{}) ([]byte, error) {
	// This would implement CSV/PDF export functionality
	// For now, return a placeholder
	placeholder := "data export functionality not yet implemented"
	return []byte(placeholder), nil
}
