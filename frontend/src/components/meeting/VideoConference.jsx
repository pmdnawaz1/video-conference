import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, MessageSquare, Users, Settings, Monitor } from 'lucide-react';
import ChatInterface from '../chat/ChatInterface';
import useAuthStore from '../../stores/authStore';

const VideoConference = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Video/Audio refs
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(new Map());
  
  // Media states
  const [localStream, setLocalStream] = useState(null);
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

  useEffect(() => {
    initializeMediaDevices();
    connectToMeeting();
    
    return () => {
      cleanup();
    };
  }, [meetingId]);

  const initializeMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setLocalStream(stream);
      
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
    try {
      // Connect to WebSocket for signaling
      const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8081/ws'}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('Connected to signaling server');
        setIsConnected(true);
        
        // Join the meeting room
        ws.send(JSON.stringify({
          type: 'join',
          payload: {
            roomId: meetingId,
            userId: user?.id || `guest_${Date.now()}`,
            userName: user?.first_name || 'Guest'
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
      
    } catch (error) {
      console.error('Failed to connect to meeting:', error);
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

  const handleUserJoined = (payload) => {
    console.log('User joined:', payload.userId);
    setParticipants(prev => [...prev, { id: payload.userId, name: payload.userName || payload.userId }]);
    
    // Create peer connection for new user
    createPeerConnection(payload.userId);
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

  const createPeerConnection = async (userId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', userId);
      const remoteVideo = document.getElementById(`remote-video-${userId}`);
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send(JSON.stringify({
          type: 'iceCandidate',
          payload: {
            candidate: event.candidate,
            targetId: userId
          }
        }));
      }
    };

    setPeerConnections(prev => new Map(prev).set(userId, pc));
    
    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (socket) {
      socket.send(JSON.stringify({
        type: 'offer',
        payload: {
          sdp: offer,
          targetId: userId
        }
      }));
    }
  };

  const handleOffer = async (payload) => {
    const pc = peerConnections.get(payload.senderId) || await createPeerConnection(payload.senderId);
    
    await pc.setRemoteDescription(payload.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (socket) {
      socket.send(JSON.stringify({
        type: 'answer',
        payload: {
          sdp: answer,
          targetId: payload.senderId
        }
      }));
    }
  };

  const handleAnswer = async (payload) => {
    const pc = peerConnections.get(payload.senderId);
    if (pc) {
      await pc.setRemoteDescription(payload.sdp);
    }
  };

  const handleIceCandidate = async (payload) => {
    const pc = peerConnections.get(payload.senderId);
    if (pc) {
      await pc.addIceCandidate(payload.candidate);
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
    navigate('/dashboard');
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    
    // Close WebSocket
    if (socket) {
      socket.close();
    }
    
    setLocalStream(null);
    setPeerConnections(new Map());
    setSocket(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold">Meeting: {meetingId}</h1>
            <p className="text-sm text-gray-400">
              {participants.length + 1} participant{participants.length === 0 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowParticipants(!showParticipants)}
              variant="outline"
              size="sm"
              className="text-white border-gray-600"
            >
              <Users className="w-4 h-4 mr-2" />
              Participants
            </Button>
            <Button
              onClick={() => setShowChat(!showChat)}
              variant="outline"
              size="sm"
              className="text-white border-gray-600"
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