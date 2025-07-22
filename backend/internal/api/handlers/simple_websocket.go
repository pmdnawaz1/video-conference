package handlers

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Simple WebSocket handler based on working commit a682bf4
// This provides video transfer functionality that was working

// SimpleMessage represents the message structure from working frontend
type SimpleMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// SimpleClient represents a WebSocket client
type SimpleClient struct {
	Conn   *websocket.Conn
	Send   chan SimpleMessage
	RoomID string
	UserID string
}

// SimpleRoom represents a meeting room
type SimpleRoom struct {
	ID      string
	Clients map[string]*SimpleClient
	mutex   sync.RWMutex
}

// SimpleHub manages rooms and clients
type SimpleHub struct {
	Rooms map[string]*SimpleRoom
	mutex sync.RWMutex
}

var simpleHub = &SimpleHub{
	Rooms: make(map[string]*SimpleRoom),
}

// Simple upgrader for WebSocket connections
var simpleUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// HandleSimpleWebSocket handles WebSocket connections using the working approach
func HandleSimpleWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("Simple WebSocket connection attempt from: %s", r.RemoteAddr)
	
	conn, err := simpleUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Simple WebSocket upgrade failed: %v", err)
		return
	}
	
	log.Printf("Simple WebSocket connection established successfully")

	client := &SimpleClient{
		Conn: conn,
		Send: make(chan SimpleMessage, 256),
	}

	go client.writePump()
	go client.readPump()
}

func (c *SimpleClient) readPump() {
	defer func() {
		c.leaveRoom()
		c.Conn.Close()
	}()

	for {
		var msg SimpleMessage
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("Simple WebSocket read error: %v", err)
			break
		}

		c.handleMessage(msg)
	}
}

func (c *SimpleClient) writePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("Simple WebSocket write error: %v", err)
				return
			}
		}
	}
}

func (c *SimpleClient) handleMessage(msg SimpleMessage) {
	log.Printf("Simple WebSocket handling message type: %s", msg.Type)
	
	switch msg.Type {
	case "join":
		c.handleJoinRoom(msg.Payload)
	case "offer":
		c.forwardToTarget(msg)
	case "answer":
		c.forwardToTarget(msg)
	case "iceCandidate":
		c.forwardToTarget(msg)
	default:
		log.Printf("Unknown simple message type: %s", msg.Type)
	}
}

func (c *SimpleClient) handleJoinRoom(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid join room payload")
		return
	}

	roomID, _ := data["roomId"].(string)
	userID, _ := data["userId"].(string)

	if roomID == "" || userID == "" {
		log.Printf("Missing roomId or userId in join request")
		return
	}

	log.Printf("User %s joining room %s", userID, roomID)

	c.RoomID = roomID
	c.UserID = userID

	// Get or create room
	simpleHub.mutex.Lock()
	room, exists := simpleHub.Rooms[roomID]
	if !exists {
		room = &SimpleRoom{
			ID:      roomID,
			Clients: make(map[string]*SimpleClient),
		}
		simpleHub.Rooms[roomID] = room
		log.Printf("Created new simple room: %s", roomID)
	}
	simpleHub.mutex.Unlock()

	// Add client to room
	room.mutex.Lock()
	room.Clients[userID] = c
	room.mutex.Unlock()

	log.Printf("User %s joined room %s (total clients: %d)", userID, roomID, len(room.Clients))

	// Notify other users in the room
	c.broadcastToRoom(SimpleMessage{
		Type: "userJoined",
		Payload: map[string]interface{}{
			"userId":   userID,
			"userName": userID,
		},
	}, userID)
}

func (c *SimpleClient) forwardToTarget(msg SimpleMessage) {
	if c.RoomID == "" {
		log.Printf("Client not in room, cannot forward message")
		return
	}

	// Extract target information from payload
	data, ok := msg.Payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid payload for forwarding")
		return
	}

	targetID, hasTarget := data["targetId"].(string)
	
	if hasTarget {
		// Forward to specific target
		c.sendToUser(targetID, SimpleMessage{
			Type: msg.Type,
			Payload: map[string]interface{}{
				"senderId":  c.UserID,
				"sdp":       data["sdp"],
				"candidate": data["candidate"],
			},
		})
	} else {
		// Broadcast to all users in room except sender
		c.broadcastToRoom(msg, c.UserID)
	}
}

func (c *SimpleClient) sendToUser(targetID string, msg SimpleMessage) {
	simpleHub.mutex.RLock()
	room, exists := simpleHub.Rooms[c.RoomID]
	simpleHub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	target, exists := room.Clients[targetID]
	room.mutex.RUnlock()

	if exists {
		select {
		case target.Send <- msg:
			log.Printf("Forwarded %s from %s to %s", msg.Type, c.UserID, targetID)
		default:
			log.Printf("Failed to send to %s, channel full", targetID)
		}
	}
}

func (c *SimpleClient) broadcastToRoom(msg SimpleMessage, excludeUserID string) {
	simpleHub.mutex.RLock()
	room, exists := simpleHub.Rooms[c.RoomID]
	simpleHub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	clients := make([]*SimpleClient, 0, len(room.Clients))
	for userID, client := range room.Clients {
		if userID != excludeUserID {
			clients = append(clients, client)
		}
	}
	room.mutex.RUnlock()

	log.Printf("Broadcasting %s to %d clients in room %s", msg.Type, len(clients), c.RoomID)

	for _, client := range clients {
		select {
		case client.Send <- msg:
		default:
			log.Printf("Failed to broadcast to client, channel full")
		}
	}
}

func (c *SimpleClient) leaveRoom() {
	if c.RoomID == "" || c.UserID == "" {
		return
	}

	log.Printf("User %s leaving room %s", c.UserID, c.RoomID)

	simpleHub.mutex.RLock()
	room, exists := simpleHub.Rooms[c.RoomID]
	simpleHub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.Lock()
	delete(room.Clients, c.UserID)
	clientCount := len(room.Clients)
	room.mutex.Unlock()

	// Notify other users
	c.broadcastToRoom(SimpleMessage{
		Type: "userLeft",
		Payload: map[string]interface{}{
			"userId": c.UserID,
		},
	}, c.UserID)

	// Remove room if empty
	if clientCount == 0 {
		simpleHub.mutex.Lock()
		delete(simpleHub.Rooms, c.RoomID)
		simpleHub.mutex.Unlock()
		log.Printf("Removed empty room: %s", c.RoomID)
	}
}