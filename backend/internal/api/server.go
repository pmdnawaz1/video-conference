package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"video-conference-backend/internal/api/handlers"
	"video-conference-backend/internal/api/middleware"
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/services"
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
	s.router.Use(middleware.CORS(s.config.Server.CORSOrigins))
	s.router.Use(middleware.Recovery())
	
	// WebSocket route with simple handler (compatible with working frontend)
	s.router.HandleFunc("/ws", handlers.HandleSimpleWebSocket).Methods("GET")

	// API v1 routes with logging middleware
	api := s.router.PathPrefix("/api/v1").Subrouter()
	api.Use(middleware.Logging())

	// Health check
	s.router.HandleFunc("/health", s.healthCheck).Methods("GET")
	s.router.HandleFunc("/api/health", s.healthCheck).Methods("GET")

	// Initialize handlers
	if s.services != nil {
		authHandler := handlers.NewAuthHandler(s.services.Auth, s.services.User)
		userHandler := handlers.NewUserHandler(s.services.User)
		clientHandler := handlers.NewClientHandler(s.services.Client)
		meetingHandler := handlers.NewMeetingHandler(s.services.Meeting)
		chatHandler := handlers.NewChatHandler(s.services.Chat)
		invitationHandler := handlers.NewInvitationHandler(s.services.Invitation, s.services.User, s.services.Email, s.services.Calendar)
		// Public routes (no authentication required)
		public := api.PathPrefix("/public").Subrouter()
		public.HandleFunc("/auth/login", authHandler.Login).Methods("POST", "OPTIONS")
		public.HandleFunc("/auth/refresh", authHandler.RefreshToken).Methods("POST", "OPTIONS")
		public.HandleFunc("/auth/register", authHandler.Register).Methods("POST", "OPTIONS")
		
		// Public invitation routes
		public.HandleFunc("/invitations/validate", invitationHandler.ValidateInvitation).Methods("GET", "OPTIONS")
		public.HandleFunc("/invitations/{token}", invitationHandler.GetInvitationByToken).Methods("GET", "OPTIONS")

		// Protected routes (authentication required)
		protected := api.PathPrefix("").Subrouter()
		protected.Use(middleware.JWTAuth(s.services.Auth))

		// User routes
		protected.HandleFunc("/users/me", userHandler.GetProfile).Methods("GET", "OPTIONS")
		protected.HandleFunc("/users/me", userHandler.UpdateProfile).Methods("PUT", "OPTIONS")
		protected.HandleFunc("/users/me/password", userHandler.ChangePassword).Methods("PUT", "OPTIONS")

		// Client routes (admin only)
		admin := protected.PathPrefix("/admin").Subrouter()
		admin.Use(middleware.RequireRole("admin", "super_admin"))
		admin.HandleFunc("/clients", clientHandler.ListClients).Methods("GET", "OPTIONS")
		admin.HandleFunc("/clients", clientHandler.CreateClient).Methods("POST", "OPTIONS")
		admin.HandleFunc("/clients/{id}", clientHandler.GetClient).Methods("GET", "OPTIONS")
		admin.HandleFunc("/clients/{id}", clientHandler.UpdateClient).Methods("PUT", "OPTIONS")

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
	
	status := map[string]interface{}{
		"status":      "ok",
		"environment": s.config.Server.Environment,
		"services":    "enterprise backend services initialized",
		"features": map[string]bool{
			"auth":       s.services != nil,
			"chat":       s.config.Features.Chat,
			"recording":  s.config.Features.Recording,
			"screen_sharing": s.config.Features.ScreenSharing,
			"waiting_room": s.config.Features.WaitingRoom,
		},
	}

	json.NewEncoder(w).Encode(status)
}

