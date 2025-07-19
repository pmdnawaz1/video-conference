# Video Conference Backend

Simple WebRTC video conferencing backend server with WebSocket signaling.

## Quick Start

### 1. Install Dependencies
```bash
go mod tidy
```

### 2. Run the Server
```bash
# Development mode
go run main.go

# Or build and run
go build -o video-server .
./video-server
```

### 3. Server will start on:
- **HTTP Server**: `http://localhost:8081`
- **WebSocket**: `ws://localhost:8081/ws`

## Available Endpoints

### HTTP Endpoints
- `POST /createRoom` - Create a new room
- `GET /room/{roomId}` - Get room info  
- `GET /room/{roomId}/users` - Get users in room

### WebSocket Endpoint
- `ws://localhost:8081/ws` - WebRTC signaling

## Environment Setup

1. Copy environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings (optional - defaults work fine)

## Build Commands

```bash
# Development build
go build -o video-server .

# Production build
go build -ldflags="-s -w" -o video-server .

# Cross-platform builds
GOOS=linux GOARCH=amd64 go build -o video-server-linux .
GOOS=windows GOARCH=amd64 go build -o video-server-windows.exe .
GOOS=darwin GOARCH=amd64 go build -o video-server-mac .
```

## Testing

```bash
# Test server is running
curl http://localhost:8081/createRoom -X POST

# Should return: {"roomId":"room_1"}
```

## Features

- ✅ WebRTC peer-to-peer video calls
- ✅ Screen sharing
- ✅ Many-to-many video conferences  
- ✅ Real-time signaling via WebSocket
- ✅ Room management
- ✅ CORS support for frontend integration

## Project Structure

```
backend/
├── main.go              # Main server file
├── go.mod              # Go module dependencies
├── .env.example        # Environment variables template
├── README.md           # This file
├── migrations/         # Database schema (if needed later)
├── configs/           # Docker and nginx configs
└── docs/              # Documentation
```