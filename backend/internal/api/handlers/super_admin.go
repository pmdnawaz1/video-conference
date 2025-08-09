package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
	"video-conference-backend/internal/services"

	"github.com/gorilla/mux"
)

type superAdminHandler struct {
	superAdminSvc services.SuperAdmin
}

func SuperAdminHandler(superAdminSvc services.SuperAdmin) *superAdminHandler {
	return &superAdminHandler{
		superAdminSvc: superAdminSvc,
	}
}

// ============================================================================
// ORGANIZATION MANAGEMENT ENDPOINTS
// ============================================================================

// CreateOrganization creates a new organization with initial admin
func (h *superAdminHandler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var req services.CreateOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.OrganizationName == "" || req.AdminEmail == "" || req.AdminFirstName == "" || req.AdminLastName == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	organization, err := h.superAdminSvc.CreateOrganization(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"message":      "Organization created successfully",
		"organization": organization,
	})
}

// GetAllOrganizations returns all organizations with summary data
func (h *superAdminHandler) GetAllOrganizations(w http.ResponseWriter, r *http.Request) {
	organizations, err := h.superAdminSvc.GetAllOrganizations(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"organizations": organizations,
		"total":         len(organizations),
	})
}

// GetOrganizationDetails returns detailed information about a specific organization
func (h *superAdminHandler) GetOrganizationDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientIDStr := vars["id"]
	
	clientID, err := strconv.Atoi(clientIDStr)
	if err != nil {
		http.Error(w, "Invalid organization ID", http.StatusBadRequest)
		return
	}

	details, err := h.superAdminSvc.GetOrganizationDetails(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"organization": details,
	})
}

// UpdateOrganization updates organization settings
func (h *superAdminHandler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientIDStr := vars["id"]
	
	clientID, err := strconv.Atoi(clientIDStr)
	if err != nil {
		http.Error(w, "Invalid organization ID", http.StatusBadRequest)
		return
	}

	var req services.UpdateOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.superAdminSvc.UpdateOrganization(r.Context(), clientID, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Organization updated successfully",
	})
}

// DeactivateOrganization deactivates an organization
func (h *superAdminHandler) DeactivateOrganization(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientIDStr := vars["id"]
	
	clientID, err := strconv.Atoi(clientIDStr)
	if err != nil {
		http.Error(w, "Invalid organization ID", http.StatusBadRequest)
		return
	}

	err = h.superAdminSvc.DeactivateOrganization(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Organization deactivated successfully",
	})
}

// GetOrganizationMetrics returns metrics for a specific organization
func (h *superAdminHandler) GetOrganizationMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientIDStr := vars["id"]
	
	clientID, err := strconv.Atoi(clientIDStr)
	if err != nil {
		http.Error(w, "Invalid organization ID", http.StatusBadRequest)
		return
	}

	metrics, err := h.superAdminSvc.GetOrganizationMetrics(r.Context(), clientID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"metrics": metrics,
	})
}

// ============================================================================
// ADMIN MANAGEMENT ENDPOINTS
// ============================================================================

// GetAllAdmins returns all admins across all organizations
func (h *superAdminHandler) GetAllAdmins(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters for filters
	filters := &services.AdminFilters{}
	
	if clientIDStr := r.URL.Query().Get("client_id"); clientIDStr != "" {
		if clientID, err := strconv.Atoi(clientIDStr); err == nil {
			filters.ClientID = clientID
		}
	}
	
	if status := r.URL.Query().Get("status"); status != "" {
		filters.Status = status
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

	admins, err := h.superAdminSvc.GetAllAdmins(r.Context(), filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"admins":  admins,
		"total":   len(admins),
		"filters": filters,
	})
}

// GetAdminDetails returns detailed information about a specific admin
func (h *superAdminHandler) GetAdminDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	adminIDStr := vars["id"]
	
	adminID, err := strconv.Atoi(adminIDStr)
	if err != nil {
		http.Error(w, "Invalid admin ID", http.StatusBadRequest)
		return
	}

	details, err := h.superAdminSvc.GetAdminDetails(r.Context(), adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"admin":   details,
	})
}

// SuspendAdmin suspends an admin account
func (h *superAdminHandler) SuspendAdmin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	adminIDStr := vars["id"]
	
	adminID, err := strconv.Atoi(adminIDStr)
	if err != nil {
		http.Error(w, "Invalid admin ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.superAdminSvc.SuspendAdmin(r.Context(), adminID, req.Reason)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Admin suspended successfully",
	})
}

