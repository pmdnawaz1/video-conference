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

// ChatHandler handles chat endpoints
type ChatHandler struct {
	chatService services.ChatService
}

// NewChatHandler creates a new chat handler
func NewChatHandler(chatService services.ChatService) *ChatHandler {
	return &ChatHandler{
		chatService: chatService,
	}
}

// GetMessages gets chat messages for a meeting
func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	limit := 50 // default
	offset := 0 // default

	// Parse query parameters for pagination
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	messages, err := h.chatService.GetMessagesByMeeting(r.Context(), meetingID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	utils.WriteSuccess(w, messages)
}

// SendMessage sends a chat message
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	userID := utils.GetUserIDFromContext(r)
	clientID := utils.GetClientIDFromContext(r)
	if userID == 0 || clientID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User or client ID not found")
		return
	}

	var req struct {
		Message     string                 `json:"message"`
		MessageType string                 `json:"message_type"`
		ReplyToID   *int                   `json:"reply_to_id"`
		Metadata    map[string]interface{} `json:"metadata"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Message == "" {
		utils.WriteError(w, http.StatusBadRequest, "Message is required")
		return
	}

	// Set default message type
	if req.MessageType == "" {
		req.MessageType = "text"
	}

	// Create chat message
	message := &models.ChatMessage{
		ClientID:    clientID,
		MeetingID:   meetingID,
		SenderID:    &userID,
		SenderName:  "User", // TODO: Get actual user name
		Message:     req.Message,
		MessageType: req.MessageType,
		ReplyToID:   req.ReplyToID,
		Metadata:    models.JSONB(req.Metadata),
	}

	err = h.chatService.SendMessage(r.Context(), message)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to send message: "+err.Error())
		return
	}

	utils.WriteSuccess(w, message)
}

// GetMessageReplies gets replies to a specific message
func (h *ChatHandler) GetMessageReplies(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	messageID, err := strconv.Atoi(vars["messageId"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid message ID")
		return
	}

	limit := 20 // default
	offset := 0 // default

	replies, err := h.chatService.GetMessageReplies(r.Context(), messageID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get replies")
		return
	}

	utils.WriteSuccess(w, replies)
}

// ModerateMessage moderates a chat message (admin only)
func (h *ChatHandler) ModerateMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	messageID, err := strconv.Atoi(vars["messageId"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid message ID")
		return
	}

	userID := utils.GetUserIDFromContext(r)
	if userID == 0 {
		utils.WriteError(w, http.StatusUnauthorized, "User ID not found")
		return
	}

	err = h.chatService.ModerateMessage(r.Context(), messageID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to moderate message")
		return
	}

	utils.WriteSuccess(w, map[string]string{"message": "Message moderated successfully"})
}

// SearchMessages searches messages in a meeting
func (h *ChatHandler) SearchMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		utils.WriteError(w, http.StatusBadRequest, "Search query is required")
		return
	}

	limit := 20 // default
	offset := 0 // default

	messages, err := h.chatService.SearchMessages(r.Context(), meetingID, query, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to search messages")
		return
	}

	utils.WriteSuccess(w, messages)
}

// GetChatStats gets chat statistics for a meeting
func (h *ChatHandler) GetChatStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	meetingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid meeting ID")
		return
	}

	stats, err := h.chatService.GetChatStats(r.Context(), meetingID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get chat stats")
		return
	}

	utils.WriteSuccess(w, stats)
}