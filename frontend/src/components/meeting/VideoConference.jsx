import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, UserPlus, Share, Monitor } from 'lucide-react';
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
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // WebRTC states
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Use ref for immediate access
  
  // Store current user ID for offer/answer negotiation
  const currentUserId = useRef(null);

  // Buffers for pending ICE candidates and answers
  const pendingCandidates = useRef(new Map());
  const pendingAnswers = useRef(new Map());

  useEffect(() => {
    let ws = null;
    let cancelled = false;

    console.log('🚀 Initializing VideoConference for meeting:', meetingId);
    console.log('🌐 Current URL:', window.location.href);

    const setupMeeting = async () => {
      await initializeMediaDevices();
      if (cancelled) return;
      ws = await connectToMeeting();
    };

    setupMeeting();

    return () => {
      cancelled = true;
      console.log('🧹 Cleaning up VideoConference for meeting:', meetingId);
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
    } catch (error) {
      console.error('Failed to access media devices:', error);
      alert('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const connectToMeeting = async () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }
    try {
      let wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8081/ws';
      console.log('🔌 Attempting WebSocket connection to:', wsUrl);
      if (wsUrl.includes('://') && !wsUrl.startsWith('ws://localhost') && !wsUrl.startsWith('ws://127.0.0.1')) {
        wsUrl = wsUrl.replace('ws://', 'wss://');
        console.log('🔒 Upgraded to secure WebSocket:', wsUrl);
      }
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connection established successfully');
        setIsConnected(true);
        const guestName = allowGuest && !user ? prompt('Enter your name:') || 'Guest' : (user?.first_name || 'Guest');
        const userId = user?.id ? `${user.id}_${Date.now()}` : `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store current user ID for later use
        currentUserId.current = userId;
        
        console.log('👤 Joining room as:', { userId, guestName, roomId: meetingId });
        console.log('🏠 Meeting ID from URL params:', meetingId);
        ws.send(JSON.stringify({
          type: 'join',
          payload: {
            roomId: meetingId,
            userId: userId,
            userName: guestName
          }
        }));
        
        // Request existing participants after joining
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('📋 Requesting existing participants...');
            ws.send(JSON.stringify({
              type: 'getParticipants',
              payload: {
                roomId: meetingId
              }
            }));
          }
        }, 500);
      };

      ws.onmessage = handleSignalingMessage;
      ws.onclose = (event) => {
        console.log('❌ WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
      };
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.error('WebSocket URL was:', wsUrl);
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
      case 'participants':
        handleParticipants(message.payload);
        break;
      default:
        break;
    }
  };

  const handleUserJoined = (payload) => {
    console.log('👥 User joined event:', payload.userId);
    
    // Check if we already have this user to prevent duplicates
    if (peerConnectionsRef.current.has(payload.userId)) {
      console.log('👤 User already has peer connection:', payload.userId);
      return;
    }
    
    if (!localStreamRef.current) {
      console.log('⏳ Local stream not ready, retrying...');
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not open, retrying user join for:', payload.userId);
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }

    // Add to participants list
    setParticipants(prev => {
      const existingUser = prev.find(p => p.id === payload.userId);
      if (existingUser) {
        console.log('👤 User already in participants:', payload.userId);
        return prev;
      }
      console.log('➕ Adding new participant:', payload.userId);
      return [...prev, { id: payload.userId, name: payload.userName || payload.userId }];
    });

    // Tie-breaking logic to prevent glare
    const shouldCreateOffer = currentUserId.current > payload.userId;
    
    console.log('🔍 Offer decision:', {
      myUserId: currentUserId.current,
      peerId: payload.userId,
      shouldCreateOffer: shouldCreateOffer
    });
    
    createPeerConnection(payload.userId, shouldCreateOffer);
  };

  const handleUserLeft = (payload) => {
    setParticipants(prev => prev.filter(p => p.id !== payload.userId));
    const pc = peerConnectionsRef.current.get(payload.userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(payload.userId);
      console.log('🗑️ Removed peer connection for:', payload.userId);
    }
  };

  const handleParticipants = (payload) => {
    console.log('📋 Received participants list:', payload);
    
    // Process each existing participant - don't create offers, wait for them
    if (payload && Array.isArray(payload)) {
      payload.forEach(participant => {
        if (participant.userId && participant.userId !== currentUserId.current) {
          console.log('👤 Processing existing participant:', participant.userId);
          
          // Don't add to participants list if already exists
          setParticipants(prev => {
            const existingUser = prev.find(p => p.id === participant.userId);
            if (existingUser) {
              return prev;
            }
            return [...prev, { id: participant.userId, name: participant.userName || participant.userId }];
          });
          
          // Create peer connection but don't create offer (wait for them to offer us)
          createPeerConnection(participant.userId, false);
        }
      });
    }
  };

  const createPeerConnection = async (userId, shouldCreateOffer = true) => {
    if (!localStreamRef.current) {
      console.warn('Local stream not ready, cannot create peer connection');
      return null;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open, cannot create peer connection');
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: '000000002068541318',
          credential: 'cvDp8AdIOuPvV0MnH38biHJEYHA='
        },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced'
    });

    if (localStreamRef.current) {
      console.log('🎬 Adding local tracks to peer connection for:', userId);
      localStreamRef.current.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, localStreamRef.current);
      });
      console.log('✅ All local tracks added for:', userId);
    } else {
      console.warn('No local stream available for peer connection');
    }

    pc.ontrack = (event) => {
      console.log('🎥 Received track event from:', userId, 'Stream:', event.streams[0], 'Tracks:', event.streams[0].getTracks());
      console.log('📊 Track details:', event.streams[0].getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
      })));
      
      if (!remoteVideosRef.current.has(userId)) {
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
      const remoteVideo = document.getElementById(`remote-video-${userId}`);
      if (remoteVideo) {
        console.log('📺 Setting remote video for:', userId, 'Element found:', !!remoteVideo);
        remoteVideo.srcObject = event.streams[0];
      } else {
        console.log('❌ Remote video element not found for:', userId, 'Buffering stream');
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() !== '') {
        if (event.candidate.type === 'relay') {
          console.log('✅ Using TURN server for candidate:', event.candidate.address, 'for user:', userId);
        }
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'iceCandidate',
            payload: {
              candidate: {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                usernameFragment: event.candidate.usernameFragment
              },
              targetId: userId
            }
          }));
        } else {
          console.warn('WebSocket not open, buffering ICE candidate for:', userId);
          if (!pendingCandidates.current.has(userId)) {
            pendingCandidates.current.set(userId, []);
          }
          pendingCandidates.current.get(userId).push({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment
          });
        }
      } else if (event.candidate === null) {
        console.log('ICE gathering complete for:', userId);
      } else {
        console.error('Invalid ICE candidate generated:', event.candidate);
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        console.log('ICE gathering complete for:', userId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state for', userId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('🎉 Peer connection SUCCESS with:', userId);
      } else if (pc.connectionState === 'failed') {
        console.error('💥 Peer connection FAILED with:', userId);
        console.error('🔍 Debug info:', {
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          localDescription: !!pc.localDescription,
          remoteDescription: !!pc.remoteDescription
        });
        
        if (pc.signalingState !== 'closed') {
          console.log('🔄 Attempting ICE restart for:', userId);
          pc.restartIce();
        } else {
          console.warn('⚠️ Peer connection closed, cannot restart ICE for:', userId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state for', userId, ':', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        console.log('🎯 ICE connection SUCCESS for:', userId);
      } else if (pc.iceConnectionState === 'failed') {
        console.error('❄️ ICE connection FAILED for:', userId);
        // Log the stats for debugging
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              console.log('✅ Successful candidate pair:', report);
            } else if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
              console.log('📊 Candidate:', report.candidateType, report.ip, report.port);
            }
          });
        });
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('⚡ ICE connection DISCONNECTED for:', userId);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    console.log('💾 Stored peer connection for:', userId, 'Total connections:', peerConnectionsRef.current.size);
    console.log('🗂️ Current peer connections:', Array.from(peerConnectionsRef.current.keys()));

    if (pendingAnswers.current.has(userId)) {
      try {
        await pc.setRemoteDescription(pendingAnswers.current.get(userId));
        console.log('Applied buffered answer for:', userId);
        pendingAnswers.current.delete(userId);
      } catch (error) {
        console.error('Error applying buffered answer for:', userId, error);
      }
    }

    if (pendingCandidates.current.has(userId)) {
      const bufferedCandidates = pendingCandidates.current.get(userId);
      console.log(`Applying ${bufferedCandidates.length} buffered ICE candidates for:`, userId);
      for (const candidateData of bufferedCandidates) {
        try {
          if (candidateData && candidateData.candidate && candidateData.candidate.trim() !== '') {
            const candidateInit = new RTCIceCandidate({
              candidate: candidateData.candidate,
              sdpMid: candidateData.sdpMid,
              sdpMLineIndex: candidateData.sdpMLineIndex,
              usernameFragment: candidateData.usernameFragment
            });
            await pc.addIceCandidate(candidateInit);
            console.log('Applied buffered ICE candidate for:', userId);
          }
        } catch (error) {
          console.error('Error applying buffered ICE candidate for:', userId, error);
        }
      }
      pendingCandidates.current.delete(userId);
    }

    if (shouldCreateOffer) {
      try {
        console.log('📤 Creating offer for:', userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const offerMessage = {
            type: 'offer',
            payload: {
              sdp: offer,
              targetId: userId
            }
          };
          console.log('📨 Sending offer to:', userId, 'Message:', offerMessage);
          socketRef.current.send(JSON.stringify(offerMessage));
        } else {
          console.error('❌ WebSocket not open, cannot send offer to:', userId);
        }
      } catch (error) {
        console.error('❌ Error creating/sending offer to:', userId, error);
      }
    } else {
      console.log('⏳ Waiting to receive offer from:', userId);
    }

    return pc;
  };

  const handleOffer = async (payload) => {
    console.log('📥 Received offer from:', payload.senderId);
    
    // Add sender to participants list if not already there
    setParticipants(prev => {
      const existingUser = prev.find(p => p.id === payload.senderId);
      if (existingUser) {
        return prev;
      }
      console.log('➕ Adding participant from offer:', payload.senderId);
      return [...prev, { id: payload.senderId, name: payload.senderId }];
    });
    
    // Ensure we have a peer connection
    let pc = peerConnectionsRef.current.get(payload.senderId);
    if (!pc) {
      console.log('🔨 Creating peer connection for offer from:', payload.senderId);
      pc = await createPeerConnection(payload.senderId, false);
    }
    
    if (!pc) {
      console.error('❌ Failed to create peer connection for:', payload.senderId);
      return;
    }

    try {
      console.log('📝 Setting remote description for offer from:', payload.senderId);
      await pc.setRemoteDescription(payload.sdp);
      
      console.log('📤 Creating answer for:', payload.senderId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const answerMessage = {
          type: 'answer',
          payload: {
            sdp: answer,
            targetId: payload.senderId
          }
        };
        console.log('📨 Sending answer to:', payload.senderId, 'Message:', answerMessage);
        socketRef.current.send(JSON.stringify(answerMessage));
      }
    } catch (error) {
      console.error('❌ Error handling offer from:', payload.senderId, error);
    }
  };

  const handleAnswer = async (payload) => {
    console.log('📥 Received answer from:', payload.senderId);
    console.log('🔍 Looking for peer connection. Available connections:', Array.from(peerConnectionsRef.current.keys()));
    console.log('🔍 peerConnectionsRef Map size:', peerConnectionsRef.current.size);
    
    const pc = peerConnectionsRef.current.get(payload.senderId);
    if (!pc) {
      console.error('❌ No peer connection found for answer from:', payload.senderId);
      console.error('🔍 Available peer connections:', Array.from(peerConnectionsRef.current.keys()));
      console.log('📦 Buffering answer from:', payload.senderId);
      pendingAnswers.current.set(payload.senderId, payload.sdp);
      return;
    }
    
    try {
      console.log('📝 Setting remote description for answer from:', payload.senderId);
      await pc.setRemoteDescription(payload.sdp);
      console.log('✅ Remote description set successfully for:', payload.senderId);
      
      // Process buffered ICE candidates
      if (pendingCandidates.current.has(payload.senderId)) {
        const bufferedCandidates = pendingCandidates.current.get(payload.senderId);
        console.log(`📦 Processing ${bufferedCandidates.length} buffered ICE candidates for:`, payload.senderId);
        
        for (const candidateData of bufferedCandidates) {
          try {
            if (candidateData && candidateData.candidate && candidateData.candidate.trim() !== '') {
              const candidateInit = new RTCIceCandidate({
                candidate: candidateData.candidate,
                sdpMid: candidateData.sdpMid,
                sdpMLineIndex: candidateData.sdpMLineIndex,
                usernameFragment: candidateData.usernameFragment
              });
              await pc.addIceCandidate(candidateInit);
              console.log('✅ Processed buffered ICE candidate for:', payload.senderId);
            }
          } catch (error) {
            console.error('❌ Error processing buffered ICE candidate:', error);
          }
        }
        pendingCandidates.current.delete(payload.senderId);
      }
    } catch (error) {
      console.error('❌ Error setting remote description:', error);
    }
  };

  const handleIceCandidate = async (payload) => {
    if (!payload.candidate || !payload.candidate.candidate || payload.candidate.candidate.trim() === '') {
      console.error('Invalid or empty ICE candidate received:', payload.candidate);
      console.warn('Check backend WebSocket server for candidate generation issues');
      return;
    }

    const pc = peerConnectionsRef.current.get(payload.senderId);
    if (pc) {
      try {
        if (!pc.remoteDescription) {
          console.log('Remote description not set, buffering ICE candidate from:', payload.senderId);
          if (!pendingCandidates.current.has(payload.senderId)) {
            pendingCandidates.current.set(payload.senderId, []);
          }
          pendingCandidates.current.get(payload.senderId).push(payload.candidate);
          return;
        }
        const candidateInit = new RTCIceCandidate({
          candidate: payload.candidate.candidate,
          sdpMid: payload.candidate.sdpMid,
          sdpMLineIndex: payload.candidate.sdpMLineIndex,
          usernameFragment: payload.candidate.usernameFragment
        });
        await pc.addIceCandidate(candidateInit);
        console.log('ICE candidate added successfully for:', payload.senderId);
      } catch (error) {
        console.error('Error adding ICE candidate:', error, payload.candidate);
      }
    } else {
      console.log('Peer connection not found, buffering ICE candidate from:', payload.senderId);
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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        videoTrack.onended = () => stopScreenShare();
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
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
    }
  };

  const leaveMeeting = () => {
    cleanup();
    if (allowGuest || !user) {
      window.close();
      navigate('/');
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    if (socketRef.current) {
      socketRef.current.close();
    }
    setLocalStream(null);
    peerConnectionsRef.current.clear();
    setSocket(null);
  };

  const getGridLayout = (numParticipants) => {
    if (numParticipants <= 2) return 'grid-cols-1';
    if (numParticipants <= 4) return 'grid-cols-2';
    if (numParticipants <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold">Meeting: {meetingId}</h1>
            <p className="text-sm text-gray-400">
              {participants.length + 1} participant{participants.length === 0 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={toggleDarkMode} variant="outline" size="sm">
              {isDarkMode ? <MdLightMode className="w-4 h-4" /> : <MdDarkMode className="w-4 h-4" />}
            </Button>
            {user && (
              <Button onClick={handleInviteUsers} variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            )}
            <Button onClick={handleCopyMeetingLink} variant="outline" size="sm">
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button onClick={() => setShowParticipants(!showParticipants)} variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
            </Button>
            <Button onClick={() => setShowChat(!showChat)} variant="outline" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4">
          <div className={`grid ${getGridLayout(participants.length + 1)} gap-4 flex-1`}>
            <Card className="bg-gray-800 border-gray-700 overflow-hidden relative rounded-lg">
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
            {participants.map(participant => (
              <Card key={participant.id} className="bg-gray-800 border-gray-700 overflow-hidden relative rounded-lg">
                <video
                  id={`remote-video-${participant.id}`}
                  ref={(videoElement) => {
                    console.log('🎬 Video element ref callback for:', participant.id, 'Element:', !!videoElement, 'Has stream:', remoteVideosRef.current.has(participant.id));
                    if (videoElement && remoteVideosRef.current.has(participant.id)) {
                      console.log('📺 Applying buffered stream to video element for:', participant.id);
                      videoElement.srcObject = remoteVideosRef.current.get(participant.id);
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
          </div>
          <footer className="flex justify-center items-center p-4">
            <div className="flex items-center space-x-4 bg-gray-800 rounded-full px-6 py-3">
              <Button
                onClick={toggleAudio}
                size="sm"
                variant={isAudioEnabled ? "secondary" : "destructive"}
                className="rounded-full w-12 h-12 p-0"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              <Button
                onClick={toggleVideo}
                size="sm"
                variant={isVideoEnabled ? "secondary" : "destructive"}
                className="rounded-full w-12 h-12 p-0"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
              <Button
                onClick={toggleScreenShare}
                size="sm"
                variant={isScreenSharing ? "default" : "secondary"}
                className="rounded-full w-12 h-12 p-0"
              >
                <Monitor className="w-5 h-5" />
              </Button>
              <Button
                onClick={leaveMeeting}
                size="sm"
                variant="destructive"
                className="rounded-full w-16 h-12 p-0"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </footer>
        </div>
        {(showChat || showParticipants) && (
          <aside className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
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
              <div className="flex-1 p-4">
                <ChatInterface meetingId={meetingId} />
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
};

export default VideoConference;