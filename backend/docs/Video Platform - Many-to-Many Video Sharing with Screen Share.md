# Video Platform - Many-to-Many Video Sharing with Screen Share

A real-time video sharing platform built with Go (Pion WebRTC) backend and React frontend, featuring many-to-many video calls and intelligent screen sharing with automatic shutoff.

## Features

- **Many-to-Many Video Calls**: Support for multiple participants in a single room
- **Real-time Audio/Video**: High-quality audio and video streaming using WebRTC
- **Screen Sharing**: Share your screen with automatic shutoff when another user starts sharing
- **Room Management**: Create and join rooms with unique room IDs
- **Responsive UI**: Modern, clean interface built with React and Tailwind CSS
- **Cross-Platform**: Works on desktop and mobile browsers

## Architecture

### Backend (Go + Pion WebRTC)
- WebSocket-based signaling server
- Room management and user tracking
- WebRTC offer/answer/ICE candidate relay
- Screen sharing state management
- CORS-enabled for frontend integration

### Frontend (React)
- Modern React application with hooks
- WebRTC client implementation
- Real-time video/audio controls
- Screen sharing with auto-shutoff logic
- Responsive design with Tailwind CSS

## Prerequisites

- Go 1.21+ 
- Node.js 20+
- pnpm (or npm/yarn)
- Modern web browser with WebRTC support

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd video-platform

# Setup backend
cd backend
go mod tidy

# Setup frontend
cd ../frontend
pnpm install
```

### 2. Start the Backend Server

```bash
cd backend
go build -o server main.go
./server
```

The backend server will start on `http://localhost:8081`

### 3. Start the Frontend Development Server

```bash
cd frontend
pnpm run dev --host
```

The frontend will be available at `http://localhost:5173`

### 4. Access the Application

1. Open your browser and navigate to `http://localhost:5173`
2. Click "Connect to Server"
3. Enter your name and either:
   - Click "Create" to create a new room
   - Enter an existing room ID and click "Join Room"
4. Allow camera/microphone access when prompted
5. Start video chatting!

## Usage

### Creating a Room
1. Enter your name
2. Click the "Create" button
3. A unique room ID will be generated automatically
4. Click "Join Room" to enter the video call

### Joining an Existing Room
1. Enter your name
2. Enter the room ID shared by another participant
3. Click "Join Room"

### Video Controls
- **Camera Toggle**: Click the video icon to turn your camera on/off
- **Microphone Toggle**: Click the microphone icon to mute/unmute
- **Screen Share**: Click the monitor icon to start/stop screen sharing
- **Leave Room**: Click the red "Leave Room" button to exit

### Screen Sharing
- Only one person can share their screen at a time
- When someone starts screen sharing, others' screen shares automatically stop
- Screen sharing includes both video and audio from the shared screen
- Click the screen share button again to stop sharing

## Configuration

### Backend Configuration
The backend server can be configured by modifying `main.go`:

- **Port**: Change the port in the `ListenAndServe` call (default: 8081)
- **CORS**: Modify CORS headers for production deployment
- **STUN/TURN servers**: Add your own STUN/TURN servers for better NAT traversal

### Frontend Configuration
The frontend can be configured in the WebRTC service files:

- **Server URL**: Update the WebSocket connection URL in `webrtc.js` or `webrtc-test.js`
- **ICE Servers**: Add your own STUN/TURN servers in the WebRTC service
- **UI Styling**: Modify Tailwind CSS classes in React components

## Deployment

### Production Backend Deployment

1. **Build the Go binary**:
   ```bash
   cd backend
   go build -o video-platform-server main.go
   ```

2. **Deploy to your server**:
   ```bash
   # Copy binary to your server
   scp video-platform-server user@your-server:/path/to/deployment/
   
   # Run on server (consider using systemd or docker)
   ./video-platform-server
   ```

3. **Configure reverse proxy** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8081;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Production Frontend Deployment

1. **Build the React app**:
   ```bash
   cd frontend
   pnpm run build
   ```

2. **Deploy the built files**:
   ```bash
   # Copy dist folder to your web server
   scp -r dist/* user@your-server:/var/www/html/
   ```

3. **Update API endpoints**: Before building, update the WebSocket and API URLs in the frontend code to point to your production backend.

### Environment Variables

For production deployment, consider using environment variables:

**Backend**:
- `PORT`: Server port (default: 8081)
- `CORS_ORIGIN`: Allowed CORS origins

**Frontend**:
- `VITE_API_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket URL

## Development

### Project Structure

```
video-platform/
├── backend/
│   ├── main.go              # Go server with WebRTC signaling
│   ├── go.mod               # Go dependencies
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # WebRTC service layer
│   │   ├── App.jsx          # Main application component
│   │   └── main.jsx         # React entry point
│   ├── package.json         # Node.js dependencies
│   └── vite.config.js       # Vite configuration
└── README.md
```

### Adding Features

1. **Backend**: Modify `main.go` to add new WebSocket message types and handlers
2. **Frontend**: Update the WebRTC service and React components
3. **Testing**: Use the test WebRTC service for development without real media devices

### Testing Without Media Devices

The project includes a test WebRTC service (`webrtc-test.js`) that creates mock video streams for testing in environments without camera/microphone access.

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**:
   - Ensure the backend server is running on the correct port
   - Check firewall settings
   - Verify CORS configuration

2. **Camera/Microphone Access Denied**:
   - Grant browser permissions for media access
   - Use HTTPS in production (required for getUserMedia)
   - Use the test service for development

3. **Video Not Displaying**:
   - Check browser console for WebRTC errors
   - Verify ICE candidate exchange
   - Test with different browsers

4. **Screen Sharing Not Working**:
   - Ensure browser supports getDisplayMedia API
   - Check for browser permissions
   - Use HTTPS in production

### Browser Compatibility

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Security Considerations

For production deployment:

1. **Use HTTPS**: Required for camera/microphone access
2. **Configure CORS**: Restrict origins to your domain
3. **Add Authentication**: Implement user authentication if needed
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **TURN Server**: Use authenticated TURN servers for NAT traversal

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Test with the included test service
4. Open an issue with detailed information

---

Built with ❤️ using Go, Pion WebRTC, React, and modern web technologies.

