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
