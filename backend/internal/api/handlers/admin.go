package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

type adminHandler struct {
	adminSvc services.Admin
	userSvc  services.UserService
	userInvitationSvc services.UserInvitationService
}

func AdminHandler(adminSvc services.Admin, userSvc services.UserService, userInvitationSvc services.UserInvitationService) *adminHandler {
	return &adminHandler{
		adminSvc: adminSvc,
		userSvc:  userSvc,
		userInvitationSvc: userInvitationSvc,
	}
}

// CreateAdminInvitation creates a new admin invitation
func (h *adminHandler) CreateAdminInvitation(w http.ResponseWriter, r *http.Request) {
	var req services.AdminInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Email == "" || req.FirstName == "" || req.LastName == "" || req.ClientID == 0 {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	invitation, err := h.adminSvc.CreateAdminInvitation(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "Admin invitation created successfully",
		"invitation": invitation,
	})
}

// CreateUserInvitation creates a new user invitation
func (h *adminHandler) CreateUserInvitation(w http.ResponseWriter, r *http.Request) {
	var req services.CreateUserInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Email == "" || req.FirstName == "" || req.LastName == "" || req.ClientID == 0 {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Get invitedBy user ID from context (assuming it's set by middleware)
	invitedByUserID, ok := r.Context().Value("user_id").(int)
	if !ok || invitedByUserID == 0 {
		http.Error(w, "Unauthorized: User ID not found in context", http.StatusUnauthorized)
		return
	}

	// req is already the correct type, no conversion needed

	invitation, err := h.userInvitationSvc.CreateUserInvitation(r.Context(), invitedByUserID, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "User invitation created successfully",
		"invitation": invitation,
	})
}

// ValidateInvitationToken validates an invitation token
func (h *adminHandler) ValidateInvitationToken(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	invitation, err := h.adminSvc.ValidateInvitationToken(r.Context(), token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Don't return sensitive information like the full token
	response := map[string]interface{}{
		"valid":      true,
		"email":      invitation.Email,
		"first_name": invitation.FirstName,
		"last_name":  invitation.LastName,
		"expires_at": invitation.ExpiresAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetInvitationByToken gets invitation details by token
func (h *adminHandler) GetInvitationByToken(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]
	
	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	invitation, err := h.adminSvc.ValidateInvitationToken(r.Context(), token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Return safe invitation details
	response := map[string]interface{}{
		"email":      invitation.Email,
		"first_name": invitation.FirstName,
		"last_name":  invitation.LastName,
		"expires_at": invitation.ExpiresAt,
		"status":     invitation.Status,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"invitation": response,
	})
}

// CompleteInvitationRequest represents the invitation completion request
type CompleteInvitationRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// CompleteAdminInvitation completes an admin invitation by creating the user account
func (h *adminHandler) CompleteAdminInvitation(w http.ResponseWriter, r *http.Request) {
	var req CompleteInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Token == "" || req.Password == "" {
		http.Error(w, "Token and password are required", http.StatusBadRequest)
		return
	}

	// Validate password strength
	if len(req.Password) < 8 {
		http.Error(w, "Password must be at least 8 characters long", http.StatusBadRequest)
		return
	}

	user, err := h.adminSvc.CompleteAdminInvitation(r.Context(), req.Token, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Return user profile without sensitive data
	profile := map[string]interface{}{
		"id":         user.ID,
		"email":      user.Email,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"role":       user.Role,
		"client_id":  user.ClientID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Admin account created successfully",
		"user":    profile,
	})
}

// ResendInvitation resends an admin invitation with rate limiting and enhanced error handling
func (h *adminHandler) ResendInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	// Validate invitation ID
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid invitation ID format", http.StatusBadRequest)
		return
	}

	if id <= 0 {
		http.Error(w, "Invalid invitation ID value", http.StatusBadRequest)
		return
	}

	// Get the invitation first to check rate limiting and status
	invitation, err := h.adminSvc.GetInvitationByID(r.Context(), id)
	if err != nil {
		// Check if invitation exists
		if err.Error() == "invitation not found" {
			http.Error(w, "Invitation not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to retrieve invitation", http.StatusInternalServerError)
		return
	}

	// Rate limiting check - max 3 resends per 24 hours
	if invitation.ReminderSentCount >= 3 {
		http.Error(w, "Maximum resend limit reached (3 per 24 hours)", http.StatusTooManyRequests)
		return
	}

	// Check if invitation is in valid state for resending
	if invitation.Status != "pending" {
		statusMsg := map[string]string{
			"accepted":  "Invitation has already been accepted",
			"expired":   "Invitation has expired",
			"cancelled": "Invitation has been cancelled",
		}
		msg, exists := statusMsg[invitation.Status]
		if !exists {
			msg = "Invitation cannot be resent in current state"
		}
		http.Error(w, msg, http.StatusConflict)
		return
	}

	// Check if invitation has expired
	if invitation.ExpiresAt.Before(time.Now()) {
		http.Error(w, "Invitation has expired and cannot be resent", http.StatusConflict)
		return
	}

	// Additional rate limiting: Check if last reminder was sent less than 1 hour ago
	if invitation.LastReminderSent != nil && invitation.LastReminderSent.After(time.Now().Add(-1*time.Hour)) {
		http.Error(w, "Please wait at least 1 hour between resend attempts", http.StatusTooManyRequests)
		return
	}

	// Attempt to resend the invitation
	err = h.adminSvc.ResendInvitation(r.Context(), id)
	if err != nil {
		// Log detailed error information
		log.Printf("Failed to resend invitation %d: %v", id, err)
		
		// Handle specific error cases
		if strings.Contains(err.Error(), "email") {
			http.Error(w, "Failed to send invitation email. Please try again later.", http.StatusServiceUnavailable)
			return
		}
		
		// Generic error response
		http.Error(w, "Failed to resend invitation", http.StatusInternalServerError)
		return
	}

	// Log successful resend
	log.Printf("Invitation %d successfully resent to %s (attempt #%d)", 
		id, invitation.Email, invitation.ReminderSentCount+1)

	// Return success response with additional details
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Invitation resent successfully",
		"data": map[string]interface{}{
			"invitation_id":      invitation.ID,
			"email":             invitation.Email,
			"resend_count":      invitation.ReminderSentCount + 1,
			"remaining_resends": 3 - (invitation.ReminderSentCount + 1),
			"expires_at":        invitation.ExpiresAt,
		},
	})
}

// CancelInvitation cancels an admin invitation
func (h *adminHandler) CancelInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid invitation ID", http.StatusBadRequest)
		return
	}

	err = h.adminSvc.CancelInvitation(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Invitation cancelled successfully",
	})
}

// GetClientInvitations gets all invitations for a client
func (h *adminHandler) GetClientInvitations(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientIDStr := vars["clientId"]
	
	clientID, err := strconv.Atoi(clientIDStr)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	invitations, err := h.adminSvc.GetInvitationsByClient(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"invitations": invitations,
	})
}

// GetInvitation gets a specific invitation by ID
func (h *adminHandler) GetInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid invitation ID", http.StatusBadRequest)
		return
	}

	invitation, err := h.adminSvc.GetInvitationByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"invitation": invitation,
	})
}