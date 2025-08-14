package handlers

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"video-conference-backend/internal/services"
	"video-conference-backend/internal/utils"
)

// NotificationHandler handles notification-related HTTP requests
type NotificationHandler struct {
	notificationService services.NotificationService
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler(notificationService services.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
	}
}

// GetNotifications gets user notifications with pagination
func (h *NotificationHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse query parameters
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Get notifications
	notifications, err := h.notificationService.GetUserNotifications(r.Context(), userID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get notifications: "+err.Error())
		return
	}

	// Get unread count
	unreadCount, err := h.notificationService.GetUnreadCount(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get unread count: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]interface{}{
		"notifications": notifications,
		"unread_count":  unreadCount,
		"total":         len(notifications),
		"limit":         limit,
		"offset":        offset,
	})
}

// MarkNotificationAsRead marks a specific notification as read
func (h *NotificationHandler) MarkNotificationAsRead(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	vars := mux.Vars(r)
	notificationID, err := strconv.Atoi(vars["notificationId"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid notification ID")
		return
	}

	err = h.notificationService.MarkNotificationAsRead(r.Context(), userID, notificationID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to mark notification as read: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]string{"message": "Notification marked as read"})
}

// GetUnreadCount gets the count of unread notifications
func (h *NotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	count, err := h.notificationService.GetUnreadCount(r.Context(), userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get unread count: "+err.Error())
		return
	}

	utils.WriteSuccess(w, map[string]interface{}{
		"unread_count": count,
	})
}