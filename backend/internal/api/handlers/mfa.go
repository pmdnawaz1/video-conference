package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

type MFAHandler struct {
	authSvc services.AuthService
}

func NewMFAHandler(authSvc services.AuthService) *MFAHandler {
	return &MFAHandler{
		authSvc: authSvc,
	}
}

// EnableMFARequest represents the request to enable MFA
type EnableMFARequest struct {
	UserID int `json:"user_id"`
}

// VerifyMFARequest represents the request to verify MFA code
type VerifyMFARequest struct {
	Code          string `json:"code"`
	UseBackupCode bool   `json:"use_backup_code,omitempty"`
}

// DisableMFARequest represents the request to disable MFA
type DisableMFARequest struct {
	TOTPCode string `json:"totp_code"`
}

// EnableMFA enables multi-factor authentication for a user
func (h *MFAHandler) EnableMFA(w http.ResponseWriter, r *http.Request) {
	var req EnableMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user ID from context (set by auth middleware)
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		userID = req.UserID // fallback for testing
	}

	mfaSetup, err := h.authSvc.EnableMFA(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    mfaSetup,
	})
}

// DisableMFA disables multi-factor authentication for a user
func (h *MFAHandler) DisableMFA(w http.ResponseWriter, r *http.Request) {
	var req DisableMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.authSvc.DisableMFA(r.Context(), userID, req.TOTPCode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "MFA has been disabled successfully",
	})
}

// VerifyMFA verifies an MFA code
func (h *MFAHandler) VerifyMFA(w http.ResponseWriter, r *http.Request) {
	var req VerifyMFARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.authSvc.VerifyMFA(r.Context(), userID, req.Code, req.UseBackupCode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "MFA verification successful",
	})
}

// RegenerateBackupCodes generates new backup codes for MFA
func (h *MFAHandler) RegenerateBackupCodes(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	backupCodes, err := h.authSvc.RegenerateMFABackupCodes(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"backup_codes": backupCodes,
		"message":      "New backup codes generated successfully",
	})
}

// GetUserSessions returns active sessions for a user
func (h *MFAHandler) GetUserSessions(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sessions, err := h.authSvc.GetUserSessions(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"sessions": sessions,
	})
}

// RevokeSession revokes a specific user session
func (h *MFAHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]
	
	if sessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	userID := getUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.authSvc.RevokeSession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Session revoked successfully",
	})
}

// ValidateSession validates a session ID
func (h *MFAHandler) ValidateSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]
	
	if sessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	session, err := h.authSvc.ValidateSession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"session": session,
	})
}

// Helper function to get user ID from context
func getUserIDFromContext(ctx context.Context) int {
	// This would be set by the auth middleware
	// For now, return 0 as placeholder
	return 0
}