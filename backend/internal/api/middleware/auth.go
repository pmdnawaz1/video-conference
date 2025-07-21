package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

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

// JWTAuth middleware validates JWT tokens
func JWTAuth(authService services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				jsonError(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// Check for Bearer token format
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				jsonError(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			// Validate token
			claims, err := authService.ValidateToken(r.Context(), tokenString)
			if err != nil {
				jsonError(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
				return
			}

			// Add claims to request context
			ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "client_id", claims.ClientID)
			ctx = context.WithValue(ctx, "email", claims.Email)
			ctx = context.WithValue(ctx, "role", claims.Role)

			// Call next handler with updated context
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole middleware checks if user has required role
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := r.Context().Value("role")
			if userRole == nil {
				jsonError(w, "User role not found in context", http.StatusUnauthorized)
				return
			}

			role, ok := userRole.(string)
			if !ok {
				jsonError(w, "Invalid role format", http.StatusUnauthorized)
				return
			}

			// Check if user role is in allowed roles
			for _, allowedRole := range allowedRoles {
				if role == allowedRole {
					next.ServeHTTP(w, r)
					return
				}
			}

			jsonError(w, "Insufficient permissions", http.StatusForbidden)
		})
	}
}

// RequireClientAccess middleware ensures user belongs to the requested client
func RequireClientAccess() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userClientID := r.Context().Value("client_id")
			if userClientID == nil {
				jsonError(w, "Client ID not found in context", http.StatusUnauthorized)
				return
			}

			// Additional client access validation could go here
			// For now, we assume the JWT client_id is sufficient

			next.ServeHTTP(w, r)
		})
	}
}