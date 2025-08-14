package handlers

import (
	"encoding/json"
	"net/http"

	"video-conference-backend/internal/services"
)

type userInvitationHandler struct {
	userInvitationSvc services.UserInvitationService
}

func UserInvitationHandler(userInvitationSvc services.UserInvitationService) *userInvitationHandler {
	return &userInvitationHandler{
		userInvitationSvc: userInvitationSvc,
	}
}

// ValidateUserInvitation validates a user invitation token
func (h *userInvitationHandler) ValidateUserInvitation(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	claims, err := h.userInvitationSvc.ValidateUserInvitationToken(r.Context(), token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"message":       "User invitation token is valid",
		"email":         claims.Email,
		"invitation_id": claims.InvitationID,
		"client_id":     claims.ClientID,
	})
}

// CompleteUserRegistrationRequest represents the request to complete user registration
type CompleteUserRegistrationRequest struct {
	Token    string `json:"token" validate:"required"`
	Password string `json:"password" validate:"required,min=8"`
}

// CompleteUserRegistration completes the user registration process
func (h *userInvitationHandler) CompleteUserRegistration(w http.ResponseWriter, r *http.Request) {
	var req CompleteUserRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.userInvitationSvc.CompleteUserRegistration(r.Context(), req.Token, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User registration completed successfully",
		"user":    user,
	})
}
