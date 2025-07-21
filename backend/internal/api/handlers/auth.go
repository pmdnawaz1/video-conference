package handlers

import (
	"encoding/json"
	"net/http"

	"video-conference-backend/internal/models"
	"video-conference-backend/internal/services"
	"video-conference-backend/internal/utils"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService services.AuthService
	userService services.UserService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService services.AuthService, userService services.UserService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		userService: userService,
	}
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	// Handle OPTIONS request for CORS
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" {
		utils.WriteError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	// Authenticate user
	authResponse, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	utils.WriteSuccess(w, authResponse)
}

// Register handles user registration
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	// Handle OPTIONS request for CORS
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		utils.WriteError(w, http.StatusBadRequest, "All fields are required")
		return
	}

	// Default role to user if not specified
	if req.Role == "" {
		req.Role = "user"
	}

	// Default client ID to 1 if not specified (for demo purposes)
	if req.ClientID == 0 {
		req.ClientID = 1
	}

	// Register user
	user, err := h.authService.RegisterUser(r.Context(), &req)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Registration failed: "+err.Error())
		return
	}

	// Return user profile (without password)
	profile := &models.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Role:      user.Role,
		ClientID:  user.ClientID,
	}

	utils.WriteSuccess(w, profile)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req models.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		utils.WriteError(w, http.StatusBadRequest, "Refresh token is required")
		return
	}

	// Refresh token
	authResponse, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	utils.WriteSuccess(w, authResponse)
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req models.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	// Logout user
	err := h.authService.Logout(r.Context(), userID, req.RefreshToken)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Logout failed")
		return
	}

	utils.WriteSuccess(w, map[string]string{"message": "Logged out successfully"})
}

// ResetPassword handles password reset request
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" {
		utils.WriteError(w, http.StatusBadRequest, "Email is required")
		return
	}

	// Initiate password reset
	err := h.authService.ResetPassword(r.Context(), req.Email)
	if err != nil {
		// Don't reveal if email exists or not for security
		utils.WriteSuccess(w, map[string]string{"message": "If the email exists, a reset link has been sent"})
		return
	}

	utils.WriteSuccess(w, map[string]string{"message": "Password reset email sent"})
}

// ValidateToken handles token validation (for debugging)
func (h *AuthHandler) ValidateToken(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	clientID := utils.GetClientIDFromContext(r)
	role := utils.GetUserRoleFromContext(r)

	tokenInfo := map[string]interface{}{
		"valid":     true,
		"user_id":   userID,
		"client_id": clientID,
		"role":      role,
		"email":     r.Context().Value("email"),
	}

	utils.WriteSuccess(w, tokenInfo)
}