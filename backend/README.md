# Video Conference Backend

Node.js TypeScript WebRTC signaling server for video conferencing platform.

## Features

- 🎥 WebRTC signaling server with Socket.IO
- 🏠 Room management with user tracking  
- 🖥️ Screen sharing with automatic conflict resolution
- 💬 Real-time chat messaging
- 🔐 JWT-based authentication (planned)
- 📊 User analytics and meeting management (planned)
- 🐳 Docker support with multi-stage builds

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration

# Start development server
npm run dev
```

Server will start on `http://localhost:8081`

### Docker Development

```bash
# Start all services (backend, postgres, redis)
docker-compose up -d

# View logs
docker-compose logs -f video-conference-backend

# Stop services
docker-compose down
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT` - Server port (default: 8081)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens
- `CORS_ORIGIN` - Frontend URL for CORS

## API Endpoints

### REST API
- `GET /health` - Health check
- `GET /api/webrtc-config` - WebRTC ICE server configuration
- `POST /api/createRoom` - Create new room
- `GET /api/room/:roomId` - Get room information

### WebSocket Events

**Client → Server:**
- `join-server` - Connect to signaling server
- `create-room` - Create new meeting room
- `join-room` - Join existing room
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange
- `start-screen-share` / `stop-screen-share` - Screen sharing
- `toggle-audio` / `toggle-video` - Media state changes
- `chat-message` - Send chat message
- `leave-room` - Leave current room

**Server → Client:**
- `server-joined` - Server connection confirmed
- `room-created` - Room creation success
- `room-joined` - Room join success
- `user-joined` / `user-left` - User presence updates
- `offer` / `answer` / `ice-candidate` - WebRTC signaling
- `screen-share-started` / `screen-share-stopped` - Screen share events
- `user-media-state` - Media state updates
- `chat-message` - Chat message broadcast
- `error` - Error messages

## Scripts

- `npm run dev` - Development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database

## Architecture

```
src/
├── config/          # Configuration management
├── middleware/      # Express middleware (planned)
├── routes/          # API routes (planned)
├── services/        # Business logic and Socket.IO handlers
├── types/           # TypeScript type definitions
├── utils/           # Utility functions (planned)
└── index.ts         # Application entry point
```

## Development Status

✅ **Completed:**
- Basic TypeScript project setup
- Socket.IO WebRTC signaling server
- Room management and user tracking
- Screen sharing with conflict resolution
- Real-time chat messaging
- Docker configuration
- Health monitoring

🚧 **In Progress:**
- Database integration with Prisma
- JWT authentication system
- REST API endpoints
- User management

📋 **Planned:**
- Recording functionality
- Analytics and reporting
- Email notifications
- Admin dashboard
- Comprehensive testing