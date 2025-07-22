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

// HandleWebSocket handles WebSocket connections for video conferencing
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("WebSocket connection attempt from: %s", r.RemoteAddr)
	
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		http.Error(w, "WebSocket upgrade failed", http.StatusBadRequest)
		return
	}
	
	log.Printf("WebSocket connection established successfully")

	// Get room ID and user ID from query parameters (legacy support)
	roomID := r.URL.Query().Get("roomId")
	userID := r.URL.Query().Get("userId")

	// Create new client - will be set from join message if not provided
	client := &Client{
		conn:   conn,
		roomID: roomID,
		userID: userID,
		send:   make(chan SignalingMessage, 256),
	}

	// Start goroutines for handling client
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		if c.roomID != "" && c.userID != "" {
			hub.unregister <- c
		}
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

		// Handle different message types
		switch message.Type {
		case "join":
			// Handle join message from frontend
			if payload, ok := message.Payload.(map[string]interface{}); ok {
				if roomId, ok := payload["roomId"].(string); ok {
					c.roomID = roomId
					log.Printf("User joining room: %s", roomId)
				}
				if userId, ok := payload["userId"].(string); ok {
					c.userID = userId
					log.Printf("User ID: %s", userId)
				}
				if userName, ok := payload["userName"].(string); ok {
					log.Printf("User name: %s", userName)
				}
				// Register client after getting room/user info
				log.Printf("Registering client %s to room %s", c.userID, c.roomID)
				hub.register <- c
			}
		case "offer", "answer", "iceCandidate":
			// Set the sender information and forward to target
			if payload, ok := message.Payload.(map[string]interface{}); ok {
				if targetId, ok := payload["targetId"].(string); ok {
					// Send message to specific target
					hub.broadcastToUser(c.roomID, targetId, SignalingMessage{
						Type: message.Type,
						Payload: map[string]interface{}{
							"senderId": c.userID,
							"sdp":      payload["sdp"],
							"candidate": payload["candidate"],
						},
					})
				}
			}
		case "chat":
			// Broadcast chat messages to all clients in the room
			message.RoomID = c.roomID
			message.UserID = c.userID
			hub.broadcast <- message
		default:
			log.Printf("Unknown message type: %s", message.Type)
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// The hub closed the channel
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