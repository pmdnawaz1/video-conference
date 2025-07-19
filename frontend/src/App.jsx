import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, Users, Phone, PhoneOff } from 'lucide-react'
import ChatInterface from '@/components/chat/ChatInterface.jsx'
import useAppStore from '@/stores/appStore.js'

// Enhanced WebRTC Service with better debugging
class EnhancedWebRTCService {
  constructor() {
    this.localStream = null;
    this.peerConnections = new Map();
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.onRemoteStreamCallback = null;
    this.onRemoteStreamRemovedCallback = null;
    this.onUserJoinedCallback = null;
    this.onUserLeftCallback = null;
    this.onScreenShareActiveCallback = null;
    this.onScreenShareStoppedCallback = null;
    this.onChatMessageCallback = null;

    // STUN servers for NAT traversal
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    console.log('🚀 EnhancedWebRTCService initialized');
  }

  // Initialize WebSocket connection
  connect(serverUrl = `${import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8081'}/ws`) {
    console.log('🔌 Connecting to:', serverUrl);
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(serverUrl);

      this.socket.onopen = () => {
        console.log('✅ WebSocket connected');
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📥 Received message:', message);
        this.handleSignalingMessage(message);
      };

      this.socket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
      };
    });
  }

  // Get user media with better error handling
  async getUserMedia() {
    console.log('🎥 Requesting user media...');
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      console.log('✅ Got user media:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw error;
    }
  }

  // Join a room
  joinRoom(roomId, userId) {
    console.log('🏠 Joining room:', roomId, 'as user:', userId);
    this.roomId = roomId;
    this.userId = userId;

    const message = {
      type: 'join',
      payload: {
        roomId: roomId,
        userId: userId
      }
    };

    console.log('📤 Sending join message:', message);
    this.sendMessage(message);
  }

  // Create peer connection with enhanced logging
  createPeerConnection(remoteUserId) {
    console.log('🤝 Creating peer connection for:', remoteUserId);
    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Add local stream to peer connection
    if (this.localStream) {
      console.log('📹 Adding local stream tracks to peer connection');
      this.localStream.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind);
        peerConnection.addTrack(track, this.localStream);
      });
    } else {
      console.warn('⚠️ No local stream to add to peer connection');
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('🎬 Received remote stream from:', remoteUserId, event.streams[0]);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteUserId, event.streams[0]);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', remoteUserId);
        this.sendMessage({
          type: 'iceCandidate',
          payload: {
            candidate: event.candidate,
            targetId: remoteUserId
          }
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${remoteUserId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed') {
        this.removePeerConnection(remoteUserId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${remoteUserId}:`, peerConnection.iceConnectionState);
    };

    this.peerConnections.set(remoteUserId, peerConnection);
    return peerConnection;
  }

  // Create and send offer
  async createOffer(remoteUserId) {
    console.log('📞 Creating offer for:', remoteUserId);
    const peerConnection = this.createPeerConnection(remoteUserId);
    
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('📤 Sending offer to:', remoteUserId);

      this.sendMessage({
        type: 'offer',
        payload: {
          sdp: offer,
          targetId: remoteUserId
        }
      });
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  }

  // Handle incoming offer
  async handleOffer(senderId, offer) {
    console.log('📞 Handling offer from:', senderId);
    const peerConnection = this.createPeerConnection(senderId);

    try {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('📤 Sending answer to:', senderId);

      this.sendMessage({
        type: 'answer',
        payload: {
          sdp: answer,
          targetId: senderId
        }
      });
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  // Handle incoming answer
  async handleAnswer(senderId, answer) {
    console.log('📞 Handling answer from:', senderId);
    const peerConnection = this.peerConnections.get(senderId);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(answer);
        console.log('✅ Answer processed for:', senderId);
      } catch (error) {
        console.error('❌ Error handling answer:', error);
      }
    } else {
      console.error('❌ No peer connection found for:', senderId);
    }
  }

  // Handle incoming ICE candidate
  async handleIceCandidate(senderId, candidate) {
    console.log('🧊 Handling ICE candidate from:', senderId);
    const peerConnection = this.peerConnections.get(senderId);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log('✅ ICE candidate added for:', senderId);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.error('❌ No peer connection found for ICE candidate from:', senderId);
    }
  }

  // Handle signaling messages
  handleSignalingMessage(message) {
    const { type, payload } = message;
    console.log('📨 Processing message type:', type, payload);

    switch (type) {
      case 'userJoined':
        console.log('👋 User joined:', payload.userId);
        if (this.onUserJoinedCallback) {
          this.onUserJoinedCallback(payload.userId);
        }
        // Create offer for new user
        this.createOffer(payload.userId);
        break;

      case 'userLeft':
        console.log('👋 User left:', payload.userId);
        this.removePeerConnection(payload.userId);
        if (this.onUserLeftCallback) {
          this.onUserLeftCallback(payload.userId);
        }
        break;

      case 'offer':
        console.log('📞 Received offer from:', payload.senderId);
        this.handleOffer(payload.senderId, payload.sdp);
        break;

      case 'answer':
        console.log('📞 Received answer from:', payload.senderId);
        this.handleAnswer(payload.senderId, payload.sdp);
        break;

      case 'iceCandidate':
        console.log('🧊 Received ICE candidate from:', payload.senderId);
        this.handleIceCandidate(payload.senderId, payload.candidate);
        break;

      case 'screenShareActive':
        console.log('🖥️ Screen share active by:', payload.sharingUserId);
        if (this.onScreenShareActiveCallback) {
          this.onScreenShareActiveCallback(payload.sharingUserId);
        }
        break;

      case 'screenShareStopped':
        console.log('🖥️ Screen share stopped by:', payload.stoppedUserId);
        if (this.onScreenShareStoppedCallback) {
          this.onScreenShareStoppedCallback(payload.stoppedUserId);
        }
        break;

      case 'chatMessage':
        console.log('💬 Received chat message from:', payload.senderId);
        if (this.onChatMessageCallback) {
          this.onChatMessageCallback(payload.senderId, payload.message);
        }
        break;

      default:
        console.log('❓ Unknown message type:', type);
    }
  }

  // Remove peer connection
  removePeerConnection(remoteUserId) {
    console.log('🗑️ Removing peer connection for:', remoteUserId);
    const peerConnection = this.peerConnections.get(remoteUserId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(remoteUserId);
      
      if (this.onRemoteStreamRemovedCallback) {
        this.onRemoteStreamRemovedCallback(remoteUserId);
      }
    }
  }

  // Send message via WebSocket
  sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending message:', message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket not connected, cannot send message');
    }
  }

  // Set callbacks
  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  onRemoteStreamRemoved(callback) {
    this.onRemoteStreamRemovedCallback = callback;
  }

  onUserJoined(callback) {
    this.onUserJoinedCallback = callback;
  }

  onUserLeft(callback) {
    this.onUserLeftCallback = callback;
  }

  onScreenShareActive(callback) {
    this.onScreenShareActiveCallback = callback;
  }

  onScreenShareStopped(callback) {
    this.onScreenShareStoppedCallback = callback;
  }

  onChatMessage(callback) {
    this.onChatMessageCallback = callback;
  }

  // Send chat message
  sendChatMessage(roomId, messageData) {
    const message = {
      type: 'chatMessage',
      payload: {
        roomId: roomId,
        message: messageData
      }
    };
    
    console.log('💬 Sending chat message:', messageData);
    this.sendMessage(message);
  }

  // Cleanup
  disconnect() {
    console.log('🧹 Disconnecting...');
    // Close all peer connections
    for (const [userId, peerConnection] of this.peerConnections) {
      peerConnection.close();
    }
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Close WebSocket
    if (this.socket) {
      this.socket.close();
    }
  }
}

function App() {
  // Zustand store
  const {
    isConnected,
    roomId,
    userId,
    isInRoom,
    isVideoEnabled,
    isAudioEnabled,
    connectedUsers,
    debugLogs,
    isChatOpen,
    setConnectionState,
    setRoomState,
    setMediaState,
    addConnectedUser,
    removeConnectedUser,
    clearConnectedUsers,
    setChatOpen,
    addDebugLog,
    leaveRoom: leaveRoomStore
  } = useAppStore()
  
  // Local state for runtime data
  const [remoteStreams, setRemoteStreams] = useState(new Map())
  const [localStream, setLocalStream] = useState(null)
  
  // Input state (not persisted)
  const [roomIdInput, setRoomIdInput] = useState(roomId)
  const [userIdInput, setUserIdInput] = useState(userId)

  const localVideoRef = useRef(null)
  const webrtcService = useRef(new EnhancedWebRTCService())

  // Update input states when store values change
  useEffect(() => {
    setRoomIdInput(roomId)
    setUserIdInput(userId)
  }, [roomId, userId])

  useEffect(() => {
    const service = webrtcService.current

    // Set up callbacks
    service.onRemoteStream((userId, stream) => {
      console.log('🎬 Adding remote stream for user:', userId)
      addDebugLog(`Remote stream received from ${userId}`)
      setRemoteStreams(prev => new Map(prev.set(userId, stream)))
    })

    service.onRemoteStreamRemoved((userId) => {
      console.log('🗑️ Removing remote stream for user:', userId)
      addDebugLog(`Remote stream removed for ${userId}`)
      setRemoteStreams(prev => {
        const newMap = new Map(prev)
        newMap.delete(userId)
        return newMap
      })
    })

    service.onUserJoined((userId) => {
      console.log('👋 User joined:', userId)
      addDebugLog(`User ${userId} joined`)
      addConnectedUser(userId)
    })

    service.onUserLeft((userId) => {
      console.log('👋 User left:', userId)
      addDebugLog(`User ${userId} left`)
      removeConnectedUser(userId)
    })

    service.onChatMessage((senderId, messageData) => {
      console.log('💬 Chat message from:', senderId, messageData)
      addDebugLog(`Chat message from ${senderId}`)
      // The ChatInterface will handle the message through the store
    })

    return () => {
      service.disconnect()
    }
  }, [])

  // Handle local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
      addDebugLog('Local video element updated with stream')
      
      // Try to play the video
      const playVideo = async () => {
        try {
          await localVideoRef.current.play()
          addDebugLog('✅ Local video is playing')
        } catch (error) {
          addDebugLog(`⚠️ Video autoplay blocked: ${error.message}`)
          // Add a click handler to enable playback
          const handleUserInteraction = async () => {
            try {
              await localVideoRef.current.play()
              addDebugLog('✅ Local video started after user interaction')
              document.removeEventListener('click', handleUserInteraction)
            } catch (retryError) {
              addDebugLog(`❌ Failed to start video: ${retryError.message}`)
            }
          }
          document.addEventListener('click', handleUserInteraction, { once: true })
        }
      }
      
      playVideo()
    }
  }, [localStream])

  const connectToServer = async () => {
    try {
      addDebugLog('Connecting to server...')
      await webrtcService.current.connect()
      setConnectionState(true)
      addDebugLog('Connected to server!')
    } catch (error) {
      console.error('Failed to connect to server:', error)
      addDebugLog(`Connection failed: ${error.message}`)
      alert('Failed to connect to server. Make sure the backend is running.')
    }
  }

  const createRoom = async () => {
    try {
      addDebugLog('Creating room...')
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8081'}/createRoom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRoomIdInput(data.roomId)
        setRoomState(data.roomId, userId, false) // Update store
        addDebugLog(`Room created: ${data.roomId}`)
        alert(`Room created: ${data.roomId}`)
      } else {
        throw new Error('Failed to create room')
      }
    } catch (error) {
      console.error('Failed to create room:', error)
      addDebugLog(`Room creation failed: ${error.message}`)
      alert('Failed to create room')
    }
  }

  const joinRoom = async () => {
    if (!roomIdInput || !userIdInput) {
      alert('Please enter both Room ID and User ID')
      return
    }

    try {
      addDebugLog('Getting user media...')
      // Get user media
      const stream = await webrtcService.current.getUserMedia()
      addDebugLog(`✅ Got media stream: ${stream.id}`)
      addDebugLog(`Video tracks: ${stream.getVideoTracks().length}, Audio tracks: ${stream.getAudioTracks().length}`)
      
      // Set local stream state - this will trigger the useEffect
      setLocalStream(stream)

      // Update store state
      setRoomState(roomIdInput, userIdInput, true)

      // Join room
      addDebugLog('Joining room...')
      webrtcService.current.joinRoom(roomIdInput, userIdInput)
      addDebugLog(`Joined room ${roomIdInput} as ${userIdInput}`)
    } catch (error) {
      console.error('Failed to join room:', error)
      addDebugLog(`Join failed: ${error.message}`)
      alert('Failed to access camera/microphone or join room')
    }
  }

  const leaveRoom = () => {
    addDebugLog('Leaving room...')
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop()
        addDebugLog(`Stopped ${track.kind} track`)
      })
      setLocalStream(null)
    }
    
    webrtcService.current.disconnect()
    leaveRoomStore() // Update store state
    setRemoteStreams(new Map())
    clearConnectedUsers()
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    addDebugLog('Left room')
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setMediaState(videoTrack.enabled, isAudioEnabled)
        addDebugLog(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`)
      }
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setMediaState(isVideoEnabled, audioTrack.enabled)
        addDebugLog(`Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`)
      }
    }
  }

  // Remote Video Component
  function RemoteVideo({ userId, stream }) {
    const videoRef = useRef(null)

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
        console.log('🎬 Remote video element updated for:', userId)
      }
    }, [stream, userId])

    return (
      <Card className="relative">
        <CardContent className="p-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-48 object-cover rounded"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
            {userId}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Video Conference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={connectToServer} className="w-full" size="lg">
              Connect to Server
            </Button>
            
            {/* Debug Panel */}
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <h4 className="font-semibold mb-2">Debug Logs:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {debugLogs.map((log, i) => (
                  <div key={i} className="text-xs text-gray-600">{log}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isInRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Join Video Conference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Your Name"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Room ID"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                />
                <Button onClick={createRoom} variant="outline">
                  Create
                </Button>
              </div>
            </div>
            <Button onClick={joinRoom} className="w-full" size="lg">
              Join Room
            </Button>
            
            {/* Debug Panel */}
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <h4 className="font-semibold mb-2">Debug Logs:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {debugLogs.map((log, i) => (
                  <div key={i} className="text-xs text-gray-600">{log}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold">Video Conference - Room: {roomId}</h1>
          <p className="text-gray-600">Connected users: {connectedUsers.size + 1}</p>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Local Video */}
          <Card className="relative bg-gray-200 min-h-48">
            <CardContent className="p-0">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-48 object-cover rounded bg-gray-800"
                style={{ backgroundColor: '#1f2937' }}
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                {userId} (You)
              </div>
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-500 flex items-center justify-center rounded">
                  <VideoOff className="w-12 h-12 text-white" />
                </div>
              )}
              {/* Debug indicator */}
              <div className="absolute top-2 right-2 bg-green-500 w-2 h-2 rounded-full"></div>
            </CardContent>
          </Card>

          {/* Remote Videos */}
          {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
            <RemoteVideo
              key={userId}
              userId={userId}
              stream={stream}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-4">
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
          <Button onClick={leaveRoom} variant="destructive" size="lg">
            <Phone className="w-5 h-5" />
          </Button>
        </div>

        {/* Chat Interface */}
        <div className="fixed bottom-4 right-4 z-50">
          <ChatInterface
            roomId={roomId}
            currentUser={{ id: userId, name: userId, isGuest: true }}
            webrtcService={webrtcService.current}
            isMinimized={!isChatOpen}
            onToggle={() => setChatOpen(!isChatOpen)}
          />
        </div>

        {/* Debug Panel */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Connection Status:</h4>
                <ul className="text-sm space-y-1">
                  <li>WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected'}</li>
                  <li>Room: {roomId}</li>
                  <li>User: {userId}</li>
                  <li>Local Stream: {localStream ? '✅ Active' : '❌ None'}</li>
                  <li>Video Enabled: {isVideoEnabled ? '✅ Yes' : '❌ No'}</li>
                  <li>Audio Enabled: {isAudioEnabled ? '✅ Yes' : '❌ No'}</li>
                  <li>Remote Streams: {remoteStreams.size}</li>
                  <li>Connected Users: {connectedUsers.size}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Recent Logs:</h4>
                <div className="text-xs space-y-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                  {debugLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App