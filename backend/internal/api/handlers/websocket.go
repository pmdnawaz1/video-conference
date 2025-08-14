package handlers

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin in development
		return true
	},
}

// Message types for WebRTC signaling
type SignalingMessage struct {
	Type    string      `json:"type"`
	RoomID  string      `json:"roomId,omitempty"`
	UserID  string      `json:"userId,omitempty"`
	Payload interface{} `json:"payload,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// Client represents a WebSocket connection
type Client struct {
	conn   *websocket.Conn
	roomID string
	userID string
	send   chan SignalingMessage
}

// Room represents a meeting room with multiple clients
type Room struct {
	ID      string
	clients map[*Client]bool
	mutex   sync.RWMutex
}

// Hub maintains the set of active clients and broadcasts messages to the clients
type Hub struct {
	rooms      map[string]*Room
	register   chan *Client
	unregister chan *Client
	broadcast  chan SignalingMessage
	mutex      sync.RWMutex
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]*Room),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan SignalingMessage),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// Get or create room
	room, exists := h.rooms[client.roomID]
	if !exists {
		room = &Room{
			ID:      client.roomID,
			clients: make(map[*Client]bool),
		}
		h.rooms[client.roomID] = room
		log.Printf("Created new room: %s", client.roomID)
	}

	// Add client to room
	room.mutex.Lock()
	room.clients[client] = true
	room.mutex.Unlock()

	log.Printf("Client %s joined room %s (total clients in room: %d)", client.userID, client.roomID, len(room.clients))

	// Notify other clients in the room that a new user joined
	joinMessage := SignalingMessage{
		Type: "userJoined",
		Payload: map[string]interface{}{
			"userId":   client.userID,
			"userName": client.userID, // We can enhance this with actual user names later
		},
	}
	log.Printf("Broadcasting userJoined message for %s to room %s", client.userID, client.roomID)
	h.broadcastToRoom(client.roomID, joinMessage, client)
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	room, exists := h.rooms[client.roomID]
	if !exists {
		return
	}

	room.mutex.Lock()
	if _, ok := room.clients[client]; ok {
		delete(room.clients, client)
		close(client.send)

		// If room is empty, remove it
		if len(room.clients) == 0 {
			delete(h.rooms, client.roomID)
			log.Printf("Removed empty room: %s", client.roomID)
		}
	}
	room.mutex.Unlock()

	log.Printf("Client %s left room %s", client.userID, client.roomID)

	// Notify other clients that user left
	leaveMessage := SignalingMessage{
		Type: "userLeft",
		Payload: map[string]interface{}{
			"userId": client.userID,
		},
	}
	h.broadcastToRoom(client.roomID, leaveMessage, nil)
}

func (h *Hub) broadcastMessage(message SignalingMessage) {
	h.broadcastToRoom(message.RoomID, message, nil)
}

func (h *Hub) broadcastToRoom(roomID string, message SignalingMessage, exclude *Client) {
	h.mutex.RLock()
	room, exists := h.rooms[roomID]
	h.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	clients := make([]*Client, 0, len(room.clients))
	for client := range room.clients {
		if client != exclude {
			clients = append(clients, client)
		}
	}
	room.mutex.RUnlock()

	for _, client := range clients {
		select {
		case client.send <- message:
		default:
			// Client's send channel is full, close it
			close(client.send)
			room.mutex.Lock()
			delete(room.clients, client)
			room.mutex.Unlock()
		}
	}
}

func (h *Hub) broadcastToUser(roomID string, targetUserID string, message SignalingMessage) {
	h.mutex.RLock()
	room, exists := h.rooms[roomID]
	h.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	defer room.mutex.RUnlock()

	for client := range room.clients {
		if client.userID == targetUserID {
			select {
			case client.send <- message:
			default:
				// Client's send channel is full, close it
				close(client.send)
				delete(room.clients, client)
			}
			break
		}
	}
}

// Global hub instance
var hub = NewHub()

func init() {
	// Start the hub
	go hub.Run()
}

// HandleWebSocket handles WebSocket connections with support for all frontend message types
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Extract roomID and userID from query parameters
	roomID := r.URL.Query().Get("roomId")
	userID := r.URL.Query().Get("userId")
	
	if roomID == "" || userID == "" {
		log.Printf("Missing roomId or userId parameters")
		conn.Close()
		return
	}

	client := &Client{
		conn:   conn,
		roomID: roomID,
		userID: userID,
		send:   make(chan SignalingMessage, 256),
	}

	// Register client with hub
	hub.register <- client

	// Start goroutines for reading and writing
	go client.readPump()
	go client.writePump()
}

// readPump handles incoming WebSocket messages
func (c *Client) readPump() {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	for {
		var message SignalingMessage
		err := c.conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Set the roomID and userID from client context if not set in message
		if message.RoomID == "" {
			message.RoomID = c.roomID
		}
		if message.UserID == "" {
			message.UserID = c.userID
		}

		// Handle different message types
		c.handleMessage(message)
	}
}

// writePump sends messages to the WebSocket connection
func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

// handleMessage processes different types of WebSocket messages
func (c *Client) handleMessage(message SignalingMessage) {
	switch message.Type {
	// Basic WebRTC signaling
	case "join":
		c.handleJoin(message)
	case "offer", "answer", "iceCandidate":
		c.handleWebRTCSignaling(message)
	case "getParticipants":
		c.handleGetParticipants(message)
		
	// Meeting control features
	case "raiseHand":
		c.handleRaiseHand(message)
	case "lowerHand":
		c.handleLowerHand(message)
	case "admitParticipant":
		c.handleAdmitParticipant(message)
	case "permissionRequest":
		c.handlePermissionRequest(message)
	case "meetingControl":
		c.handleMeetingControl(message)
		
	// Meeting lifecycle
	case "terminateMeeting", "endMeeting":
		c.handleEndMeeting(message)
		
	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

// Basic WebRTC signaling handlers
func (c *Client) handleJoin(message SignalingMessage) {
	// Send current participants list to the new user
	c.handleGetParticipants(message)
}

func (c *Client) handleWebRTCSignaling(message SignalingMessage) {
	// Relay WebRTC signaling messages to other clients in the room
	hub.broadcastToRoom(c.roomID, message, c)
}

func (c *Client) handleGetParticipants(message SignalingMessage) {
	hub.mutex.RLock()
	room, exists := hub.rooms[c.roomID]
	hub.mutex.RUnlock()
	
	if !exists {
		return
	}
	
	room.mutex.RLock()
	participants := make([]map[string]interface{}, 0, len(room.clients))
	for client := range room.clients {
		participants = append(participants, map[string]interface{}{
			"userId":   client.userID,
			"userName": client.userID, // Can be enhanced with actual user names
		})
	}
	room.mutex.RUnlock()
	
	response := SignalingMessage{
		Type: "participantsList",
		Payload: map[string]interface{}{
			"participants": participants,
		},
	}
	
	select {
	case c.send <- response:
	default:
		close(c.send)
	}
}

// Enhanced meeting control handlers
func (c *Client) handleRaiseHand(message SignalingMessage) {
	// Broadcast raise hand event to all participants
	broadcastMessage := SignalingMessage{
		Type:   "handRaised",
		UserID: c.userID,
		Payload: map[string]interface{}{
			"userId":   c.userID,
			"userName": c.userID,
			"timestamp": message.Payload,
		},
	}
	hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
}

func (c *Client) handleLowerHand(message SignalingMessage) {
	// Broadcast lower hand event to all participants
	broadcastMessage := SignalingMessage{
		Type:   "handLowered",
		UserID: c.userID,
		Payload: map[string]interface{}{
			"userId": c.userID,
		},
	}
	hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
}

func (c *Client) handleAdmitParticipant(message SignalingMessage) {
	// This would typically require admin permissions check
	// For now, just broadcast the admission
	broadcastMessage := SignalingMessage{
		Type:   "participantAdmitted",
		UserID: c.userID,
		Payload: message.Payload,
	}
	hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
}

func (c *Client) handlePermissionRequest(message SignalingMessage) {
	// Broadcast permission request to admins/hosts
	broadcastMessage := SignalingMessage{
		Type:   "permissionRequested",
		UserID: c.userID,
		Payload: map[string]interface{}{
			"requesterId": c.userID,
			"permission":  message.Payload,
		},
	}
	hub.broadcastToRoom(c.roomID, broadcastMessage, c)
}

func (c *Client) handleMeetingControl(message SignalingMessage) {
	// Handle various meeting control actions
	if payload, ok := message.Payload.(map[string]interface{}); ok {
		action, actionExists := payload["action"]
		if !actionExists {
			return
		}
		
		switch action {
		case "toggleLock":
			broadcastMessage := SignalingMessage{
				Type:   "meetingLockToggled",
				UserID: c.userID,
				Payload: payload,
			}
			hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
			
		case "muteAll":
			broadcastMessage := SignalingMessage{
				Type:   "allParticipantsMuted",
				UserID: c.userID,
				Payload: payload,
			}
			hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
			
		default:
			// Generic meeting control broadcast
			broadcastMessage := SignalingMessage{
				Type:   "meetingControlChanged",
				UserID: c.userID,
				Payload: payload,
			}
			hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
		}
	}
}

func (c *Client) handleEndMeeting(message SignalingMessage) {
	// Broadcast meeting end to all participants
	broadcastMessage := SignalingMessage{
		Type:   "meetingEnded",
		UserID: c.userID,
		Payload: map[string]interface{}{
			"endedBy": c.userID,
			"reason":  message.Payload,
		},
	}
	hub.broadcastToRoom(c.roomID, broadcastMessage, nil)
}
