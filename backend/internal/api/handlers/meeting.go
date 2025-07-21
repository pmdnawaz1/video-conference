package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"video-conference-backend/internal/models"
	"video-conference-backend/internal/services"
	"video-conference-backend/internal/utils"
)

// MeetingHandler handles meeting endpoints
type MeetingHandler struct {
	meetingService services.MeetingService
}

// NewMeetingHandler creates a new meeting handler
func NewMeetingHandler(meetingService services.MeetingService) *MeetingHandler {
	return &MeetingHandler{
		meetingService: meetingService,
	}
}

// ListMeetings lists meetings for the user
func (h *MeetingHandler) ListMeetings(w http.ResponseWriter, r *http.Request) {
	// Handle OPTIONS request for CORS
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found in context - please login first")
		return
	}

	limit := 50 // default
	offset := 0 // default

	meetings, err := h.meetingService.ListMeetingsByHost(r.Context(), userID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to list meetings: "+err.Error())
		return
	}

	utils.WriteSuccess(w, meetings)
}

// CreateMeeting creates a new meeting
func (h *MeetingHandler) CreateMeeting(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	clientID := utils.GetClientIDFromContext(r)
	if userID == 0 || clientID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User or client ID not found")
		return
	}

	var req struct {
		Title           string                 `json:"title"`
		Description     *string                `json:"description"`
		ScheduledStart  time.Time              `json:"scheduled_start"`
		ScheduledEnd    time.Time              `json:"scheduled_end"`
		MaxParticipants *int                   `json:"max_participants"`
		Password        *string                `json:"password"`
		Settings        map[string]interface{} `json:"settings"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}
	
	log.Printf("Received meeting request: %+v", req)

	// Validate required fields
	if req.Title == "" {
		utils.WriteError(w, http.StatusBadRequest, "Title is required")
		return
	}
	if req.ScheduledStart.IsZero() || req.ScheduledEnd.IsZero() {
		utils.WriteError(w, http.StatusBadRequest, "Scheduled start and end times are required")
		return
	}

	// Set default max participants if not provided
	maxParticipants := 100
	if req.MaxParticipants != nil {
		maxParticipants = *req.MaxParticipants
	}

	// Create meeting
	meeting := &models.Meeting{
		ClientID:            clientID,
		Title:               req.Title,
		Description:         req.Description,
		CreatedByUserID:     userID,
		Password:            req.Password,
		ScheduledStart:      req.ScheduledStart,
		ScheduledEnd:        req.ScheduledEnd,
		Status:              models.MeetingStatusScheduled,
		MaxParticipants:     maxParticipants,
		AllowAnonymous:      false,
		RequireApproval:     false,
		EnableWaitingRoom:   false,
		EnableChat:          true,
		EnableScreenSharing: true,
		EnableRecording:     false,
		Settings:            models.JSONB(req.Settings),
	}

	err := h.meetingService.CreateMeeting(r.Context(), meeting)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create meeting: "+err.Error())
		return
	}

	utils.WriteSuccess(w, meeting)
}

// GetMeeting gets a specific meeting
func (h *MeetingHandler) GetMeeting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	meeting, err := h.meetingService.GetMeetingByID(r.Context(), meetingID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Meeting not found")
		return
	}

	// Check if user has access to this meeting
	userID := utils.GetUserIDFromContext(r)
	if meeting.CreatedByUserID != userID {
		// TODO: Check if user is a participant
		utils.WriteError(w, http.StatusForbidden, "Access denied")
		return
	}

	utils.WriteSuccess(w, meeting)
}

// UpdateMeeting updates a meeting
func (h *MeetingHandler) UpdateMeeting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	var updateReq struct {
		Title          string                 `json:"title"`
		Description    *string                `json:"description"`
		ScheduledStart time.Time              `json:"scheduled_start"`
		ScheduledEnd   time.Time              `json:"scheduled_end"`
		Password       *string                `json:"password"`
		Settings       map[string]interface{} `json:"settings"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get existing meeting
	meeting, err := h.meetingService.GetMeetingByID(r.Context(), meetingID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Meeting not found")
		return
	}

	// Check if user is the host
	userID := utils.GetUserIDFromContext(r)
	if meeting.CreatedByUserID != userID {
		utils.WriteError(w, http.StatusForbidden, "Only the host can update the meeting")
		return
	}

	// Update fields
	if updateReq.Title != "" {
		meeting.Title = updateReq.Title
	}
	if updateReq.Description != nil {
		meeting.Description = updateReq.Description
	}
	if !updateReq.ScheduledStart.IsZero() {
		meeting.ScheduledStart = updateReq.ScheduledStart
	}
	if !updateReq.ScheduledEnd.IsZero() {
		meeting.ScheduledEnd = updateReq.ScheduledEnd
	}
	if updateReq.Password != nil {
		meeting.Password = updateReq.Password
	}
	if updateReq.Settings != nil {
		meeting.Settings = models.JSONB(updateReq.Settings)
	}

	err = h.meetingService.UpdateMeeting(r.Context(), meeting)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update meeting")
		return
	}

	utils.WriteSuccess(w, meeting)
}

// StartMeeting starts a meeting
func (h *MeetingHandler) StartMeeting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	// Get meeting
	meeting, err := h.meetingService.GetMeetingByID(r.Context(), meetingID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Meeting not found")
		return
	}

	// Start meeting
	err = h.meetingService.StartMeeting(r.Context(), meeting.MeetingID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to start meeting: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]string{
		"message":    "Meeting started successfully",
		"meeting_id": meeting.MeetingID,
		"status":     "active",
	})
}

// EndMeeting ends a meeting
func (h *MeetingHandler) EndMeeting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	// Get meeting
	meeting, err := h.meetingService.GetMeetingByID(r.Context(), meetingID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "Meeting not found")
		return
	}

	// End meeting
	err = h.meetingService.EndMeeting(r.Context(), meeting.MeetingID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Failed to end meeting: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]string{
		"message":    "Meeting ended successfully",
		"meeting_id": meeting.MeetingID,
		"status":     "ended",
	})
}

// GetUpcomingMeetings gets upcoming meetings
func (h *MeetingHandler) GetUpcomingMeetings(w http.ResponseWriter, r *http.Request) {
	clientID := utils.GetClientIDFromContext(r)
	if clientID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "Client ID not found")
		return
	}

	limit := 20 // default
	meetings, err := h.meetingService.GetUpcomingMeetings(r.Context(), clientID, limit)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get upcoming meetings")
		return
	}

	utils.WriteSuccess(w, meetings)
}