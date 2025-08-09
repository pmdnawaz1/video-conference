package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

type adminHandler struct {
	adminSvc services.Admin
	userSvc  services.UserService
}

func AdminHandler(adminSvc services.Admin, userSvc services.UserService) *adminHandler {
	return &adminHandler{
		adminSvc: adminSvc,
		userSvc:  userSvc,
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

// ResendInvitation resends an admin invitation
func (h *adminHandler) ResendInvitation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid invitation ID", http.StatusBadRequest)
		return
	}

	err = h.adminSvc.ResendInvitation(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Invitation resent successfully",
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