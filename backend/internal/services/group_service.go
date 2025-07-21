package services

import (
	"context"
	"fmt"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type GroupService interface {
	CreateGroup(ctx context.Context, group *models.Group) error
	GetGroupByID(ctx context.Context, id int) (*models.Group, error)
	UpdateGroup(ctx context.Context, group *models.Group) error
	DeleteGroup(ctx context.Context, id int) error
	ListGroupsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Group, error)
	
	// Group membership management
	AddUserToGroup(ctx context.Context, groupID, userID int, addedBy int) error
	RemoveUserFromGroup(ctx context.Context, groupID, userID int) error
	GetGroupMembers(ctx context.Context, groupID int) ([]*models.User, error)
	GetUserGroups(ctx context.Context, userID int) ([]*models.Group, error)
	IsUserInGroup(ctx context.Context, groupID, userID int) (bool, error)
	
	// Bulk operations
	AddMultipleUsersToGroup(ctx context.Context, groupID int, userIDs []int, addedBy int) error
	RemoveMultipleUsersFromGroup(ctx context.Context, groupID int, userIDs []int) error
	GetGroupMemberships(ctx context.Context, groupID int) ([]*models.UserGroupMembership, error)
}

type groupService struct {
	db *database.DB
}

func NewGroupService(db *database.DB) GroupService {
	return &groupService{db: db}
}

func (s *groupService) CreateGroup(ctx context.Context, group *models.Group) error {
	query := `
		INSERT INTO groups (client_id, name, description, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, group, query,
		group.ClientID, group.Name, group.Description, group.CreatedBy)
	if err != nil {
		return fmt.Errorf("failed to create group: %w", err)
	}

	return nil
}

func (s *groupService) GetGroupByID(ctx context.Context, id int) (*models.Group, error) {
	group := &models.Group{}
	query := `SELECT * FROM groups WHERE id = $1`
	
	err := s.db.GetContext(ctx, group, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get group by ID: %w", err)
	}
	
	return group, nil
}

func (s *groupService) UpdateGroup(ctx context.Context, group *models.Group) error {
	query := `
		UPDATE groups 
		SET name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, group.ID, group.Name, group.Description)
	if err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}
	
	return nil
}

func (s *groupService) DeleteGroup(ctx context.Context, id int) error {
	// First remove all group memberships
	_, err := s.db.ExecContext(ctx, `DELETE FROM user_group_memberships WHERE group_id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to remove group memberships: %w", err)
	}

	// Then delete the group
	query := `DELETE FROM groups WHERE id = $1`
	_, err = s.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}
	
	return nil
}

func (s *groupService) ListGroupsByClient(ctx context.Context, clientID int, limit, offset int) ([]*models.Group, error) {
	groups := []*models.Group{}
	query := `
		SELECT * FROM groups 
		WHERE client_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3`
	
	err := s.db.SelectContext(ctx, &groups, query, clientID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list groups by client: %w", err)
	}
	
	return groups, nil
}

func (s *groupService) AddUserToGroup(ctx context.Context, groupID, userID int, addedBy int) error {
	// Check if user is already in group
	exists, err := s.IsUserInGroup(ctx, groupID, userID)
	if err != nil {
		return fmt.Errorf("failed to check if user is in group: %w", err)
	}
	
	if exists {
		return fmt.Errorf("user is already a member of the group")
	}

	query := `
		INSERT INTO user_group_memberships (user_id, group_id, added_by)
		VALUES ($1, $2, $3)`
	
	_, err = s.db.ExecContext(ctx, query, userID, groupID, addedBy)
	if err != nil {
		return fmt.Errorf("failed to add user to group: %w", err)
	}
	
	return nil
}

func (s *groupService) RemoveUserFromGroup(ctx context.Context, groupID, userID int) error {
	query := `DELETE FROM user_group_memberships WHERE group_id = $1 AND user_id = $2`
	
	result, err := s.db.ExecContext(ctx, query, groupID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove user from group: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("user is not a member of the group")
	}
	
	return nil
}

func (s *groupService) GetGroupMembers(ctx context.Context, groupID int) ([]*models.User, error) {
	users := []*models.User{}
	query := `
		SELECT u.* FROM users u
		INNER JOIN user_group_memberships ugm ON u.id = ugm.user_id
		WHERE ugm.group_id = $1
		ORDER BY ugm.added_at DESC`
	
	err := s.db.SelectContext(ctx, &users, query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}
	
	return users, nil
}

func (s *groupService) GetUserGroups(ctx context.Context, userID int) ([]*models.Group, error) {
	groups := []*models.Group{}
	query := `
		SELECT g.* FROM groups g
		INNER JOIN user_group_memberships ugm ON g.id = ugm.group_id
		WHERE ugm.user_id = $1
		ORDER BY ugm.added_at DESC`
	
	err := s.db.SelectContext(ctx, &groups, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user groups: %w", err)
	}
	
	return groups, nil
}

func (s *groupService) IsUserInGroup(ctx context.Context, groupID, userID int) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM user_group_memberships 
		WHERE group_id = $1 AND user_id = $2`
	
	err := s.db.GetContext(ctx, &count, query, groupID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check group membership: %w", err)
	}
	
	return count > 0, nil
}

func (s *groupService) AddMultipleUsersToGroup(ctx context.Context, groupID int, userIDs []int, addedBy int) error {
	if len(userIDs) == 0 {
		return nil
	}

	// Use a transaction for bulk insert
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO user_group_memberships (user_id, group_id, added_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, group_id) DO NOTHING`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, userID := range userIDs {
		_, err = stmt.ExecContext(ctx, userID, groupID, addedBy)
		if err != nil {
			return fmt.Errorf("failed to add user %d to group: %w", userID, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *groupService) RemoveMultipleUsersFromGroup(ctx context.Context, groupID int, userIDs []int) error {
	if len(userIDs) == 0 {
		return nil
	}

	// Use a transaction for bulk delete
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		DELETE FROM user_group_memberships 
		WHERE group_id = $1 AND user_id = $2`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, userID := range userIDs {
		_, err = stmt.ExecContext(ctx, groupID, userID)
		if err != nil {
			return fmt.Errorf("failed to remove user %d from group: %w", userID, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *groupService) GetGroupMemberships(ctx context.Context, groupID int) ([]*models.UserGroupMembership, error) {
	memberships := []*models.UserGroupMembership{}
	query := `
		SELECT * FROM user_group_memberships 
		WHERE group_id = $1 
		ORDER BY added_at DESC`
	
	err := s.db.SelectContext(ctx, &memberships, query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group memberships: %w", err)
	}
	
	return memberships, nil
}