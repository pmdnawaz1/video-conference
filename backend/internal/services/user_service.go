package services

import (
	"context"
	"fmt"
	"video-conference-backend/prisma/db"
	"video-conference-backend/prisma/db"
	"golang.org/x/crypto/bcrypt"
)

type UserService interface {
	CreateUser(ctx context.Context, user *db.User) error
	GetUserByID(ctx context.Context, id int) (*db.User, error)
	GetUserByEmail(ctx context.Context, email string) (*db.User, error)
	UpdateUser(ctx context.Context, user *db.User) error
	DeleteUser(ctx context.Context, id int) error
	ListUsersByClient(ctx context.Context, clientID int, limit, offset int) (*db.User, error)
	UpdateUserStatus(ctx context.Context, userID int, status string) error
	VerifyUserPassword(ctx context.Context, email, password string) (*db.User, error)
	ChangeUserPassword(ctx context.Context, userID int, oldPassword, newPassword string) error
	GetUsersByRole(ctx context.Context, clientID int, role string) (*db.User, error)
	UpdateUserRole(ctx context.Context, userID int, role string) error
}

type userService struct {
	db *db.DB
}

func NewUserService(db *db.DB) UserService {
	return &userService{db: db}
}

func (s *userService) CreateUser(ctx context.Context, user *db.User) error {
	// Hash password before storing
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	query := `
		INSERT INTO users (client_id, email, password_hash, first_name, last_name, role, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`
	
	err = s.db.GetContext(ctx, user, query,
		user.ClientID, user.Email, string(hashedPassword), user.FirstName, user.LastName, user.Role, user.Status)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

func (s *userService) GetUserByID(ctx context.Context, id int) (*db.User, error) {
	user := &*db.User{}
	query := `SELECT * FROM users WHERE id = $1`
	
	err := s.db.GetContext(ctx, user, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	
	return user, nil
}

func (s *userService) GetUserByEmail(ctx context.Context, email string) (*db.User, error) {
	user := &*db.User{}
	query := `SELECT * FROM users WHERE email = $1`
	
	err := s.db.GetContext(ctx, user, query, email)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	
	return user, nil
}

func (s *userService) UpdateUser(ctx context.Context, user *db.User) error {
	query := `
		UPDATE users 
		SET first_name = $2, last_name = $3, role = $4, status = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query,
		user.ID, user.FirstName, user.LastName, user.Role, user.Status)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	
	return nil
}

func (s *userService) DeleteUser(ctx context.Context, id int) error {
	query := `DELETE FROM users WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	
	return nil
}

func (s *userService) ListUsersByClient(ctx context.Context, clientID int, limit, offset int) (*db.User, error) {
	users := *db.User{}
	query := `
		SELECT * FROM users 
		WHERE client_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &users, query, clientID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list users by client: %w", err)
	}
	
	return users, nil
}

func (s *userService) UpdateUserStatus(ctx context.Context, userID int, status string) error {
	query := `
		UPDATE users 
		SET status = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, userID, status)
	if err != nil {
		return fmt.Errorf("failed to update user status: %w", err)
	}
	
	return nil
}

func (s *userService) VerifyUserPassword(ctx context.Context, email, password string) (*db.User, error) {
	user, err := s.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	// Note: last_login column not available in current schema

	return user, nil
}

func (s *userService) ChangeUserPassword(ctx context.Context, userID int, oldPassword, newPassword string) error {
	// Get current user
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Verify old password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword))
	if err != nil {
		return fmt.Errorf("invalid old password")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update password
	query := `
		UPDATE users 
		SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err = s.db.ExecContext(ctx, query, userID, string(hashedPassword))
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	
	return nil
}

func (s *userService) GetUsersByRole(ctx context.Context, clientID int, role string) (*db.User, error) {
	users := *db.User{}
	query := `
		SELECT * FROM users 
		WHERE client_id = $1 AND role = $2 
		ORDER BY created_at DESC`
	
	err := s.db.SelectContext(ctx, &users, query, clientID, role)
	if err != nil {
		return nil, fmt.Errorf("failed to get users by role: %w", err)
	}
	
	return users, nil
}

func (s *userService) UpdateUserRole(ctx context.Context, userID int, role string) error {
	query := `
		UPDATE users 
		SET role = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, userID, role)
	if err != nil {
		return fmt.Errorf("failed to update user role: %w", err)
	}
	
	return nil
}