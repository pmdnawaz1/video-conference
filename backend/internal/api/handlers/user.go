package handlers

import (
	"video-conference-backend/internal/utils"
	"encoding/json"
	"net/http"

	"video-conference-backend/prisma/db"
	"video-conference-backend/internal/services"
)

// UserHandler handles user endpoints
type UserHandler struct {
	userService services.UserService
	userAnalyticsService services.UserAnalyticsService
	userPreferenceService services.UserPreferenceService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService services.UserService, userAnalyticsService services.UserAnalyticsService, userPreferenceService services.UserPreferenceService) *UserHandler {
	return &UserHandler{
		userService: userService,
		userAnalyticsService: userAnalyticsService,
		userPreferenceService: userPreferenceService,
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
	profile := &db.UserProfile{
		ID:             user.ID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Role:           user.Role,
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
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
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

	// Save updates
	err = h.userService.UpdateUser(r.Context(), user)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	// Return updated profile
	profile := &db.UserProfile{
		ID:             user.ID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Role:           user.Role,
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

	var req db.ChangePasswordRequest
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

// GetUserAnalytics returns the current user's analytics data
func (h *UserHandler) GetUserAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	analytics, err := h.userAnalyticsService.GetUserAnalytics(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get user analytics")
		return
	}

	utils.WriteSuccess(w, analytics)
}

// GetUserPreferences returns the current user's preferences
func (h *UserHandler) GetUserPreferences(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	preferences, err := h.userPreferenceService.GetUserPreferences(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get user preferences")
		return
	}

	utils.WriteSuccess(w, preferences)
}

// UpdateUserPreferences updates the current user's preferences
func (h *UserHandler) UpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	var req db.UserPreference
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updatedPreferences, err := h.userPreferenceService.UpdateUserPreferences(r.Context(), userID, &req)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update user preferences")
		return
	}

	utils.WriteSuccess(w, updatedPreferences)
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
	var profiles []*db.UserProfile
	for _, user := range users {
		profile := &db.UserProfile{
			ID:             user.ID,
			Email:          user.Email,
			FirstName:      user.FirstName,
			LastName:       user.LastName,
			Role:           user.Role,
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