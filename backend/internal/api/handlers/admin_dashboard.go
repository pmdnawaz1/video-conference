package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

type adminDashboardHandler struct {
	adminDashboardSvc services.AdminDashboard
}

func AdminDashboardHandler(adminDashboardSvc services.AdminDashboard) *adminDashboardHandler {
	return &adminDashboardHandler{
		adminDashboardSvc: adminDashboardSvc,
	}
}

// ============================================================================
// DASHBOARD OVERVIEW ENDPOINTS
// ============================================================================

// GetDashboardOverview returns comprehensive dashboard overview for admin
func (h *adminDashboardHandler) GetDashboardOverview(w http.ResponseWriter, r *http.Request) {
	adminID := getUserID(r) // Assuming middleware sets this
	if adminID == 0 {
		http.Error(w, "Admin ID required", http.StatusBadRequest)
		return
	}

	overview, err := h.adminDashboardSvc.GetDashboardOverview(r.Context(), adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"overview": overview,
	})
}

// GetMeetingStats returns meeting statistics for the admin's organization
func (h *adminDashboardHandler) GetMeetingStats(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r) // Assuming middleware sets this
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	timeframe := r.URL.Query().Get("timeframe")
	if timeframe == "" {
		timeframe = "today"
	}

	stats, err := h.adminDashboardSvc.GetMeetingStats(r.Context(), clientID, timeframe)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

// GetRecentMeetings returns recent meetings for the admin's organization
func (h *adminDashboardHandler) GetRecentMeetings(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r)
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 10 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}

	meetings, err := h.adminDashboardSvc.GetRecentMeetings(r.Context(), clientID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"meetings": meetings,
		"total":    len(meetings),
	})
}

// GetUpcomingMeetings returns upcoming meetings for the admin's organization
func (h *adminDashboardHandler) GetUpcomingMeetings(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r)
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 10 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}

	meetings, err := h.adminDashboardSvc.GetUpcomingMeetings(r.Context(), clientID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"meetings": meetings,
		"total":    len(meetings),
	})
}

// GetUserGroupsOverview returns user groups overview for the admin's organization
func (h *adminDashboardHandler) GetUserGroupsOverview(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r)
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	overview, err := h.adminDashboardSvc.GetUserGroupsOverview(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"overview": overview,
	})
}

// ============================================================================
// QUICK MEETING CREATION ENDPOINTS
// ============================================================================

// CreateInstantMeeting creates an instant meeting
func (h *adminDashboardHandler) CreateInstantMeeting(w http.ResponseWriter, r *http.Request) {
	var req services.InstantMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set admin ID and client ID from context
	req.AdminID = getUserID(r)
	req.ClientID = getClientID(r)

	if req.AdminID == 0 || req.ClientID == 0 {
		http.Error(w, "Admin ID and Client ID required", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "Meeting title is required", http.StatusBadRequest)
		return
	}

	meeting, err := h.adminDashboardSvc.CreateInstantMeeting(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Instant meeting created successfully",
		"meeting": meeting,
	})
}

// CreateScheduledMeeting creates a scheduled meeting
func (h *adminDashboardHandler) CreateScheduledMeeting(w http.ResponseWriter, r *http.Request) {
	var req services.ScheduledMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set admin ID and client ID from context
	req.AdminID = getUserID(r)
	req.ClientID = getClientID(r)

	if req.AdminID == 0 || req.ClientID == 0 {
		http.Error(w, "Admin ID and Client ID required", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "Meeting title is required", http.StatusBadRequest)
		return
	}

	if req.ScheduledStart.IsZero() || req.ScheduledEnd.IsZero() {
		http.Error(w, "Scheduled start and end times are required", http.StatusBadRequest)
		return
	}

	meeting, err := h.adminDashboardSvc.CreateScheduledMeeting(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Scheduled meeting created successfully",
		"meeting": meeting,
	})
}

// CreateRecurringMeeting creates recurring meetings
func (h *adminDashboardHandler) CreateRecurringMeeting(w http.ResponseWriter, r *http.Request) {
	var req services.RecurringMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set admin ID and client ID from context
	req.AdminID = getUserID(r)
	req.ClientID = getClientID(r)

	if req.AdminID == 0 || req.ClientID == 0 {
		http.Error(w, "Admin ID and Client ID required", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "Meeting title is required", http.StatusBadRequest)
		return
	}

	if req.RecurrencePattern == "" {
		http.Error(w, "Recurrence pattern is required", http.StatusBadRequest)
		return
	}

	meetings, err := h.adminDashboardSvc.CreateRecurringMeeting(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Recurring meetings created successfully",
		"meetings": meetings,
		"total":    len(meetings),
	})
}

// ============================================================================
// USER AND GROUP MANAGEMENT ENDPOINTS
// ============================================================================

