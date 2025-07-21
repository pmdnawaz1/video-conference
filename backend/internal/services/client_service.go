package services

import (
	"context"
	"fmt"
	"video-conference-backend/internal/database"
	"video-conference-backend/internal/models"
)

type ClientService interface {
	CreateClient(ctx context.Context, client *models.Client) error
	GetClientByID(ctx context.Context, id int) (*models.Client, error)
	GetClientByEmail(ctx context.Context, email string) (*models.Client, error)
	UpdateClient(ctx context.Context, client *models.Client) error
	DeleteClient(ctx context.Context, id int) error
	ListClients(ctx context.Context, limit, offset int) ([]*models.Client, error)
	GetClientFeatures(ctx context.Context, clientID int) (*models.ClientFeatures, error)
	UpdateClientFeatures(ctx context.Context, features *models.ClientFeatures) error
}

type clientService struct {
	db *database.DB
}

func NewClientService(db *database.DB) ClientService {
	return &clientService{db: db}
}

func (s *clientService) CreateClient(ctx context.Context, client *models.Client) error {
	query := `
		INSERT INTO clients (email, app_name, logo_url, theme, primary_color)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, client, query,
		client.Email, client.AppName, client.LogoURL, client.Theme, client.PrimaryColor)
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Create default client features
	features := &models.ClientFeatures{
		ClientID:              client.ID,
		ChatEnabled:           true,
		ReactionsEnabled:      true,
		ScreenSharingEnabled:  true,
		RecordingEnabled:      false,
		RaiseHandEnabled:      true,
		WaitingRoomEnabled:    false,
		MaxParticipants:       100,
	}

	return s.createDefaultClientFeatures(ctx, features)
}

func (s *clientService) GetClientByID(ctx context.Context, id int) (*models.Client, error) {
	client := &models.Client{}
	query := `SELECT * FROM clients WHERE id = $1`
	
	err := s.db.GetContext(ctx, client, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get client by ID: %w", err)
	}
	
	return client, nil
}

func (s *clientService) GetClientByEmail(ctx context.Context, email string) (*models.Client, error) {
	client := &models.Client{}
	query := `SELECT * FROM clients WHERE email = $1`
	
	err := s.db.GetContext(ctx, client, query, email)
	if err != nil {
		return nil, fmt.Errorf("failed to get client by email: %w", err)
	}
	
	return client, nil
}

func (s *clientService) UpdateClient(ctx context.Context, client *models.Client) error {
	query := `
		UPDATE clients 
		SET email = $2, app_name = $3, logo_url = $4, theme = $5, primary_color = $6
		WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query,
		client.ID, client.Email, client.AppName, client.LogoURL, client.Theme, client.PrimaryColor)
	if err != nil {
		return fmt.Errorf("failed to update client: %w", err)
	}
	
	return nil
}

func (s *clientService) DeleteClient(ctx context.Context, id int) error {
	query := `DELETE FROM clients WHERE id = $1`
	
	_, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete client: %w", err)
	}
	
	return nil
}

func (s *clientService) ListClients(ctx context.Context, limit, offset int) ([]*models.Client, error) {
	clients := []*models.Client{}
	query := `
		SELECT * FROM clients 
		ORDER BY created_at DESC 
		LIMIT $1 OFFSET $2`
	
	err := s.db.SelectContext(ctx, &clients, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list clients: %w", err)
	}
	
	return clients, nil
}

func (s *clientService) GetClientFeatures(ctx context.Context, clientID int) (*models.ClientFeatures, error) {
	features := &models.ClientFeatures{}
	query := `SELECT * FROM client_features WHERE client_id = $1`
	
	err := s.db.GetContext(ctx, features, query, clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get client features: %w", err)
	}
	
	return features, nil
}

func (s *clientService) UpdateClientFeatures(ctx context.Context, features *models.ClientFeatures) error {
	query := `
		UPDATE client_features 
		SET chat_enabled = $2, reactions_enabled = $3, screen_sharing_enabled = $4, 
		    recording_enabled = $5, raise_hand_enabled = $6, waiting_room_enabled = $7, 
		    max_participants = $8
		WHERE client_id = $1`
	
	_, err := s.db.ExecContext(ctx, query,
		features.ClientID, features.ChatEnabled, features.ReactionsEnabled,
		features.ScreenSharingEnabled, features.RecordingEnabled, features.RaiseHandEnabled,
		features.WaitingRoomEnabled, features.MaxParticipants)
	if err != nil {
		return fmt.Errorf("failed to update client features: %w", err)
	}
	
	return nil
}

func (s *clientService) createDefaultClientFeatures(ctx context.Context, features *models.ClientFeatures) error {
	query := `
		INSERT INTO client_features 
		(client_id, chat_enabled, reactions_enabled, screen_sharing_enabled, 
		 recording_enabled, raise_hand_enabled, waiting_room_enabled, max_participants)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`
	
	err := s.db.GetContext(ctx, features, query,
		features.ClientID, features.ChatEnabled, features.ReactionsEnabled,
		features.ScreenSharingEnabled, features.RecordingEnabled, features.RaiseHandEnabled,
		features.WaitingRoomEnabled, features.MaxParticipants)
	if err != nil {
		return fmt.Errorf("failed to create client features: %w", err)
	}
	
	return nil
}