// UnsuspendAdmin unsuspends an admin account
func (h *superAdminHandler) UnsuspendAdmin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	adminIDStr := vars["id"]
	
	adminID, err := strconv.Atoi(adminIDStr)
	if err != nil {
		http.Error(w, "Invalid admin ID", http.StatusBadRequest)
		return
	}

	err = h.superAdminSvc.UnsuspendAdmin(r.Context(), adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Admin unsuspended successfully",
	})
}

// DeleteAdmin deletes an admin account
func (h *superAdminHandler) DeleteAdmin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	adminIDStr := vars["id"]
	
	adminID, err := strconv.Atoi(adminIDStr)
	if err != nil {
		http.Error(w, "Invalid admin ID", http.StatusBadRequest)
		return
	}

	err = h.superAdminSvc.DeleteAdmin(r.Context(), adminID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Admin deleted successfully",
	})
}

// BulkInviteAdmins creates multiple admin invitations at once
func (h *superAdminHandler) BulkInviteAdmins(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Invitations []*services.AdminInvitationRequest `json:"invitations"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Invitations) == 0 {
		http.Error(w, "No invitations provided", http.StatusBadRequest)
		return
	}

	invitations, err := h.superAdminSvc.BulkInviteAdmins(r.Context(), req.Invitations)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"message":     "Bulk admin invitations processed",
		"invitations": invitations,
		"total":       len(invitations),
	})
}

// ============================================================================
// SYSTEM ANALYTICS AND HEALTH ENDPOINTS
// ============================================================================

// GetSystemMetrics returns overall system metrics and statistics
func (h *superAdminHandler) GetSystemMetrics(w http.ResponseWriter, r *http.Request) {
	timeframe := r.URL.Query().Get("timeframe")
	if timeframe == "" {
		timeframe = "24h"
	}

	metrics, err := h.superAdminSvc.GetSystemMetrics(r.Context(), timeframe)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"metrics": metrics,
	})
}

// GetSystemHealth returns system health status
func (h *superAdminHandler) GetSystemHealth(w http.ResponseWriter, r *http.Request) {
	health, err := h.superAdminSvc.GetSystemHealth(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set appropriate HTTP status based on health
	status := http.StatusOK
	if health.Status == "degraded" {
		status = http.StatusPartialContent
	} else if health.Status == "unhealthy" {
		status = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"health":  health,
	})
}

// GetUsageReports generates usage reports based on parameters
func (h *superAdminHandler) GetUsageReports(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")
	reportType := r.URL.Query().Get("report_type")
	clientIDStr := r.URL.Query().Get("client_id")
	granularity := r.URL.Query().Get("granularity")

	if startDateStr == "" || endDateStr == "" || reportType == "" {
		http.Error(w, "start_date, end_date, and report_type are required", http.StatusBadRequest)
		return
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		http.Error(w, "Invalid start_date format (expected YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		http.Error(w, "Invalid end_date format (expected YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	params := &services.UsageReportParams{
		StartDate:   startDate,
		EndDate:     endDate,
		ReportType:  reportType,
		Granularity: granularity,
	}

	if clientIDStr != "" {
		if clientID, err := strconv.Atoi(clientIDStr); err == nil {
			params.ClientID = clientID
		}
	}

	report, err := h.superAdminSvc.GetUsageReports(r.Context(), params)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"report":  report,
	})
}

// ExportData exports system data in various formats
func (h *superAdminHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	dataType := r.URL.Query().Get("data_type")
	format := r.URL.Query().Get("format")
	
	if dataType == "" || format == "" {
		http.Error(w, "data_type and format are required", http.StatusBadRequest)
		return
	}

	// Parse additional filters from query parameters
	filters := make(map[string]interface{})
	for key, values := range r.URL.Query() {
		if key != "data_type" && key != "format" {
			if len(values) > 0 {
				filters[key] = values[0]
			}
		}
	}

	data, err := h.superAdminSvc.ExportData(r.Context(), dataType, format, filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type and headers for download
	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename="+dataType+"_export.csv")
	case "pdf":
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", "attachment; filename="+dataType+"_export.pdf")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", "attachment; filename="+dataType+"_export."+format)
	}

	w.Write(data)
}