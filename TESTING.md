# Video Conference Testing Guide

## 🚀 Quick Start Testing

### 1. Start Backend
```bash
cd backend/
./run.sh
```
Backend runs on: `http://localhost:8081`

### 2. Start Frontend
```bash
cd frontend/
npm run dev
```
Frontend runs on: `http://localhost:5173` (or next available port)

## 🧪 Testing Video Functionality

### Single User Test
1. Open browser to frontend URL
2. Click "Connect to Server"
3. Enter your name (e.g., "Alice")
4. Click "Create" to create a room
5. Click "Join Room"
6. **Expected**: You should see your own video stream

### Two Users Test (Multiple Tabs/Browsers)

#### First User:
1. Open frontend in Browser 1
2. Connect to server
3. Enter name "Alice"
4. Create room (note the Room ID, e.g., "room_1")
5. Join room

#### Second User:
1. Open frontend in Browser 2/Incognito
2. Connect to server
3. Enter name "Bob" 
4. Enter the Room ID from step 4 above
5. Join room

#### Expected Results:
- ✅ Alice should see her own video + Bob's video
- ✅ Bob should see his own video + Alice's video
- ✅ Debug panel shows: "Remote Streams: 1", "Connected Users: 1"
- ✅ Console logs show WebRTC signaling messages

## 🐛 Debugging

### Debug Information Available:
1. **Frontend Debug Panel**: Shows connection status and recent logs
2. **Browser Console**: Detailed WebRTC logs with emojis (🚀🎥📞🧊)
3. **Backend Logs**: WebSocket connections and room management

### Common Issues & Solutions:

#### "Failed to connect to server"
- ✅ Check backend is running on port 8081
- ✅ Check `curl http://localhost:8081/createRoom` works

#### "Failed to access camera/microphone"
- ✅ Allow camera/microphone permissions in browser
- ✅ Check other apps aren't using camera
- ✅ Try different browser

#### Video not showing between users
- ✅ Check both users are in same room ID
- ✅ Look for "Remote stream received" in debug logs
- ✅ Check WebRTC connection state in console
- ✅ Try refreshing both browsers

#### WebSocket connection fails
- ✅ Check CORS policy in browser console
- ✅ Verify WebSocket URL in .env file
- ✅ Check firewall isn't blocking port 8081

## 📊 What Should Work:

### ✅ Working Features:
- WebSocket connection between frontend/backend
- Room creation and joining
- Local video stream capture
- WebRTC peer-to-peer connections
- Remote video stream display
- Audio/video toggle controls
- Real-time debug information
- Multiple users in same room

### 🔄 Advanced Testing:
- Test with 3+ users in same room
- Test screen sharing (if implemented)
- Test network reconnection
- Test mobile browsers
- Test different network conditions

## 🔧 Environment Configuration:

### Backend Environment:
- No environment variables needed (hardcoded port 8081)

### Frontend Environment:
- `VITE_API_URL=http://localhost:8081`
- Automatically uses this for WebSocket connection

## 📝 Expected Console Output:

### Frontend Console (with working connection):
```
🚀 EnhancedWebRTCService initialized
🔌 Connecting to: ws://localhost:8081/ws
✅ WebSocket connected
🎥 Requesting user media...
✅ Got user media: MediaStream
🏠 Joining room: room_1 as user: Alice
📤 Sending join message: {type: "join", payload: {roomId: "room_1", userId: "Alice"}}
👋 User joined: Bob
🤝 Creating peer connection for: Bob
📹 Adding local stream tracks to peer connection
📞 Creating offer for: Bob
📤 Sending offer to: Bob
🎬 Received remote stream from: Bob MediaStream
```

### Backend Console:
```
Video platform backend server starting on :8081
User Alice joined room room_1
User Bob joined room room_1
```

If you see these logs, video sharing is working correctly! 🎉