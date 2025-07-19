package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

// Message types for WebSocket communication
type MessageType string

const (
	JoinRoom         MessageType = "join"
	UserJoined       MessageType = "userJoined"
	UserLeft         MessageType = "userLeft"
	Offer            MessageType = "offer"
	Answer           MessageType = "answer"
	IceCandidate     MessageType = "iceCandidate"
	StartScreenShare MessageType = "startScreenShare"
	StopScreenShare  MessageType = "stopScreenShare"
	ScreenShareActive MessageType = "screenShareActive"
	ScreenShareStopped MessageType = "screenShareStopped"
)

// WebSocket message structure
type Message struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

// Join room payload
type JoinPayload struct {
	RoomID string `json:"roomId"`
	UserID string `json:"userId"`
}

// WebRTC signaling payloads
type OfferPayload struct {
	SDP      webrtc.SessionDescription `json:"sdp"`
	TargetID string                    `json:"targetId"`
	SenderID string                    `json:"senderId,omitempty"`
}

type AnswerPayload struct {
	SDP      webrtc.SessionDescription `json:"sdp"`
	TargetID string                    `json:"targetId"`
	SenderID string                    `json:"senderId,omitempty"`
}

type IceCandidatePayload struct {
	Candidate webrtc.ICECandidate `json:"candidate"`
	TargetID  string              `json:"targetId"`
	SenderID  string              `json:"senderId,omitempty"`
}

// Screen share payloads
type ScreenSharePayload struct {
	UserID string `json:"userId"`
	RoomID string `json:"roomId"`
}

// Client represents a connected WebSocket client
type Client struct {
	ID     string
	RoomID string
	Conn   *websocket.Conn
	Send   chan Message
}

// Room represents a video chat room
type Room struct {
	ID              string
	Clients         map[string]*Client
	ScreenSharingUser string // ID of user currently sharing screen
	mutex           sync.RWMutex
}

// Hub manages all rooms and clients
type Hub struct {
	Rooms   map[string]*Room
	mutex   sync.RWMutex
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin for development
		return true
	},
}

var hub = &Hub{
	Rooms: make(map[string]*Room),
}

func main() {
	// Enable CORS for all routes
	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/createRoom", handleCreateRoom)
	http.HandleFunc("/room/", handleRoomInfo)

	// Add CORS headers to all responses
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		w.WriteHeader(http.StatusNotFound)
	})

	fmt.Println("Video platform backend server starting on :8081")
	log.Fatal(http.ListenAndServe("0.0.0.0:8081", nil))
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		Conn: conn,
		Send: make(chan Message, 256),
	}

	go client.writePump()
	go client.readPump()
}

func handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	roomID := generateRoomID()
	
	hub.mutex.Lock()
	hub.Rooms[roomID] = &Room{
		ID:      roomID,
		Clients: make(map[string]*Client),
	}
	hub.mutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"roomId": roomID})
}

func handleRoomInfo(w http.ResponseWriter, r *http.Request) {
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Extract room ID from URL path
	roomID := r.URL.Path[len("/room/"):]
	if len(roomID) == 0 {
		http.Error(w, "Room ID required", http.StatusBadRequest)
		return
	}

	// Remove "/users" suffix if present
	if len(roomID) > 6 && roomID[len(roomID)-6:] == "/users" {
		roomID = roomID[:len(roomID)-6]
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[roomID]
	hub.mutex.RUnlock()

	if !exists {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	room.mutex.RLock()
	userIDs := make([]string, 0, len(room.Clients))
	for userID := range room.Clients {
		userIDs = append(userIDs, userID)
	}
	room.mutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"roomId": roomID,
		"users":  userIDs,
	})
}

func generateRoomID() string {
	// Simple room ID generation - in production, use a more robust method
	return fmt.Sprintf("room_%d", len(hub.Rooms)+1)
}

