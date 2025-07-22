import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, MessageSquare, Users, Settings, Monitor, Share, UserPlus, Copy } from 'lucide-react';
import ChatInterface from '../chat/ChatInterface';
import useAuthStore from '../../stores/authStore';
import { useTheme } from '../../contexts/ThemeContext';
import { MdDarkMode, MdLightMode } from 'react-icons/md';

const VideoConference = ({ allowGuest = false }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  // Video/Audio refs
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(new Map());
  
  // Media states
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Meeting states
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // WebRTC states
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  // Add buffers for pending ICE candidates and answers
  const pendingCandidates = useRef(new Map());
  const pendingAnswers = useRef(new Map());

  // 1. Ensure local media is initialized before signaling
  useEffect(() => {
    let ws = null;
    let cancelled = false;

    const setupMeeting = async () => {
      await initializeMediaDevices(); // Wait for localStream
      if (cancelled) return;
      ws = await connectToMeeting();  // Only then connect to signaling server
    };

    setupMeeting();

    return () => {
      cancelled = true;
      cleanup();
      if (ws) ws.close();
    };
  }, [meetingId]);

  const initializeMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('Local media initialized');
    } catch (error) {
      console.error('Failed to access media devices:', error);
      alert('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const connectToMeeting = async () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping...');
      return socketRef.current;
    }
    try {
      // Connect to WebSocket for signaling
      let wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8081/ws';
      
      // Debug: Log environment variables
      console.log('Environment variables:', {
        VITE_WS_URL: import.meta.env.VITE_WS_URL,
        VITE_API_URL: import.meta.env.VITE_API_URL,
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
      });
      
      // If connecting to a remote server, use secure WebSocket
      if (wsUrl.includes('://') && !wsUrl.startsWith('ws://localhost') && !wsUrl.startsWith('ws://127.0.0.1')) {
        wsUrl = wsUrl.replace('ws://', 'wss://');
      }
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to signaling server');
        setIsConnected(true);

        // Join the meeting room
        const guestName = allowGuest && !user ? prompt('Enter your name:') || 'Guest' : (user?.first_name || 'Guest');
        const userId = user?.id ? `${user.id}_${Date.now()}` : `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log('Joining meeting room:', meetingId, 'as user:', userId, 'name:', guestName);

        ws.send(JSON.stringify({
          type: 'join',
          payload: {
            roomId: meetingId,
            userId: userId,
            userName: guestName
          }
        }));
      };

      ws.onmessage = handleSignalingMessage;

      ws.onclose = () => {
        console.log('Disconnected from signaling server');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      setSocket(ws);
      socketRef.current = ws;
      return ws;
    } catch (error) {
      console.error('Failed to connect to meeting:', error);
      return null;
    }
  };

  const handleSignalingMessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received signaling message:', message);
    
    switch (message.type) {
      case 'userJoined':
        handleUserJoined(message.payload);
        break;
      case 'userLeft':
        handleUserLeft(message.payload);
        break;
      case 'offer':
        handleOffer(message.payload);
        break;
      case 'answer':
        handleAnswer(message.payload);
        break;
      case 'iceCandidate':
        handleIceCandidate(message.payload);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // 2. Defensive checks in handleUserJoined
  const handleUserJoined = (payload) => {
    if (!localStreamRef.current) {
      // Retry after a short delay if local stream is not ready
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open, cannot create peer connection');
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }
    console.log('🆕 User joined:', payload.userId, 'Total participants will be:', participants.length + 1);
    
    // Check if user already exists to avoid duplicates
    setParticipants(prev => {
      const existingUser = prev.find(p => p.id === payload.userId);
      if (existingUser) {
        console.log('User already exists, not adding duplicate');
        return prev;
      }
      return [...prev, { id: payload.userId, name: payload.userName || payload.userId }];
    });
    
    // Create peer connection for new user and automatically create offer
    if (!peerConnections.has(payload.userId)) {
      console.log('🤝 Creating peer connection with offer for new user:', payload.userId);
      createPeerConnection(payload.userId, true); // true = create offer automatically
    } else {
      console.log('Peer connection already exists for:', payload.userId);
    }
  };

  const handleUserLeft = (payload) => {
    console.log('User left:', payload.userId);
    setParticipants(prev => prev.filter(p => p.id !== payload.userId));
    
    // Clean up peer connection
    const pc = peerConnections.get(payload.userId);
    if (pc) {
      pc.close();
      setPeerConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(payload.userId);
        return newMap;
      });
    }
  };

  // 3. Defensive checks in createPeerConnection
  const createPeerConnection = async (userId, shouldCreateOffer = true) => {
    if (!localStreamRef.current) {
      console.warn('Local stream not ready, cannot create peer connection');
      return null;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open, cannot create peer connection');
      return null;
    }
    console.log('🤝 Creating peer connection for user:', userId, 'createOffer:', shouldCreateOffer);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: '000000002068541318',
          credential: 'cvDp8AdIOuPvV0MnH38biHJEYHA='
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced'
    });

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('📹 Adding local track to peer connection:', track.kind);
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.warn('⚠️ No local stream available for peer connection');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote track from:', userId, 'Stream:', event.streams[0]);
      
      // Store stream in remoteVideosRef for immediate use
      if (!remoteVideosRef.current.has(userId)) {
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
      
      const remoteVideo = document.getElementById(`remote-video-${userId}`);
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        console.log('✅ Set remote video source for:', userId);
      } else {
        console.log('📹 Buffering remote stream for:', userId, '- element not ready yet');
        // Store the stream for when the element becomes available
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate for', userId, ':', {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          relatedAddress: event.candidate.relatedAddress,
          relatedPort: event.candidate.relatedPort
        });
        
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          console.log('🧊 Sending ICE candidate to:', userId);
          socketRef.current.send(JSON.stringify({
            type: 'iceCandidate',
            payload: {
              candidate: event.candidate,
              targetId: userId
            }
          }));
        }
      } else {
        console.log('🧊 ICE gathering complete for:', userId);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state for', userId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ Peer connection established with:', userId);
      } else if (pc.connectionState === 'failed') {
        console.error('❌ Peer connection failed with:', userId);
        // Try to restart ICE
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            console.log('🔄 Attempting ICE restart for:', userId);
            pc.restartIce();
          }
        }, 2000);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state for', userId, ':', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('🔄 ICE connection issues, attempting restart for:', userId);
        setTimeout(() => {
          if (pc.iceConnectionState === 'failed') {
            pc.restartIce();
          }
        }, 1000);
      }
    };

    setPeerConnections(prev => new Map(prev).set(userId, pc));
    
    // Apply any pending answer
    if (pendingAnswers.current.has(userId)) {
      await pc.setRemoteDescription(pendingAnswers.current.get(userId));
      pendingAnswers.current.delete(userId);
    }
    // Apply any pending ICE candidates
    if (pendingCandidates.current.has(userId)) {
      for (const candidate of pendingCandidates.current.get(userId)) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidates.current.delete(userId);
    }
    // Create and send offer only if requested (for new users joining)
    if (shouldCreateOffer) {
      try {
        console.log('📤 Creating offer for:', userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          console.log('📨 Sending offer to:', userId);
          socketRef.current.send(JSON.stringify({
            type: 'offer',
            payload: {
              sdp: offer,
              targetId: userId
            }
          }));
        } else {
          console.error('❌ WebSocket not open, cannot send offer to:', userId);
        }
      } catch (error) {
        console.error('❌ Error creating/sending offer to:', userId, error);
      }
    }
    
    return pc;
  };

  const handleOffer = async (payload) => {
    console.log('📥 Received offer from:', payload.senderId);
    const pc = peerConnections.get(payload.senderId) || await createPeerConnection(payload.senderId, false); // false = don't create offer when receiving one
    
    console.log('📝 Setting remote description for offer from:', payload.senderId);
    await pc.setRemoteDescription(payload.sdp);
    
    console.log('📤 Creating answer for:', payload.senderId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('📨 Sending answer to:', payload.senderId);
      socketRef.current.send(JSON.stringify({
        type: 'answer',
        payload: {
          sdp: answer,
          targetId: payload.senderId
        }
      }));
    }
  };

  const handleAnswer = async (payload) => {
    console.log('📥 Received answer from:', payload.senderId);
    const pc = peerConnections.get(payload.senderId);
    if (pc) {
      console.log('📝 Setting remote description for answer from:', payload.senderId);
      await pc.setRemoteDescription(payload.sdp);
    } else {
      // Buffer the answer
      pendingAnswers.current.set(payload.senderId, payload.sdp);
    }
  };

  const handleIceCandidate = async (payload) => {
    console.log('🧊 Received ICE candidate from:', payload.senderId, ':', {
      type: payload.candidate.type,
      protocol: payload.candidate.protocol,
      address: payload.candidate.address,
      port: payload.candidate.port
    });
    
    const pc = peerConnections.get(payload.senderId);
    if (pc) {
      try {
        console.log('🧊 Adding ICE candidate from:', payload.senderId);
        await pc.addIceCandidate(payload.candidate);
        console.log('✅ ICE candidate added successfully');
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.log('📦 Buffering ICE candidate from:', payload.senderId);
      // Buffer the candidate
      if (!pendingCandidates.current.has(payload.senderId)) {
        pendingCandidates.current.set(payload.senderId, []);
      }
      pendingCandidates.current.get(payload.senderId).push(payload.candidate);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        
        // Handle screen share ending
        videoTrack.onended = () => {
          stopScreenShare();
        };
        
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const stopScreenShare = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      
      // Replace screen share track with camera track
      peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Restore local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      
      setIsScreenSharing(false);
    }
  };

  const leaveMeeting = () => {
    cleanup();
    if (allowGuest || !user) {
      window.close(); // Try to close tab for guest users
      navigate('/'); // Fallback navigation
    } else {
      navigate('/dashboard');
    }
  };

  const generateMeetingLink = () => {
    return `${window.location.origin}/meeting/${meetingId}/join`;
  };

  const handleCopyMeetingLink = async () => {
    const meetingLink = generateMeetingLink();
    
    try {
      await navigator.clipboard.writeText(meetingLink);
      alert('Meeting link copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        alert('Meeting link copied to clipboard!');
      } catch (fallbackError) {
        alert(`Failed to copy link. Please copy manually: ${meetingLink}`);
      }
      
      document.body.removeChild(textArea);
    }
  };

  const handleInviteUsers = () => {
    const emails = prompt('Enter email addresses (comma-separated):');
    if (!emails) return;
    
    const emailList = emails.split(',').map(email => email.trim()).filter(email => email);
    if (emailList.length === 0) return;
    
    sendInvitations(emailList);
  };

  const sendInvitations = async (emails) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: JSON.stringify({
          meeting_id: parseInt(meetingId),
          emails: emails,
          message: `You're invited to join the meeting`
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`Invitations sent successfully to ${emails.join(', ')}`);
      } else {
        alert('Failed to send invitations: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Error sending invitations: ' + error.message);
    }
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setLocalStream(null);
    setPeerConnections(new Map());
    setSocket(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold">Meeting: {meetingId}</h1>
            <p className="text-sm text-muted-foreground">
              {participants.length + 1} participant{participants.length === 0 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={toggleDarkMode}
              variant="outline"
              size="sm"
            >
              {isDarkMode ? <MdLightMode className="w-4 h-4" /> : <MdDarkMode className="w-4 h-4" />}
            </Button>
            {user && (
              <Button
                onClick={handleInviteUsers}
                variant="outline"
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            )}
            <Button
              onClick={handleCopyMeetingLink}
              variant="outline"
              size="sm"
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              onClick={() => setShowParticipants(!showParticipants)}
              variant="outline"
              size="sm"
            >
              <Users className="w-4 h-4 mr-2" />
              Participants
            </Button>
            <Button
              onClick={() => setShowChat(!showChat)}
              variant="outline"
              size="sm"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Main Video Area */}
        <div className="flex-1 relative">
          {/* Remote Videos Grid */}
          <div className="grid grid-cols-2 gap-2 p-4 h-full">
            {participants.map(participant => (
              <Card key={participant.id} className="bg-gray-800 border-gray-700 overflow-hidden">
                <video
                  id={`remote-video-${participant.id}`}
                  ref={(videoElement) => {
                    if (videoElement && remoteVideosRef.current.has(participant.id)) {
                      videoElement.srcObject = remoteVideosRef.current.get(participant.id);
                      console.log('✅ Applied buffered stream to video element for:', participant.id);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                  {participant.name}
                </div>
              </Card>
            ))}
            
            {/* Local Video */}
            <Card className="bg-gray-800 border-gray-700 overflow-hidden relative">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                You {isScreenSharing && '(Sharing)'}
              </div>
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                  <VideoOff className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </Card>
          </div>

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-4 bg-gray-800 rounded-lg px-6 py-3">
              <Button
                onClick={toggleAudio}
                size="sm"
                variant={isAudioEnabled ? "outline" : "destructive"}
                className="rounded-full w-12 h-12 p-0"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              
              <Button
                onClick={toggleVideo}
                size="sm"
                variant={isVideoEnabled ? "outline" : "destructive"}
                className="rounded-full w-12 h-12 p-0"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
              
              <Button
                onClick={toggleScreenShare}
                size="sm"
                variant={isScreenSharing ? "default" : "outline"}
                className="rounded-full w-12 h-12 p-0"
              >
                <Monitor className="w-5 h-5" />
              </Button>
              
              <Button
                onClick={leaveMeeting}
                size="sm"
                variant="destructive"
                className="rounded-full w-12 h-12 p-0"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-gray-800 border-l border-gray-700">
            {showParticipants && (
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold mb-3">Participants ({participants.length + 1})</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {user?.first_name?.[0] || 'Y'}
                    </div>
                    <span className="text-sm">You</span>
                  </div>
                  {participants.map(participant => (
                    <div key={participant.id} className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm">
                        {participant.name[0]}
                      </div>
                      <span className="text-sm">{participant.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {showChat && (
              <div className="flex-1">
                <ChatInterface meetingId={meetingId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConference;