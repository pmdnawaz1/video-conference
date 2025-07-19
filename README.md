# Video Conference Application

Simple WebRTC video conferencing application with real-time signaling.

## Quick Start

### 1. Start Backend Server
```bash
cd backend/
./run.sh
```
Backend will start on: `http://localhost:8081`

### 2. Start Frontend (New Terminal)
```bash
cd frontend/
npm install
npm run dev
```
Frontend will start on: `http://localhost:5173` (or next available port)

### 3. Test the Application
1. Open browser to frontend URL
2. Click "Connect to Server"
3. Enter your name and either:
   - Create a new room, or
   - Join existing room with Room ID

## Project Structure

```
video-conference/
├── backend/                # Go WebRTC server
│   ├── main.go            # Main server file
│   ├── .env               # Backend environment
│   └── run.sh             # Start script
├── frontend/              # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main working app
│   │   ├── components/    # UI components
│   │   └── services/      # WebRTC & API services
│   ├── .env               # Frontend environment
│   └── package.json       # Dependencies
└── README.md              # This file
```

## Environment Variables

### Backend (`.env`)
Currently no environment variables used - server runs on hardcoded port 8081.

### Frontend (`.env`)
```bash
VITE_API_BASE_URL=http://localhost:8081/api
VITE_API_URL=http://localhost:8081
```

## Features

- ✅ WebRTC peer-to-peer video calls
- ✅ Screen sharing
- ✅ Many-to-many video conferences
- ✅ Real-time signaling via WebSocket
- ✅ Room management
- ✅ CORS support

## API Endpoints

- `POST /createRoom` - Create new room
- `GET /room/{id}` - Get room info
- `ws://localhost:8081/ws` - WebSocket signaling

## Troubleshooting

### Frontend won't start
```bash
cd frontend/
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend won't start
```bash
cd backend/
go mod tidy
go build -o video-server .
./video-server
```