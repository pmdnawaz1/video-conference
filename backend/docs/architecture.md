
# System Architecture

## Overview
The platform will consist of a Go backend (signaling server and room management) and a React frontend (WebRTC client). WebRTC will be used for real-time video, audio, and screen sharing.

## Go Backend (Signaling Server)
- **Technology**: Go, Pion WebRTC
- **Responsibilities**:
    - Handling WebRTC signaling (offer/answer, ICE candidates) via WebSockets.
    - Managing rooms and connected users.
    - Relaying signaling messages between peers.
    - Managing screen sharing state (who is sharing, and signaling others to stop).
    - Potentially handling STUN/TURN server integration (though for simplicity, we might initially rely on public STUN servers).

## React Frontend (WebRTC Client)
- **Technology**: React, WebRTC API (browser-native)
- **Responsibilities**:
    - User interface for joining rooms, displaying video feeds, and controlling media.
    - Capturing local audio/video streams.
    - Capturing screen share streams.
    - Establishing WebRTC peer connections with other users in the room.
    - Sending and receiving WebRTC signaling messages to/from the Go backend.
    - Displaying remote video and screen share streams.
    - Implementing the auto-shutoff logic for screen sharing.

## Data Flow
1. **User joins room**: Frontend sends a request to the backend to join a specific room.
2. **Signaling**: Backend facilitates the exchange of WebRTC offers, answers, and ICE candidates between peers via WebSockets.
3. **Media Streaming**: Once peer connections are established, video, audio, and screen share streams flow directly between peers (P2P) or via a TURN server if NAT traversal requires it.
4. **Screen Share Management**: When a user starts screen sharing, the frontend notifies the backend. The backend then broadcasts a message to all other users in the room to stop their screen shares.

## API Endpoints (Initial Thoughts)
- `/ws`: WebSocket endpoint for WebRTC signaling.
- `/joinRoom`: HTTP endpoint for joining a room (initial room setup).
- `/leaveRoom`: HTTP endpoint for leaving a room.
- `/startScreenShare`: WebSocket message to notify the server about starting screen share.
- `/stopScreenShare`: WebSocket message to notify the server about stopping screen share.
- `/screenShareActive`: WebSocket message from server to clients to indicate an active screen share and trigger auto-shutoff.




## Chosen Libraries and Frameworks

### Go Backend
- **WebRTC**: Pion (github.com/pion/webrtc)
- **WebSockets**: gorilla/websocket (github.com/gorilla/websocket) - for signaling
- **HTTP Server**: Standard Go `net/http` package

### React Frontend
- **Framework**: React.js
- **WebRTC**: Browser's native WebRTC API
- **UI Components**: Basic HTML/CSS, potentially a UI library like Material-UI or Ant Design if needed for more complex UI, but will start with basic elements.
- **WebSocket Client**: Native `WebSocket` API or a library like `websocket-ts`.




## Detailed API Endpoints

### WebSocket (`/ws`)
This will be the primary channel for WebRTC signaling messages.

**Messages from Client to Server:**
- `type: "join"`, `payload: { roomId: string, userId: string }`: A client requests to join a specific room.
- `type: "offer"`, `payload: { sdp: RTCSessionDescription, targetId: string }`: A client sends an SDP offer to another peer.
- `type: "answer"`, `payload: { sdp: RTCSessionDescription, targetId: string }`: A client sends an SDP answer to another peer.
- `type: "iceCandidate"`, `payload: { candidate: RTCIceCandidate, targetId: string }`: A client sends an ICE candidate to another peer.
- `type: "startScreenShare"`, `payload: { userId: string, roomId: string }`: A client notifies the server that it is starting a screen share.
- `type: "stopScreenShare"`, `payload: { userId: string, roomId: string }`: A client notifies the server that it is stopping a screen share.

**Messages from Server to Client:**
- `type: "userJoined"`, `payload: { userId: string }`: Notifies clients in a room that a new user has joined.
- `type: "userLeft"`, `payload: { userId: string }`: Notifies clients in a room that a user has left.
- `type: "offer"`, `payload: { sdp: RTCSessionDescription, senderId: string }`: Relays an SDP offer from another peer.
- `type: "answer"`, `payload: { sdp: RTCSessionDescription, senderId: string }`: Relays an SDP answer from another peer.
- `type: "iceCandidate"`, `payload: { candidate: RTCIceCandidate, senderId: string }`: Relays an ICE candidate from another peer.
- `type: "screenShareActive"`, `payload: { sharingUserId: string }`: Notifies clients in a room that a user has started screen sharing. This will trigger other clients to stop their screen shares.
- `type: "screenShareStopped"`, `payload: { stoppedUserId: string }`: Notifies clients in a room that a user has stopped screen sharing.

### HTTP Endpoints (for initial room setup and potentially other non-realtime actions)
- `POST /createRoom`: Creates a new room. Returns `roomId`.
- `GET /room/:roomId/users`: Returns a list of users currently in the room.




## WebRTC Connection Establishment Process

1. **User A joins a room**: User A's client connects to the WebSocket server and sends a `join` message with `roomId` and `userId`.
2. **Server notifies others**: The server broadcasts a `userJoined` message to all existing users in the `roomId` (e.g., User B, User C).
3. **Offer/Answer Exchange (User A to User B)**:
    - User A's client creates an `RTCPeerConnection`.
    - User A's client creates an SDP `offer` and sets it as its local description.
    - User A's client sends the `offer` to the server, targeting User B.
    - Server relays the `offer` to User B.
    - User B's client receives the `offer`, creates an `RTCPeerConnection`, sets the `offer` as its remote description.
    - User B's client creates an SDP `answer` and sets it as its local description.
    - User B's client sends the `answer` to the server, targeting User A.
    - Server relays the `answer` to User A.
    - User A's client receives the `answer` and sets it as its remote description.
4. **ICE Candidate Exchange**: Both User A and User B's clients gather ICE candidates (network information).
    - As candidates are gathered, each client sends `iceCandidate` messages to the server, targeting the other peer.
    - Server relays these `iceCandidate` messages.
    - Clients add received ICE candidates to their `RTCPeerConnection`.
5. **Media Streaming**: Once ICE candidates are exchanged and connectivity is established, media (audio/video) streams directly between User A and User B.
6. **Repeat for all peers**: This offer/answer and ICE exchange process is repeated for every pair of users in the room, establishing a mesh network of peer connections.

## Screen Sharing Mechanism and Auto-Shutoff Logic

1. **Starting Screen Share (User A)**:
    - User A's client captures the screen stream using `getDisplayMedia()`.
    - User A's client adds the screen stream to its existing `RTCPeerConnection`s with other users.
    - User A's client sends a `startScreenShare` message to the server.
2. **Server Broadcast**: The server receives `startScreenShare` from User A and broadcasts a `screenShareActive` message to all other users (User B, User C) in the same room, indicating that User A is now sharing their screen.
3. **Auto-Shutoff (User B, User C)**:
    - Upon receiving `screenShareActive` from the server, User B and User C's clients check if they are currently screen sharing.
    - If they are, they immediately stop their own screen share (e.g., by removing the screen track from their `RTCPeerConnection`s and stopping the `MediaStreamTrack`).
    - They also send a `stopScreenShare` message to the server to confirm they have stopped.
4. **Stopping Screen Share (User A)**:
    - When User A stops screen sharing (either manually or due to auto-shutoff), their client removes the screen track from `RTCPeerConnection`s and sends a `stopScreenShare` message to the server.
5. **Server Notification**: The server receives `stopScreenShare` from User A and broadcasts a `screenShareStopped` message to all other users in the room.


