package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"net/url"
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
	
	// MFA Methods
	EnableMFA(ctx context.Context, userID int) (*MFASetupResponse, error)
	DisableMFA(ctx context.Context, userID int, totpCode string) error
	VerifyMFA(ctx context.Context, userID int, code string, useBackupCode bool) error
	RegenerateMFABackupCodes(ctx context.Context, userID int) ([]string, error)
	
	// Session Management
	CreateSession(ctx context.Context, userID int, deviceInfo map[string]interface{}) (string, error)
	ValidateSession(ctx context.Context, sessionID string) (*UserSession, error)
	RevokeSession(ctx context.Context, sessionID string) error
	GetUserSessions(ctx context.Context, userID int) ([]*UserSession, error)
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

// ============================================================================
// MFA and SESSION MANAGEMENT TYPES AND METHODS
// ============================================================================

type MFASetupResponse struct {
	Secret      string   `json:"secret,omitempty"`
	QRCodeURL   string   `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes,omitempty"`
}

type UserSession struct {
	ID             string                 `json:"id" db:"id"`
	UserID         int                    `json:"user_id" db:"user_id"`
	ExpiresAt      time.Time              `json:"expires_at" db:"expires_at"`
	DeviceInfo     map[string]interface{} `json:"device_info" db:"device_info"`
	LastActivityAt time.Time              `json:"last_activity_at" db:"last_activity_at"`
	IsActive       bool                   `json:"is_active" db:"is_active"`
	CreatedAt      time.Time              `json:"created_at" db:"created_at"`
}

// MFA Implementation
func (s *authService) EnableMFA(ctx context.Context, userID int) (*MFASetupResponse, error) {
	user, err := s.userSvc.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	
	// Generate TOTP secret
	secret, err := s.generateTOTPSecret()
	if err != nil {
		return nil, fmt.Errorf("failed to generate TOTP secret: %w", err)
	}
	
	// Generate backup codes
	backupCodes, err := s.generateBackupCodes()
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}
	
	// Store MFA configuration in database
	query := `
		UPDATE users 
		SET two_factor_enabled = true, two_factor_secret = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, userID, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to enable MFA: %w", err)
	}
	
	// Store backup codes
	err = s.storeBackupCodes(ctx, userID, backupCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to store backup codes: %w", err)
	}
	
	// Generate QR code URL for TOTP apps
	qrCodeURL := s.generateTOTPQRCodeURL(user.Email, secret)
	
	return &MFASetupResponse{
		Secret:      secret,
		QRCodeURL:   qrCodeURL,
		BackupCodes: backupCodes,
	}, nil
}

func (s *authService) DisableMFA(ctx context.Context, userID int, totpCode string) error {
	// Verify TOTP code before disabling
	err := s.VerifyMFA(ctx, userID, totpCode, false)
	if err != nil {
		return fmt.Errorf("invalid TOTP code: %w", err)
	}
	
	// Disable MFA in database
	query := `
		UPDATE users 
		SET two_factor_enabled = false, two_factor_secret = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to disable MFA: %w", err)
	}
	
	// Remove backup codes
	deleteQuery := `DELETE FROM user_backup_codes WHERE user_id = $1`
	_, err = s.db.ExecContext(ctx, deleteQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to remove backup codes: %w", err)
	}
	
	return nil
}

func (s *authService) VerifyMFA(ctx context.Context, userID int, code string, useBackupCode bool) error {
	if useBackupCode {
		return s.verifyBackupCode(ctx, userID, code)
	}
	
	// Get user's TOTP secret
	var secret string
	query := `SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true`
	err := s.db.GetContext(ctx, &secret, query, userID)
	if err != nil {
		return fmt.Errorf("MFA not enabled for user: %w", err)
	}
	
	// Verify TOTP code (simplified 6-digit validation)
	valid := s.validateTOTPCode(code, secret, time.Now())
	if !valid {
		return fmt.Errorf("invalid TOTP code")
	}
	
	return nil
}

func (s *authService) RegenerateMFABackupCodes(ctx context.Context, userID int) ([]string, error) {
	// Generate new backup codes
	backupCodes, err := s.generateBackupCodes()
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}
	
	// Replace existing backup codes
	tx, err := s.db.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()
	
	// Delete existing codes
	_, err = tx.ExecContext(ctx, "DELETE FROM user_backup_codes WHERE user_id = $1", userID)
	if err != nil {
		return nil, fmt.Errorf("failed to delete existing codes: %w", err)
	}
	
	// Store new codes
	for _, code := range backupCodes {
		hasher := sha256.New()
		hasher.Write([]byte(code))
		hashedCode := hex.EncodeToString(hasher.Sum(nil))
		
		query := `INSERT INTO user_backup_codes (user_id, code_hash, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`
		_, err := tx.ExecContext(ctx, query, userID, hashedCode)
		if err != nil {
			return nil, fmt.Errorf("failed to store backup code: %w", err)
		}
	}
	
	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	return backupCodes, nil
}

