package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"video-conference-backend/internal/api/handlers"
	"video-conference-backend/internal/api/middleware"
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

// Server represents the API server
type Server struct {
	config   *config.Config
	services *services.Services
	router   *mux.Router
}

// NewServer creates a new API server instance
func NewServer(cfg *config.Config, svc *services.Services) *Server {
	server := &Server{
		config:   cfg,
		services: svc,
		router:   mux.NewRouter(),
	}

	server.setupRoutes()
	return server
}

// Router returns the configured router
func (s *Server) Router() http.Handler {
	return s.router
}

// setupRoutes configures all API routes
func (s *Server) setupRoutes() {
	// Apply global middleware
	s.router.Use(middleware.CORS(strings.Split(s.config.Server.CORSOrigins, ",")))
	s.router.Use(middleware.Recovery())

	// WebSocket route with enhanced handler supporting all frontend message types
	s.router.HandleFunc("/ws", handlers.HandleWebSocket).Methods("GET")

	// API v1 routes with logging middleware
	api := s.router.PathPrefix("/api/v1").Subrouter()
	api.Use(middleware.Logging())

	// Health check
	s.router.HandleFunc("/health", s.healthCheck).Methods("GET")
	s.router.HandleFunc("/api/health", s.healthCheck).Methods("GET")

	// Initialize handlers
	if s.services != nil {
		authHandler := handlers.NewAuthHandler(s.services.Auth, s.services.User)
		userHandler := handlers.NewUserHandler(s.services.User, s.services.UserAnalytics, s.services.UserPreference)
		clientHandler := handlers.NewClientHandler(s.services.Client)
		meetingHandler := handlers.NewMeetingHandler(s.services.Meeting)
		chatHandler := handlers.NewChatHandler(s.services.Chat)
		invitationHandler := handlers.NewInvitationHandler(s.services.Invitation, s.services.User, s.services.Email, s.services.Calendar)
		authMFAHandler := handlers.NewMFAHandler(s.services.Auth)
		adminHandler := handlers.AdminHandler(s.services.Admin, s.services.User, s.services.UserInvitation)
		superAdminHandler := handlers.SuperAdminHandler(s.services.SuperAdmin)
		adminDashboardHandler := handlers.AdminDashboardHandler(s.services.AdminDashboard)
		userInvitationHandler := handlers.UserInvitationHandler(s.services.UserInvitation)
		// Public routes (no authentication required)
		public := api.PathPrefix("/public").Subrouter()
		public.HandleFunc("/auth/login", authHandler.Login).Methods("POST", "OPTIONS")
		public.HandleFunc("/auth/refresh", authHandler.RefreshToken).Methods("POST", "OPTIONS")
		public.HandleFunc("/auth/register", authHandler.Register).Methods("POST", "OPTIONS")

		// Public invitation routes
		public.HandleFunc("/invitations/validate", invitationHandler.ValidateInvitation).Methods("GET", "OPTIONS")
		public.HandleFunc("/invitations/{token}", invitationHandler.GetInvitationByToken).Methods("GET", "OPTIONS")

		// Public user invitation routes
		public.HandleFunc("/user-invitations/validate", userInvitationHandler.ValidateUserInvitation).Methods("GET", "OPTIONS")
		public.HandleFunc("/user-invitations/complete", userInvitationHandler.CompleteUserRegistration).Methods("POST", "OPTIONS")

		// Protected routes (authentication required)
		protected := api.PathPrefix("").Subrouter()
		protected.Use(middleware.JWTAuth(s.services.Auth))

		// User routes
		protected.HandleFunc("/users/me", userHandler.GetProfile).Methods("GET", "OPTIONS")
		protected.HandleFunc("/users/me", userHandler.UpdateProfile).Methods("PUT", "OPTIONS")
		protected.HandleFunc("/users/me/password", userHandler.ChangePassword).Methods("PUT", "OPTIONS")
		protected.HandleFunc("/users/me/analytics", userHandler.GetUserAnalytics).Methods("GET", "OPTIONS")
		protected.HandleFunc("/users/me/preferences", userHandler.GetUserPreferences).Methods("GET", "OPTIONS")
		protected.HandleFunc("/users/me/preferences", userHandler.UpdateUserPreferences).Methods("PUT", "OPTIONS")
		
		// MFA routes
		protected.HandleFunc("/mfa/enable", authMFAHandler.EnableMFA).Methods("POST", "OPTIONS")
		protected.HandleFunc("/mfa/disable", authMFAHandler.DisableMFA).Methods("POST", "OPTIONS")
		protected.HandleFunc("/mfa/verify", authMFAHandler.VerifyMFA).Methods("POST", "OPTIONS")
		protected.HandleFunc("/mfa/backup-codes", authMFAHandler.RegenerateBackupCodes).Methods("POST", "OPTIONS")
		
		// Session Management routes
		protected.HandleFunc("/sessions", authMFAHandler.GetUserSessions).Methods("GET", "OPTIONS")
		protected.HandleFunc("/sessions/{sessionId}", authMFAHandler.ValidateSession).Methods("GET", "OPTIONS")
		protected.HandleFunc("/sessions/{sessionId}/revoke", authMFAHandler.RevokeSession).Methods("DELETE", "OPTIONS")

		// Admin routes (admin and super_admin access)
		admin := protected.PathPrefix("/admin").Subrouter()
		admin.Use(middleware.RequireRole("admin", "super_admin"))
		
		// Client management routes
		admin.HandleFunc("/clients", clientHandler.ListClients).Methods("GET", "OPTIONS")
		admin.HandleFunc("/clients", clientHandler.CreateClient).Methods("POST", "OPTIONS")
		admin.HandleFunc("/clients/{id}", clientHandler.GetClient).Methods("GET", "OPTIONS")
		admin.HandleFunc("/clients/{id}", clientHandler.UpdateClient).Methods("PUT", "OPTIONS")
		
		// Admin dashboard overview routes
		admin.HandleFunc("/dashboard/overview", adminDashboardHandler.GetDashboardOverview).Methods("GET", "OPTIONS")
		admin.HandleFunc("/dashboard/meeting-stats", adminDashboardHandler.GetMeetingStats).Methods("GET", "OPTIONS")
		admin.HandleFunc("/dashboard/recent-meetings", adminDashboardHandler.GetRecentMeetings).Methods("GET", "OPTIONS")
		admin.HandleFunc("/dashboard/upcoming-meetings", adminDashboardHandler.GetUpcomingMeetings).Methods("GET", "OPTIONS")
		admin.HandleFunc("/dashboard/user-groups-overview", adminDashboardHandler.GetUserGroupsOverview).Methods("GET", "OPTIONS")
		
		// Quick meeting creation routes
		admin.HandleFunc("/meetings/instant", adminDashboardHandler.CreateInstantMeeting).Methods("POST", "OPTIONS")
		admin.HandleFunc("/meetings/scheduled", adminDashboardHandler.CreateScheduledMeeting).Methods("POST", "OPTIONS")
		admin.HandleFunc("/meetings/recurring", adminDashboardHandler.CreateRecurringMeeting).Methods("POST", "OPTIONS")
		
		// User and group management routes
		admin.HandleFunc("/users", adminDashboardHandler.GetAllUsers).Methods("GET", "OPTIONS")
		admin.HandleFunc("/users/invite", adminDashboardHandler.InviteUser).Methods("POST", "OPTIONS")
		admin.HandleFunc("/groups", adminDashboardHandler.GetUserGroups).Methods("GET", "OPTIONS")
		admin.HandleFunc("/groups", adminDashboardHandler.CreateUserGroup).Methods("POST", "OPTIONS")
		
		// Meeting management routes
		admin.HandleFunc("/meetings/{id}/details", adminDashboardHandler.GetMeetingDetails).Methods("GET", "OPTIONS")
		admin.HandleFunc("/meetings/{id}/participants", adminDashboardHandler.GetMeetingParticipants).Methods("GET", "OPTIONS")
		admin.HandleFunc("/meetings/{id}/settings", adminDashboardHandler.UpdateMeetingSettings).Methods("PUT", "OPTIONS")
		admin.HandleFunc("/meetings/{id}/end", adminDashboardHandler.EndMeeting).Methods("POST", "OPTIONS")
		
		// Super admin routes (super admin only)
		superAdmin := protected.PathPrefix("/superadmin").Subrouter()
		superAdmin.Use(middleware.RequireRole("super_admin"))
		
		// Organization management routes
		superAdmin.HandleFunc("/organizations", superAdminHandler.CreateOrganization).Methods("POST", "OPTIONS")
		superAdmin.HandleFunc("/organizations", superAdminHandler.GetAllOrganizations).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/organizations/{id}", superAdminHandler.GetOrganizationDetails).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/organizations/{id}", superAdminHandler.UpdateOrganization).Methods("PUT", "OPTIONS")
		superAdmin.HandleFunc("/organizations/{id}/deactivate", superAdminHandler.DeactivateOrganization).Methods("POST", "OPTIONS")
		superAdmin.HandleFunc("/organizations/{id}/metrics", superAdminHandler.GetOrganizationMetrics).Methods("GET", "OPTIONS")
		
		// Admin management routes
		superAdmin.HandleFunc("/admins", superAdminHandler.GetAllAdmins).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/admins/{id}", superAdminHandler.GetAdminDetails).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/admins/{id}/suspend", superAdminHandler.SuspendAdmin).Methods("POST", "OPTIONS")
		superAdmin.HandleFunc("/admins/{id}/unsuspend", superAdminHandler.UnsuspendAdmin).Methods("POST", "OPTIONS")
		superAdmin.HandleFunc("/admins/{id}", superAdminHandler.DeleteAdmin).Methods("DELETE", "OPTIONS")
		superAdmin.HandleFunc("/admins/invite-bulk", superAdminHandler.BulkInviteAdmins).Methods("POST", "OPTIONS")
		
		// System analytics and health routes
		superAdmin.HandleFunc("/system/metrics", superAdminHandler.GetSystemMetrics).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/system/health", superAdminHandler.GetSystemHealth).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/system/usage-reports", superAdminHandler.GetUsageReports).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/system/export", superAdminHandler.ExportData).Methods("GET", "OPTIONS")
		
		// Admin invitation routes (kept for backward compatibility)
		superAdmin.HandleFunc("/invitations", adminHandler.CreateAdminInvitation).Methods("POST", "OPTIONS")
		superAdmin.HandleFunc("/invitations/{id}", adminHandler.GetInvitation).Methods("GET", "OPTIONS")
		superAdmin.HandleFunc("/invitations/{id}/resend", adminHandler.ResendInvitation).Methods("PUT", "OPTIONS")
		superAdmin.HandleFunc("/invitations/{id}/cancel", adminHandler.CancelInvitation).Methods("DELETE", "OPTIONS")
		superAdmin.HandleFunc("/clients/{clientId}/invitations", adminHandler.GetClientInvitations).Methods("GET", "OPTIONS")
		
		// Public admin invitation routes
		public.HandleFunc("/admin/invitations/validate", adminHandler.ValidateInvitationToken).Methods("GET", "OPTIONS")
		public.HandleFunc("/admin/invitations/{token}", adminHandler.GetInvitationByToken).Methods("GET", "OPTIONS")
		public.HandleFunc("/admin/invitations/complete", adminHandler.CompleteAdminInvitation).Methods("POST", "OPTIONS")

		// Meeting routes
		protected.HandleFunc("/meetings", meetingHandler.ListMeetings).Methods("GET", "OPTIONS")
		protected.HandleFunc("/meetings", meetingHandler.CreateMeeting).Methods("POST", "OPTIONS")
		protected.HandleFunc("/meetings/{id}", meetingHandler.GetMeeting).Methods("GET", "OPTIONS")
		protected.HandleFunc("/meetings/{id}", meetingHandler.UpdateMeeting).Methods("PUT", "OPTIONS")
		protected.HandleFunc("/meetings/{id}/start", meetingHandler.StartMeeting).Methods("POST", "OPTIONS")
		protected.HandleFunc("/meetings/{id}/end", meetingHandler.EndMeeting).Methods("POST", "OPTIONS")

		// Chat routes
		protected.HandleFunc("/meetings/{id}/chat", chatHandler.GetMessages).Methods("GET", "OPTIONS")
		protected.HandleFunc("/meetings/{id}/chat", chatHandler.SendMessage).Methods("POST", "OPTIONS")

		// Invitation routes (protected)
		protected.HandleFunc("/invitations", invitationHandler.CreateInvitation).Methods("POST", "OPTIONS")
		protected.HandleFunc("/invitations/accept", invitationHandler.AcceptInvitation).Methods("POST", "OPTIONS")
	}

	// Serve static files for uploads
	s.router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))
}

// healthCheck provides a health check endpoint
func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	status := map[string]any{
		"status":      "ok",
		"environment": s.config.Server.Environment,
		"services":    "enterprise backend services initialized",
		"features": map[string]bool{
			"auth":           s.services != nil,
			"chat":           s.config.Features.Chat,
			"recording":      s.config.Features.Recording,
			"screen_sharing": s.config.Features.ScreenSharing,
			"waiting_room":   s.config.Features.WaitingRoom,
		},
	}

	json.NewEncoder(w).Encode(status)
}
