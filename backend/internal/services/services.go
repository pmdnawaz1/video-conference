package services

import (
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/database"
)

// Services holds all service dependencies
type Services struct {
	Client            ClientService
	User              UserService
	Auth              AuthService
	Admin             Admin
	SuperAdmin        SuperAdmin
	AdminDashboard    AdminDashboard
	Meeting           MeetingService
	TimeValidation    TimeValidationService
	Permission        PermissionService
	RaiseHand         RaiseHandService
	Invitation        *InvitationService
	Email             *EmailService
	Calendar          *CalendarService
	EnhancedCalendar  EnhancedCalendarService
	Chat              ChatService
	Recording         RecordingService
	Group             GroupService
	Notification      NotificationService
	UserInvitation    UserInvitationService
	UserAnalytics     UserAnalyticsService
	UserPreference    UserPreferenceService
}

// NewServices creates a new services instance
func NewServices(db *database.DB, cfg *config.Config) *Services {
	// Initialize individual services in proper order to avoid circular dependencies
	clientService := NewClientService(db)
	userService := NewUserService(db)
	authService := NewAuthService(db, &cfg.Auth)
	emailService := NewEmailService(&cfg.Email)
	adminService := AdminService(db, userService, emailService)
	superAdminService := SuperAdminService(db, adminService, userService, clientService)
	groupService := NewGroupService(db)
	meetingService := NewMeetingService(db)
	timeValidationService := NewTimeValidationService(db)
	permissionService := NewPermissionService(db)
	raiseHandService := NewRaiseHandService(db)
	adminDashboardService := AdminDashboardService(db, userService, meetingService, groupService)
	invitationService := NewInvitationService(db, cfg.Auth.JWTSecret)
	calendarService := NewCalendarService()
	enhancedCalendarService := NewEnhancedCalendarService(db, "", "", "")
	chatService := NewChatService(db)
	recordingService := NewRecordingService(db, &cfg.Storage)
	notificationService := NewNotificationService(db)
	userInvitationService := NewUserInvitationService(db, cfg.Auth.JWTSecret, emailService)
	userAnalyticsService := NewUserAnalyticsService(db)
	userPreferenceService := NewUserPreferenceService(db)

	return &Services{
		Client:         clientService,
		User:           userService,
		Auth:           authService,
		Admin:          adminService,
		SuperAdmin:     superAdminService,
		AdminDashboard: adminDashboardService,
		Meeting:        meetingService,
		TimeValidation: timeValidationService,
		Permission:     permissionService,
		RaiseHand:      raiseHandService,
		Invitation:     invitationService,
		Email:          emailService,
		Calendar:       calendarService,
		EnhancedCalendar: enhancedCalendarService,
		Chat:           chatService,
		Recording:      recordingService,
		Group:          groupService,
		Notification:   notificationService,
		UserInvitation: userInvitationService,
		UserAnalytics:  userAnalyticsService,
		UserPreference: userPreferenceService,
	}
}