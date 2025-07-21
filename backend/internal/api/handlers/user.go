package handlers

import (
	"video-conference-backend/internal/utils"
	"encoding/json"
	"net/http"

	"video-conference-backend/internal/models"
	"video-conference-backend/internal/services"
)

// UserHandler handles user endpoints
type UserHandler struct {
	userService services.UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService services.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetProfile returns the current user's profile
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	user, err := h.userService.GetUserByID(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "User not found")
		return
	}

	// Return user profile (without password)
	profile := &models.UserProfile{
		ID:             user.ID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Role:           user.Role,
		ProfilePicture: user.ProfilePicture,
		ClientID:       user.ClientID,
	}

	utils.WriteSuccess(w, profile)
}

// UpdateProfile updates the current user's profile
func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	var updateReq struct {
		FirstName      string  `json:"first_name"`
		LastName       string  `json:"last_name"`
		ProfilePicture *string `json:"profile_picture"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get current user
	user, err := h.userService.GetUserByID(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "User not found")
		return
	}

	// Update fields
	if updateReq.FirstName != "" {
		user.FirstName = updateReq.FirstName
	}
	if updateReq.LastName != "" {
		user.LastName = updateReq.LastName
	}
	if updateReq.ProfilePicture != nil {
		user.ProfilePicture = updateReq.ProfilePicture
	}

	// Save updates
	err = h.userService.UpdateUser(r.Context(), user)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	// Return updated profile
	profile := &models.UserProfile{
		ID:             user.ID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Role:           user.Role,
		ProfilePicture: user.ProfilePicture,
		ClientID:       user.ClientID,
	}

	utils.WriteSuccess(w, profile)
}

// ChangePassword changes the current user's password
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		utils.WriteError(w, http.StatusBadRequest, "Old password and new password are required")
		return
	}

	err := h.userService.ChangeUserPassword(r.Context(), userID, req.OldPassword, req.NewPassword)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to change password: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]string{"message": "Password changed successfully"})
}

// ListUsers lists users (admin only)
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	clientID := utils.GetClientIDFromContext(r)
	if clientID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "Client ID not found")
		return
	}

	// Parse query parameters
	limit := 50 // default
	offset := 0 // default

	users, err := h.userService.ListUsersByClient(r.Context(), clientID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to list users")
		return
	}

	// Convert to profiles (without passwords)
	var profiles []*models.UserProfile
	for _, user := range users {
		profile := &models.UserProfile{
			ID:             user.ID,
			Email:          user.Email,
			FirstName:      user.FirstName,
			LastName:       user.LastName,
			Role:           user.Role,
			ProfilePicture: user.ProfilePicture,
			ClientID:       user.ClientID,
		}
		profiles = append(profiles, profile)
	}

	utils.WriteSuccess(w, profiles)
}

// GetUser gets a specific user by ID (admin only)
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	// Implementation would extract user ID from URL and return user details
	utils.WriteError(w, http.StatusNotImplemented, "Not implemented yet")
}

// UpdateUserRole updates a user's role (super admin only)
func (h *UserHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	// Implementation would extract user ID from URL and update role
	utils.WriteError(w, http.StatusNotImplemented, "Not implemented yet")
}

// DeactivateUser deactivates a user (admin only)
func (h *UserHandler) DeactivateUser(w http.ResponseWriter, r *http.Request) {
	// Implementation would extract user ID from URL and deactivate user
	utils.WriteError(w, http.StatusNotImplemented, "Not implemented yet")
}