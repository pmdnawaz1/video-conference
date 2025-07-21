package services

import (
	"context"
	"fmt"
	"time"
	"video-conference-backend/internal/config"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
)

type AuthService interface {
	Login(ctx context.Context, email, password string) (*models.AuthResponse, error)
	RefreshToken(ctx context.Context, refreshToken string) (*models.AuthResponse, error)
	ValidateToken(ctx context.Context, tokenString string) (*models.JWTClaims, error)
	Logout(ctx context.Context, userID int, refreshToken string) error
	RegisterUser(ctx context.Context, req *models.RegisterRequest) (*models.User, error)
	ResetPassword(ctx context.Context, email string) error
	ChangePassword(ctx context.Context, userID int, req *models.ChangePasswordRequest) error
}

type authService struct {
	db      *database.DB
	userSvc UserService
	config  *config.AuthConfig
}

func NewAuthService(db *database.DB, cfg *config.AuthConfig) AuthService {
	return &authService{
		db:      db,
		userSvc: NewUserService(db),
		config:  cfg,
	}
}

func (s *authService) Login(ctx context.Context, email, password string) (*models.AuthResponse, error) {
	// Verify user credentials
	user, err := s.userSvc.VerifyUserPassword(ctx, email, password)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	// Check if user is active
	if user.Status != "active" {
		return nil, fmt.Errorf("user account is not active")
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in database
	err = s.storeRefreshToken(ctx, user.ID, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(s.config.AccessTokenExpiry.Seconds()),
		User: &models.UserProfile{
			ID:             user.ID,
			Email:          user.Email,
			FirstName:      user.FirstName,
			LastName:       user.LastName,
			Role:           user.Role,
			ProfilePicture: user.ProfilePicture,
			ClientID:       user.ClientID,
		},
	}, nil
}

func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*models.AuthResponse, error) {
	// Validate refresh token
	claims, err := s.validateRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Check if refresh token exists in database
	exists, err := s.isRefreshTokenValid(ctx, claims.UserID, refreshToken)
	if err != nil || !exists {
		return nil, fmt.Errorf("refresh token not found or expired")
	}

	// Get user
	user, err := s.userSvc.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate new tokens
	newAccessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	newRefreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Update refresh token in database
	err = s.updateRefreshToken(ctx, claims.UserID, refreshToken, newRefreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to update refresh token: %w", err)
	}

	return &models.AuthResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(s.config.AccessTokenExpiry.Seconds()),
		User: &models.UserProfile{
			ID:             user.ID,
			Email:          user.Email,
			FirstName:      user.FirstName,
			LastName:       user.LastName,
			Role:           user.Role,
			ProfilePicture: user.ProfilePicture,
			ClientID:       user.ClientID,
		},
	}, nil
}

func (s *authService) ValidateToken(ctx context.Context, tokenString string) (*models.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*models.JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func (s *authService) Logout(ctx context.Context, userID int, refreshToken string) error {
	query := `DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2`
	_, err := s.db.ExecContext(ctx, query, userID, refreshToken)
	if err != nil {
		return fmt.Errorf("failed to logout: %w", err)
	}
	return nil
}

func (s *authService) RegisterUser(ctx context.Context, req *models.RegisterRequest) (*models.User, error) {
	user := &models.User{
		ClientID:  req.ClientID,
		Email:     req.Email,
		Password:  req.Password,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      req.Role,
		Status:    "active", // Set to active for immediate use
	}

	err := s.userSvc.CreateUser(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to register user: %w", err)
	}

	return user, nil
}

func (s *authService) ResetPassword(ctx context.Context, email string) error {
	user, err := s.userSvc.GetUserByEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Generate reset token
	resetToken, err := s.generatePasswordResetToken(user)
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	// Store reset token with expiry
	query := `
		INSERT INTO password_reset_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			token = EXCLUDED.token,
			expires_at = EXCLUDED.expires_at,
			created_at = CURRENT_TIMESTAMP`

	expiresAt := time.Now().Add(s.config.PasswordResetExpiry)
	_, err = s.db.ExecContext(ctx, query, user.ID, resetToken, expiresAt)
	if err != nil {
		return fmt.Errorf("failed to store reset token: %w", err)
	}

	// TODO: Send email with reset token
	// This would integrate with the email service

	return nil
}

func (s *authService) ChangePassword(ctx context.Context, userID int, req *models.ChangePasswordRequest) error {
	return s.userSvc.ChangeUserPassword(ctx, userID, req.OldPassword, req.NewPassword)
}

// Helper methods

func (s *authService) generateAccessToken(user *models.User) (string, error) {
	claims := &models.JWTClaims{
		UserID:   user.ID,
		ClientID: user.ClientID,
		Email:    user.Email,
		Role:     user.Role,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.AccessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "video-conference-platform",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *authService) generateRefreshToken(user *models.User) (string, error) {
	claims := &models.JWTClaims{
		UserID:   user.ID,
		ClientID: user.ClientID,
		Email:    user.Email,
		Role:     user.Role,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.RefreshTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "video-conference-platform",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *authService) generatePasswordResetToken(user *models.User) (string, error) {
	claims := &models.JWTClaims{
		UserID:   user.ID,
		Email:    user.Email,
		TokenType: "password_reset",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.config.PasswordResetExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "video-conference-platform",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *authService) validateRefreshToken(tokenString string) (*models.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*models.JWTClaims); ok && token.Valid && claims.TokenType == "refresh" {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid refresh token")
}

func (s *authService) storeRefreshToken(ctx context.Context, userID int, token string) error {
	query := `
		INSERT INTO refresh_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)`

	expiresAt := time.Now().Add(s.config.RefreshTokenExpiry)
	_, err := s.db.ExecContext(ctx, query, userID, token, expiresAt)
	return err
}

func (s *authService) isRefreshTokenValid(ctx context.Context, userID int, token string) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM refresh_tokens 
		WHERE user_id = $1 AND token = $2 AND expires_at > CURRENT_TIMESTAMP`

	err := s.db.GetContext(ctx, &count, query, userID, token)
	return count > 0, err
}

func (s *authService) updateRefreshToken(ctx context.Context, userID int, oldToken, newToken string) error {
	query := `
		UPDATE refresh_tokens 
		SET token = $3, expires_at = $4, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND token = $2`

	expiresAt := time.Now().Add(s.config.RefreshTokenExpiry)
	_, err := s.db.ExecContext(ctx, query, userID, oldToken, newToken, expiresAt)
	return err
}