// GetAllUsers returns all users in the admin's organization
func (h *adminDashboardHandler) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r)
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	// Parse query parameters for filters
	filters := &services.UserFilters{}
	
	if status := r.URL.Query().Get("status"); status != "" {
		filters.Status = status
	}
	
	if role := r.URL.Query().Get("role"); role != "" {
		filters.Role = role
	}
	
	if groupIDStr := r.URL.Query().Get("group_id"); groupIDStr != "" {
		if groupID, err := strconv.Atoi(groupIDStr); err == nil {
			filters.GroupID = groupID
		}
	}
	
	if search := r.URL.Query().Get("search"); search != "" {
		filters.Search = search
	}
	
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			filters.Limit = limit
		}
	}
	
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			filters.Offset = offset
		}
	}

	users, err := h.adminDashboardSvc.GetAllUsers(r.Context(), clientID, filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"users":   users,
		"total":   len(users),
		"filters": filters,
	})
}

// GetUserGroups returns all user groups in the admin's organization
func (h *adminDashboardHandler) GetUserGroups(w http.ResponseWriter, r *http.Request) {
	clientID := getClientID(r)
	if clientID == 0 {
		http.Error(w, "Client ID required", http.StatusBadRequest)
		return
	}

	groups, err := h.adminDashboardSvc.GetUserGroups(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"groups":  groups,
		"total":   len(groups),
	})
}

// CreateUserGroup creates a new user group
func (h *adminDashboardHandler) CreateUserGroup(w http.ResponseWriter, r *http.Request) {
	var req services.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set admin ID and client ID from context
	req.AdminID = getUserID(r)
	req.ClientID = getClientID(r)

	if req.AdminID == 0 || req.ClientID == 0 {
		http.Error(w, "Admin ID and Client ID required", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Group name is required", http.StatusBadRequest)
		return
	}

	group, err := h.adminDashboardSvc.CreateUserGroup(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User group created successfully",
		"group":   group,
	})
}

// InviteUser creates a user invitation
func (h *adminDashboardHandler) InviteUser(w http.ResponseWriter, r *http.Request) {
	var req services.UserInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set admin ID and client ID from context
	req.InvitedBy = getUserID(r)
	req.ClientID = getClientID(r)

	if req.InvitedBy == 0 || req.ClientID == 0 {
		http.Error(w, "Admin ID and Client ID required", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.FirstName == "" || req.LastName == "" {
		http.Error(w, "Email, first name, and last name are required", http.StatusBadRequest)
		return
	}

	if req.Role == "" {
		req.Role = "user" // Default role
	}

	invitation, err := h.adminDashboardSvc.InviteUser(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "User invitation created successfully",
		"invitation": invitation,
	})
}

// ============================================================================
// MEETING MANAGEMENT ENDPOINTS
// ============================================================================

// GetMeetingDetails returns detailed meeting information
func (h *adminDashboardHandler) GetMeetingDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingIDStr := vars["id"]
	
	meetingID, err := strconv.Atoi(meetingIDStr)
	if err != nil {
		http.Error(w, "Invalid meeting ID", http.StatusBadRequest)
		return
	}

	adminID := getUserID(r)
	if adminID == 0 {
		http.Error(w, "Admin ID required", http.StatusBadRequest)
		return
	}

	details, err := h.adminDashboardSvc.GetMeetingDetails(r.Context(), meetingID, adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"details": details,
	})
}

// GetMeetingParticipants returns meeting participants
func (h *adminDashboardHandler) GetMeetingParticipants(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingIDStr := vars["id"]
	
	meetingID, err := strconv.Atoi(meetingIDStr)
	if err != nil {
		http.Error(w, "Invalid meeting ID", http.StatusBadRequest)
		return
	}

	participants, err := h.adminDashboardSvc.GetMeetingParticipants(r.Context(), meetingID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"participants": participants,
		"total":        len(participants),
	})
}

// UpdateMeetingSettings updates meeting settings
func (h *adminDashboardHandler) UpdateMeetingSettings(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingIDStr := vars["id"]
	
	meetingID, err := strconv.Atoi(meetingIDStr)
	if err != nil {
		http.Error(w, "Invalid meeting ID", http.StatusBadRequest)
		return
	}

	var req services.UpdateMeetingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.adminDashboardSvc.UpdateMeetingSettings(r.Context(), meetingID, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Meeting settings updated successfully",
	})
}

// EndMeeting ends a meeting
func (h *adminDashboardHandler) EndMeeting(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingIDStr := vars["id"]
	
	meetingID, err := strconv.Atoi(meetingIDStr)
	if err != nil {
		http.Error(w, "Invalid meeting ID", http.StatusBadRequest)
		return
	}

	adminID := getUserID(r)
	if adminID == 0 {
		http.Error(w, "Admin ID required", http.StatusBadRequest)
		return
	}

	err = h.adminDashboardSvc.EndMeeting(r.Context(), meetingID, adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Meeting ended successfully",
	})
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper functions to extract user and client ID from request context
// These should be set by authentication middleware
func getUserID(r *http.Request) int {
	if userID := r.Context().Value("user_id"); userID != nil {
		if id, ok := userID.(int); ok {
			return id
		}
	}
	return 0
}

func getClientID(r *http.Request) int {
	if clientID := r.Context().Value("client_id"); clientID != nil {
		if id, ok := clientID.(int); ok {
			return id
		}
	}
	return 0
}