func (c *Client) readPump() {
	defer func() {
		c.leaveRoom()
		c.Conn.Close()
	}()

	for {
		var msg Message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case JoinRoom:
		c.handleJoinRoom(msg.Payload)
	case Offer:
		c.handleOffer(msg.Payload)
	case Answer:
		c.handleAnswer(msg.Payload)
	case IceCandidate:
		c.handleIceCandidate(msg.Payload)
	case StartScreenShare:
		c.handleStartScreenShare(msg.Payload)
	case StopScreenShare:
		c.handleStopScreenShare(msg.Payload)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

func (c *Client) handleJoinRoom(payload interface{}) {
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

	c.ID = userID
	c.RoomID = roomID

	hub.mutex.Lock()
	room, exists := hub.Rooms[roomID]
	if !exists {
		room = &Room{
			ID:      roomID,
			Clients: make(map[string]*Client),
		}
		hub.Rooms[roomID] = room
	}
	hub.mutex.Unlock()

	room.mutex.Lock()
	room.Clients[userID] = c
	room.mutex.Unlock()

	// Notify other users in the room
	c.broadcastToRoom(Message{
		Type: UserJoined,
		Payload: map[string]string{
			"userId": userID,
		},
	}, true) // exclude self

	log.Printf("User %s joined room %s", userID, roomID)
}

func (c *Client) handleOffer(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid offer payload")
		return
	}

	targetID, _ := data["targetId"].(string)
	if targetID == "" {
		log.Printf("Missing targetId in offer")
		return
	}

	// Add sender ID to payload
	data["senderId"] = c.ID

	c.sendToUser(targetID, Message{
		Type:    Offer,
		Payload: data,
	})
}

func (c *Client) handleAnswer(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid answer payload")
		return
	}

	targetID, _ := data["targetId"].(string)
	if targetID == "" {
		log.Printf("Missing targetId in answer")
		return
	}

	// Add sender ID to payload
	data["senderId"] = c.ID

	c.sendToUser(targetID, Message{
		Type:    Answer,
		Payload: data,
	})
}

func (c *Client) handleIceCandidate(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid ICE candidate payload")
		return
	}

	targetID, _ := data["targetId"].(string)
	if targetID == "" {
		log.Printf("Missing targetId in ICE candidate")
		return
	}

	// Add sender ID to payload
	data["senderId"] = c.ID

	c.sendToUser(targetID, Message{
		Type:    IceCandidate,
		Payload: data,
	})
}

func (c *Client) handleStartScreenShare(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid start screen share payload")
		return
	}

	roomID, _ := data["roomId"].(string)
	if roomID != c.RoomID {
		log.Printf("Room ID mismatch in screen share request")
		return
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[roomID]
	hub.mutex.RUnlock()

	if !exists {
		log.Printf("Room not found for screen share: %s", roomID)
		return
	}

	room.mutex.Lock()
	room.ScreenSharingUser = c.ID
	room.mutex.Unlock()

	// Notify all other users to stop their screen shares
	c.broadcastToRoom(Message{
		Type: ScreenShareActive,
		Payload: map[string]string{
			"sharingUserId": c.ID,
		},
	}, true) // exclude self

	log.Printf("User %s started screen sharing in room %s", c.ID, roomID)
}

func (c *Client) handleStopScreenShare(payload interface{}) {
	data, ok := payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid stop screen share payload")
		return
	}

	roomID, _ := data["roomId"].(string)
	if roomID != c.RoomID {
		log.Printf("Room ID mismatch in stop screen share request")
		return
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[roomID]
	hub.mutex.RUnlock()

	if !exists {
		log.Printf("Room not found for stop screen share: %s", roomID)
		return
	}

	room.mutex.Lock()
	if room.ScreenSharingUser == c.ID {
		room.ScreenSharingUser = ""
	}
	room.mutex.Unlock()

	// Notify all users that screen sharing has stopped
	c.broadcastToRoom(Message{
		Type: ScreenShareStopped,
		Payload: map[string]string{
			"stoppedUserId": c.ID,
		},
	}, false) // include self

	log.Printf("User %s stopped screen sharing in room %s", c.ID, roomID)
}

func (c *Client) sendToUser(userID string, msg Message) {
	if c.RoomID == "" {
		return
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[c.RoomID]
	hub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	targetClient, exists := room.Clients[userID]
	room.mutex.RUnlock()

	if exists {
		select {
		case targetClient.Send <- msg:
		default:
			close(targetClient.Send)
		}
	}
}

func (c *Client) broadcastToRoom(msg Message, excludeSelf bool) {
	if c.RoomID == "" {
		return
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[c.RoomID]
	hub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.RLock()
	for userID, client := range room.Clients {
		if excludeSelf && userID == c.ID {
			continue
		}

		select {
		case client.Send <- msg:
		default:
			close(client.Send)
		}
	}
	room.mutex.RUnlock()
}

func (c *Client) leaveRoom() {
	if c.RoomID == "" || c.ID == "" {
		return
	}

	hub.mutex.RLock()
	room, exists := hub.Rooms[c.RoomID]
	hub.mutex.RUnlock()

	if !exists {
		return
	}

	room.mutex.Lock()
	delete(room.Clients, c.ID)
	
	// If this user was screen sharing, clear the screen sharing state
	if room.ScreenSharingUser == c.ID {
		room.ScreenSharingUser = ""
	}
	room.mutex.Unlock()

	// Notify other users that this user left
	c.broadcastToRoom(Message{
		Type: UserLeft,
		Payload: map[string]string{
			"userId": c.ID,
		},
	}, true) // exclude self

	log.Printf("User %s left room %s", c.ID, c.RoomID)
}

