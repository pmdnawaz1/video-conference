package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"video-conference-backend/internal/services"
)

// jsonError sends a JSON error response
func jsonError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	errorResponse := map[string]interface{}{
		"success": false,
		"error":   message,
	}
	
	json.NewEncoder(w).Encode(errorResponse)
}

// InvitationHandler handles invitation-related HTTP requests
type InvitationHandler struct {
	invitationService *services.InvitationService
	userService       services.UserService
	emailService      *services.EmailService
	calendarService   *services.CalendarService
}

// NewInvitationHandler creates a new invitation handler
func NewInvitationHandler(invitationService *services.InvitationService, userService services.UserService, emailService *services.EmailService, calendarService *services.CalendarService) *InvitationHandler {
	return &InvitationHandler{
		invitationService: invitationService,
		userService:       userService,
		emailService:      emailService,
		calendarService:   calendarService,
	}
}

// CreateInvitation creates meeting invitations
func (h *InvitationHandler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	var req services.InvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user ID from context (set by JWT middleware)
	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		jsonError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Create invitation
	invitation, token, err := h.invitationService.CreateInvitation(userID, req)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get inviter details for email
	inviter, err := h.userService.GetUserByID(context.Background(), userID)
	if err != nil {
		jsonError(w, "Failed to get inviter details", http.StatusInternalServerError)
		return
	}

	// Generate invitation link
	baseURL := r.Header.Get("Origin")
	if baseURL == "" {
		baseURL = "http://localhost:3000" // Default frontend URL
	}
	invitationLink := h.invitationService.GenerateInvitationLink(baseURL, token)

	// Get meeting details for email content
	meeting, err := h.invitationService.GetMeetingByInvitation(token)
	if err != nil {
		jsonError(w, "Failed to get meeting details", http.StatusInternalServerError)
		return
	}

	// Generate email content
	inviterName := inviter.FirstName + " " + inviter.LastName
	emailContent := h.invitationService.GenerateEmailContent(meeting, inviterName, invitationLink)

	// Send invitation emails
	err = h.emailService.SendInvitationEmail(req.Emails, emailContent)
	if err != nil {
		log.Printf("Failed to send invitation emails: %v", err)
		// Don't fail the request, just log the error
	}

	// Create calendar events
	calendarIntegration := h.calendarService.CreateCalendarIntegration(meeting, inviter.Email, req.Emails, invitationLink)

	response := map[string]interface{}{
		"success":              true,
		"invitation":           invitation,
		"invitation_link":      invitationLink,
		"token":                token,
		"email_content":        emailContent,
		"email_sent":           err == nil,
		"calendar_integration": calendarIntegration,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ValidateInvitation validates an invitation token
func (h *InvitationHandler) ValidateInvitation(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		jsonError(w, "Missing invitation token", http.StatusBadRequest)
		return
	}

	claims, err := h.invitationService.ValidateInvitationToken(token)
	if err != nil {
		jsonError(w, "Invalid invitation token", http.StatusUnauthorized)
		return
	}

	// Get meeting details
	meeting, err := h.invitationService.GetMeetingByInvitation(token)
	if err != nil {
		jsonError(w, "Meeting not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"valid":   true,
		"meeting": meeting,
		"claims":  claims,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// AcceptInvitation accepts an invitation
func (h *InvitationHandler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.invitationService.AcceptInvitation(request.Token)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get meeting details for response
	meeting, err := h.invitationService.GetMeetingByInvitation(request.Token)
	if err != nil {
		jsonError(w, "Failed to get meeting details", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"message": "Invitation accepted successfully",
		"meeting": meeting,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetInvitationByToken retrieves invitation details by token
func (h *InvitationHandler) GetInvitationByToken(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]

	if token == "" {
		jsonError(w, "Missing invitation token", http.StatusBadRequest)
		return
	}

	// Validate token and get meeting
	meeting, err := h.invitationService.GetMeetingByInvitation(token)
	if err != nil {
		jsonError(w, "Invalid invitation or meeting not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"meeting": meeting,
		"token":   token,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}