// Session Management Implementation
func (s *authService) CreateSession(ctx context.Context, userID int, deviceInfo map[string]interface{}) (string, error) {
	sessionID := s.generateSessionID()
	
	query := `
		INSERT INTO user_sessions (id, user_id, expires_at, device_info, last_activity_at, is_active, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP)`
	
	expiresAt := time.Now().Add(24 * time.Hour) // Default 24 hour session
	_, err := s.db.ExecContext(ctx, query, sessionID, userID, expiresAt, deviceInfo)
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	
	return sessionID, nil
}

func (s *authService) ValidateSession(ctx context.Context, sessionID string) (*UserSession, error) {
	var session UserSession
	query := `
		SELECT id, user_id, expires_at, device_info, last_activity_at, is_active, created_at
		FROM user_sessions 
		WHERE id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP`
	
	err := s.db.GetContext(ctx, &session, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid or expired session: %w", err)
	}
	
	// Update last activity
	updateQuery := `UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`
	s.db.ExecContext(ctx, updateQuery, sessionID)
	
	return &session, nil
}

func (s *authService) RevokeSession(ctx context.Context, sessionID string) error {
	query := `UPDATE user_sessions SET is_active = false WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, sessionID)
	if err != nil {
		return fmt.Errorf("failed to revoke session: %w", err)
	}
	return nil
}

func (s *authService) GetUserSessions(ctx context.Context, userID int) ([]*UserSession, error) {
	var sessions []*UserSession
	query := `
		SELECT id, user_id, expires_at, device_info, last_activity_at, is_active, created_at
		FROM user_sessions 
		WHERE user_id = $1 AND is_active = true 
		ORDER BY last_activity_at DESC`
	
	err := s.db.SelectContext(ctx, &sessions, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user sessions: %w", err)
	}
	
	return sessions, nil
}

// Helper methods
func (s *authService) generateTOTPSecret() (string, error) {
	bytes := make([]byte, 20) // 160 bits for TOTP
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return base32.StdEncoding.EncodeToString(bytes), nil
}

func (s *authService) generateTOTPQRCodeURL(email, secret string) string {
	// Generate TOTP URI for QR code
	issuer := "Video Conference Platform"
	label := url.QueryEscape(issuer + ":" + email)
	qrURL := fmt.Sprintf("otpauth://totp/%s?secret=%s&issuer=%s", label, secret, url.QueryEscape(issuer))
	return qrURL
}

func (s *authService) validateTOTPCode(code, secret string, t time.Time) bool {
	// Simplified TOTP validation - in production use proper TOTP library
	// This is a placeholder that accepts any 6-digit code
	return len(code) == 6
}

func (s *authService) generateBackupCodes() ([]string, error) {
	codes := make([]string, 10)
	for i := range codes {
		code, err := s.generateSecureRandomString(8)
		if err != nil {
			return nil, err
		}
		codes[i] = code
	}
	return codes, nil
}

func (s *authService) generateSecureRandomString(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	return base32.StdEncoding.EncodeToString(bytes)[:length], nil
}

func (s *authService) generateSessionID() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func (s *authService) storeBackupCodes(ctx context.Context, userID int, codes []string) error {
	for _, code := range codes {
		hasher := sha256.New()
		hasher.Write([]byte(code))
		hashedCode := hex.EncodeToString(hasher.Sum(nil))
		
		query := `INSERT INTO user_backup_codes (user_id, code_hash, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`
		_, err := s.db.ExecContext(ctx, query, userID, hashedCode)
		if err != nil {
			return fmt.Errorf("failed to store backup code: %w", err)
		}
	}
	return nil
}

func (s *authService) verifyBackupCode(ctx context.Context, userID int, code string) error {
	hasher := sha256.New()
	hasher.Write([]byte(code))
	hashedCode := hex.EncodeToString(hasher.Sum(nil))
	
	query := `DELETE FROM user_backup_codes WHERE user_id = $1 AND code_hash = $2`
	result, err := s.db.ExecContext(ctx, query, userID, hashedCode)
	if err != nil {
		return fmt.Errorf("failed to verify backup code: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		return fmt.Errorf("invalid backup code")
	}
	
	return nil
}