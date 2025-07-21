package services

import (
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/database"
)

// Services holds all service dependencies
type Services struct {
	Client      ClientService
	User        UserService
	Auth        AuthService
	Meeting     MeetingService
	Invitation  *InvitationService
	Email       *EmailService
	Calendar    *CalendarService
	Chat        ChatService
	Recording   RecordingService
	Group       GroupService
}

// NewServices creates a new services instance
func NewServices(db *database.DB, cfg *config.Config) *Services {
	// Initialize individual services in proper order to avoid circular dependencies
	clientService := NewClientService(db)
	userService := NewUserService(db)
	authService := NewAuthService(db, &cfg.Auth)
	emailService := NewEmailService(&cfg.Email)
	groupService := NewGroupService(db)
	meetingService := NewMeetingService(db)
	invitationService := NewInvitationService(db, cfg.Auth.JWTSecret)
	calendarService := NewCalendarService()
	chatService := NewChatService(db)
	recordingService := NewRecordingService(db, &cfg.Storage)

	return &Services{
		Client:     clientService,
		User:       userService,
		Auth:       authService,
		Meeting:    meetingService,
		Invitation: invitationService,
		Email:      emailService,
		Calendar:   calendarService,
		Chat:       chatService,
		Recording:  recordingService,
		Group:      groupService,
	}
}