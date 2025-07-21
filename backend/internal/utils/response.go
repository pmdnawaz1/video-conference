package utils

import (
	"encoding/json"
	"net/http"
)

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// WriteJSON writes a JSON response
func WriteJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// WriteSuccess writes a successful JSON response
func WriteSuccess(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
	})
}

// WriteError writes an error JSON response
func WriteError(w http.ResponseWriter, statusCode int, message string) {
	WriteJSON(w, statusCode, APIResponse{
		Success: false,
		Error:   message,
	})
}

// GetClientIDFromContext extracts client ID from JWT context
func GetClientIDFromContext(r *http.Request) int {
	if clientID := r.Context().Value("client_id"); clientID != nil {
		if id, ok := clientID.(int); ok {
			return id
		}
	}
	return 0
}

// GetUserIDFromContext extracts user ID from JWT context
func GetUserIDFromContext(r *http.Request) int {
	if userID := r.Context().Value("user_id"); userID != nil {
		if id, ok := userID.(int); ok {
			return id
		}
	}
	return 0
}

// GetUserRoleFromContext extracts user role from JWT context
func GetUserRoleFromContext(r *http.Request) string {
	if role := r.Context().Value("role"); role != nil {
		if r, ok := role.(string); ok {
			return r
		}
	}
	return ""
}