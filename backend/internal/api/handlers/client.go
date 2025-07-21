package handlers

import (
	"video-conference-backend/internal/utils"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"video-conference-backend/internal/models"
	"video-conference-backend/internal/services"
)

// ClientHandler handles client endpoints
type ClientHandler struct {
	clientService services.ClientService
}

// NewClientHandler creates a new client handler
func NewClientHandler(clientService services.ClientService) *ClientHandler {
	return &ClientHandler{
		clientService: clientService,
	}
}

// ListClients lists all clients (super admin only)
func (h *ClientHandler) ListClients(w http.ResponseWriter, r *http.Request) {
	limit := 50 // default
	offset := 0 // default

	clients, err := h.clientService.ListClients(r.Context(), limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to list clients")
		return
	}

	utils.WriteSuccess(w, clients)
}

// CreateClient creates a new client (super admin only)
func (h *ClientHandler) CreateClient(w http.ResponseWriter, r *http.Request) {
	var client models.Client
	if err := json.NewDecoder(r.Body).Decode(&client); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if client.Email == "" || client.AppName == "" {
		utils.WriteError(w, http.StatusBadRequest, "Email and app name are required")
		return
	}

	// Set defaults
	if client.Theme == "" {
		client.Theme = "light"
	}
	if client.PrimaryColor == "" {
		client.PrimaryColor = "#007bff"
	}

	err := h.clientService.CreateClient(r.Context(), &client)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create client: "+err.Error())
		return
	}

	utils.WriteSuccess(w, client)
}

// GetClient gets a specific client
func (h *ClientHandler) GetClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	client, err := h.clientService.GetClientByID(r.Context(), clientID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Client not found")
		return
	}

	utils.WriteSuccess(w, client)
}

// UpdateClient updates a client
func (h *ClientHandler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	var updateReq struct {
		Email        string  `json:"email"`
		AppName      string  `json:"app_name"`
		LogoURL      *string `json:"logo_url"`
		Theme        string  `json:"theme"`
		PrimaryColor string  `json:"primary_color"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get existing client
	client, err := h.clientService.GetClientByID(r.Context(), clientID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Client not found")
		return
	}

	// Update fields
	if updateReq.Email != "" {
		client.Email = updateReq.Email
	}
	if updateReq.AppName != "" {
		client.AppName = updateReq.AppName
	}
	if updateReq.LogoURL != nil {
		client.LogoURL = updateReq.LogoURL
	}
	if updateReq.Theme != "" {
		client.Theme = updateReq.Theme
	}
	if updateReq.PrimaryColor != "" {
		client.PrimaryColor = updateReq.PrimaryColor
	}

	err = h.clientService.UpdateClient(r.Context(), client)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update client")
		return
	}

	utils.WriteSuccess(w, client)
}

// GetClientFeatures gets client features
func (h *ClientHandler) GetClientFeatures(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	features, err := h.clientService.GetClientFeatures(r.Context(), clientID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Client features not found")
		return
	}

	utils.WriteSuccess(w, features)
}

// UpdateClientFeatures updates client features
func (h *ClientHandler) UpdateClientFeatures(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	var features models.ClientFeatures
	if err := json.NewDecoder(r.Body).Decode(&features); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	features.ClientID = clientID

	err = h.clientService.UpdateClientFeatures(r.Context(), &features)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update client features")
		return
	}

	utils.WriteSuccess(w, features)
}