import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
  UserPlus,
  Share,
  Monitor,
  LayoutGrid,
  MoreVertical,
  Pin,
  PinOff,
  Loader2,
  Hand,
  Crown,
  Shield,
  UserX,
  Volume2,
  VolumeX,
  Settings,
  Power,
  Lock,
  Unlock,
  Bell,
  AlertTriangle,
  Clock,
  Square,
} from "lucide-react";
import MeetingChatInterface from "../chat/MeetingChatInterface";
import useAuthStore from "../../stores/authStore";
import { useTheme } from "../../contexts/ThemeContext";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import LoadingSpinner from "../ui/LoadingSpinner";
import PermissionRequestModal from "./PermissionRequestModal";
import AdminApprovalModal from "./AdminApprovalModal";

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
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);

  // Meeting states
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [pinnedId, setPinnedId] = useState(null); // 'local' or remote userId
  const [raisedHands, setRaisedHands] = useState([]);
  const [waitingRoom, setWaitingRoom] = useState([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [showAdminApproval, setShowAdminApproval] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    audio: "denied",
    video: "denied",
    screen: "denied",
  });
  const [meetingSettings, setMeetingSettings] = useState({
    isLocked: false,
    isRecording: false,
    allowChat: true,
    allowScreenShare: true,
    requirePermission: true,
  });
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endCountdown, setEndCountdown] = useState(null);
  const pinnedVideoRef = useRef(null);
  const pinnedIdRef = useRef(null);

  // WebRTC states
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Use ref for immediate access

  // Store current user ID for offer/answer negotiation
  const currentUserId = useRef(null);

  // Buffers for pending ICE candidates and answers
  const pendingCandidates = useRef(new Map());
  const pendingAnswers = useRef(new Map());

  // Track negotiation state to prevent glare
  const negotiationState = useRef(new Map()); // userId -> 'offering' | 'answering' | 'stable'

  useEffect(() => {
    let ws = null;
    let cancelled = false;
    let pingInterval = null;

    console.log("🚀 Initializing VideoConference for meeting:", meetingId);
    console.log("🌐 Current URL:", window.location.href);

    const setupMeeting = async () => {
      await initializeMediaDevices();
      if (cancelled) return;
      ws = await connectToMeeting();
      if (ws) {
        // Socket.IO handles ping/pong automatically, no need for manual pings
        console.log("🏓 Socket.IO connection established, ping/pong handled automatically");
      }
    };

    setupMeeting();

    return () => {
      cancelled = true;
      console.log("🧹 Cleaning up VideoConference for meeting:", meetingId);
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      cleanup();
      if (ws) ws.close();
    };
  }, [meetingId]);

  const initializeMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });

      // Disable audio by default
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to access media devices:", error);
      alert("Unable to access camera/microphone. Please check permissions.");
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const connectToMeeting = async () => {
    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }
    try {
      const serverUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
      console.log("🔌 Attempting Socket.IO connection to:", serverUrl);
      
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
      });

      socket.on('connect', () => {
        console.log("✅ Socket.IO connection established successfully");
        setIsConnected(true);
        const guestName =
          allowGuest && !user
            ? prompt("Enter your name:") || "Guest"
            : user?.first_name || "Guest";
        const userId = user?.id
          ? `${user.id}_${Date.now()}`
          : `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store current user ID for later use
        currentUserId.current = userId;

        console.log("👤 Joining server as:", {
          userId,
          guestName,
          roomId: meetingId,
        });
        
        // First join the server
        socket.emit('join-server', {
          name: guestName,
          email: user?.email || '',
          userId: userId
        });
        
        // Then join the room after a brief delay
        setTimeout(() => {
          console.log("🏠 Joining room:", meetingId);
          socket.emit('join-room', {
            roomId: meetingId,
            meetingId: meetingId
          });
        }, 100);

        // Request existing participants after joining
        setTimeout(() => {
          if (socket.connected) {
            console.log("📋 Requesting existing participants...");
            socket.emit('getParticipants', {
              roomId: meetingId,
            });
          }
        }, 500);
      });

      // Set up Socket.IO event handlers for WebRTC signaling
      socket.on('room-joined', (payload) => handleRoomJoined(payload));
      socket.on('user-joined', (payload) => handleUserJoined(payload));
      socket.on('userLeft', (payload) => handleUserLeft(payload));
      socket.on('offer', (payload) => handleOffer(payload));
      socket.on('answer', (payload) => handleAnswer(payload));
      socket.on('ice-candidate', (payload) => handleIceCandidate(payload));
      socket.on('participants', (payload) => handleParticipants(payload));
      socket.on('typingStatus', (payload) => handleTypingStatus(payload));
      socket.on('speakingStatus', (payload) => handleSpeakingStatus(payload));
      socket.on('handRaised', (payload) => handleHandRaised(payload));
      socket.on('permissionRequest', (payload) => handlePermissionRequest(payload));
      socket.on('roomUpdate', (payload) => handleRoomUpdate(payload));
      socket.on('screen-share-started', (payload) => handleScreenShareStarted(payload));
      socket.on('screen-share-stopped', (payload) => handleScreenShareStopped(payload));
      socket.on('pong', () => console.log('🏓 Received pong'));
      
      socket.on('disconnect', (reason) => {
        console.log("❌ Socket.IO connection closed:", reason);
        setIsConnected(false);
      });
      socket.on('connect_error', (error) => {
        console.error("❌ Socket.IO connection error:", error);
        console.error("Server URL was:", serverUrl);
      });
      
      setSocket(socket);
      socketRef.current = socket;
      return socket;
    } catch (error) {
      console.error("Failed to connect to meeting:", error);
      return null;
    }
  };

  // Helper function to send Socket.IO messages
  const sendSocketMessage = (type, payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(type, payload);
    }
  };

  // WebRTC-specific event emitters
  const sendOffer = (targetUserId, offer) => {
    sendSocketMessage('offer', {
      roomId: meetingId,
      targetUserId,
      offer
    });
  };

  const sendAnswer = (targetUserId, answer) => {
    sendSocketMessage('answer', {
      roomId: meetingId,
      targetUserId,
      answer
    });
  };

  const sendIceCandidate = (targetUserId, candidate) => {
    sendSocketMessage('ice-candidate', {
      roomId: meetingId,
      targetUserId,
      candidate
    });
  };

  /* DISABLED - Using direct Socket.IO events now
  const handleSignalingMessage = (message) => {
    // Socket.IO already parses JSON, no need to parse event.data
    console.log(
      "📨 Received Socket.IO message:",
      message.type,
      message.payload ? "with payload" : "no payload",
    );

    switch (message.type) {
      case "userJoined":
        handleUserJoined(message.payload);
        break;
      case "userLeft":
        handleUserLeft(message.payload);
        break;
      case "offer":
        handleOffer(message.payload);
        break;
      case "answer":
        handleAnswer(message.payload);
        break;
      case "iceCandidate":
        handleIceCandidate(message.payload);
        break;
      case "participants":
        handleParticipants(message.payload);
        break;
      case "typingStatus":
        handleTypingStatus(message.payload);
        break;
      case "speakingStatus":
        handleSpeakingStatus(message.payload);
        break;
      case "handRaised":
        handleHandRaised(message.payload);
        break;
      case "handLowered":
        handleHandLowered(message.payload);
        break;
      case "waitingRoomUpdate":
        handleWaitingRoomUpdate(message.payload);
        break;
      case "permissionRequest":
        handlePermissionRequest(message.payload);
        break;
      case "permissionResponse":
        handlePermissionResponse(message.payload);
        break;
      case "meetingControl":
        handleMeetingControl(message.payload);
        break;
      case "adminNotification":
        handleAdminNotification(message.payload);
        break;
      case "participantControl":
        handleParticipantControl(message.payload);
        break;
      case "participantJoined":
        handleParticipantJoinedNotification(message.payload);
        break;
      case "participantLeft":
        handleParticipantLeftNotification(message.payload);
        break;
      case "speakingDetection":
        handleSpeakingDetection(message.payload);
        break;
      case "meetingTermination":
        handleMeetingTermination(message.payload);
        break;
      case "meetingCountdown":
        handleMeetingCountdown(message.payload);
        break;
      case "stateSync":
        handleStateSync(message.payload);
        break;
      case "connectionQuality":
        handleConnectionQuality(message.payload);
        break;
      case "ping":
        // Respond to server ping
        if (
          socketRef.current &&
          socketRef.current.connected
        ) {
          sendSocketMessage("pong", {});
        }
        break;
      default:
        console.warn("⚠️ Unknown message type:", message.type);
        break;
    }
  };
  */

  const handleSpeakingStatus = (payload) => {
    setSpeakingUsers((prev) => {
      if (payload.isSpeaking) {
        if (!prev.includes(payload.userId)) {
          return [...prev, payload.userId];
        }
      } else {
        return prev.filter((id) => id !== payload.userId);
      }
      return prev;
    });
  };

  const handleTypingStatus = (payload) => {
    setTypingUsers((prev) => {
      if (payload.isTyping) {
        if (!prev.includes(payload.userId)) {
          return [...prev, payload.userId];
        }
      } else {
        return prev.filter((id) => id !== payload.userId);
      }
      return prev;
    });
  };

  const handleHandRaised = (payload) => {
    setRaisedHands((prev) => {
      if (!prev.find((hand) => hand.userId === payload.userId)) {
        return [
          ...prev,
          {
            userId: payload.userId,
            userName: payload.userName,
            timestamp: payload.timestamp || Date.now(),
          },
        ].sort((a, b) => a.timestamp - b.timestamp);
      }
      return prev;
    });
  };

  const handleHandLowered = (payload) => {
    setRaisedHands((prev) =>
      prev.filter((hand) => hand.userId !== payload.userId),
    );
  };

  const handleWaitingRoomUpdate = (payload) => {
    setWaitingRoom(payload.waitingUsers || []);
  };

  const toggleRaiseHand = () => {
    if (socketRef.current && socketRef.current.connected) {
      const newHandState = !isHandRaised;
      setIsHandRaised(newHandState);

      sendSocketMessage(newHandState ? "raiseHand" : "lowerHand", {
        roomId: meetingId,
        userId: currentUserId.current,
        userName: user?.first_name || "Guest",
        timestamp: Date.now(),
      });
    }
  };

  const admitFromWaiting = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("admitParticipant", {
        roomId: meetingId,
        userId: userId,
        adminId: currentUserId.current,
      });
    }
  };

  const acknowledgeHand = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("acknowledgeHand", {
        roomId: meetingId,
        userId: userId,
        adminId: currentUserId.current,
      });
    }
  };

  const removeParticipant = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("removeParticipant", {
        roomId: meetingId,
        userId: userId,
        adminId: currentUserId.current,
      });
    }
  };

  const handlePermissionRequest = (payload) => {
    if (user?.role === "admin") {
      setPermissionRequests((prev) => {
        const existing = prev.find((req) => req.userId === payload.userId);
        if (existing) {
          // Update existing request
          return prev.map((req) =>
            req.userId === payload.userId
              ? {
                  ...req,
                  permissions: payload.permissions,
                  message: payload.message,
                  timestamp: payload.timestamp,
                }
              : req,
          );
        } else {
          // Add new request
          return [
            ...prev,
            {
              id: `${payload.userId}_${payload.timestamp}`,
              userId: payload.userId,
              userName: payload.userName,
              permissions: payload.permissions,
              message: payload.message,
              timestamp: payload.timestamp,
            },
          ];
        }
      });
    }
  };

  const handlePermissionResponse = (payload) => {
    if (payload.targetUserId === currentUserId.current) {
      setPermissionStatus((prev) => ({
        ...prev,
        ...payload.permissions,
      }));

      // Show notification to user
      const approvedPerms = Object.entries(payload.permissions)
        .filter(([perm, status]) => status === "approved")
        .map(([perm]) => perm);

      const deniedPerms = Object.entries(payload.permissions)
        .filter(([perm, status]) => status === "denied")
        .map(([perm]) => perm);

      if (approvedPerms.length > 0) {
        console.log(`Permissions approved: ${approvedPerms.join(", ")}`);
      }
      if (deniedPerms.length > 0) {
        console.log(`Permissions denied: ${deniedPerms.join(", ")}`);
      }
    }
  };

  const sendPermissionRequest = (permissions, message) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("permissionRequest", {
        roomId: meetingId,
        userId: currentUserId.current,
        userName: user?.first_name || "Guest",
        permissions: permissions,
        message: message,
        timestamp: Date.now(),
      });
    }
  };

  const handlePermissionApproval = (requestId, userId, permissions) => {
    if (socketRef.current && socketRef.current.connected) {
      const approvedPermissions = {};
      permissions.forEach((perm) => {
        approvedPermissions[perm] = "approved";
      });

      sendSocketMessage("permissionResponse", {
        roomId: meetingId,
        targetUserId: userId,
        adminId: currentUserId.current,
        permissions: approvedPermissions,
        requestId: requestId,
      });

      // Remove from pending requests
      setPermissionRequests((prev) =>
        prev.filter((req) => req.id !== requestId),
      );
    }
  };

  const handlePermissionDenial = (requestId, userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("permissionResponse", {
        roomId: meetingId,
        targetUserId: userId,
        adminId: currentUserId.current,
        permissions: { audio: "denied", video: "denied", screen: "denied" },
        requestId: requestId,
      });

      // Remove from pending requests
      setPermissionRequests((prev) =>
        prev.filter((req) => req.id !== requestId),
      );
    }
  };

  const handleBulkPermissionAction = (action) => {
    permissionRequests.forEach((request) => {
      if (action === "approve") {
        handlePermissionApproval(
          request.id,
          request.userId,
          request.permissions,
        );
      } else {
        handlePermissionDenial(request.id, request.userId);
      }
    });
  };

  // Meeting Control Functions
  const toggleMeetingLock = () => {
    const newLockState = !meetingSettings.isLocked;
    setMeetingSettings((prev) => ({ ...prev, isLocked: newLockState }));

    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        "meetingControl", {
            action: "toggleLock",
            roomId: meetingId,
            adminId: currentUserId.current,
            isLocked: newLockState,
          }
      );
    }

    addAdminNotification(
      `Meeting ${newLockState ? "locked" : "unlocked"}`,
      "info",
    );
  };

  const muteAllParticipants = () => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage("meetingControl", {
        action: "muteAll",
        roomId: meetingId,
        adminId: currentUserId.current,
      });
    }

    addAdminNotification("All participants muted", "info");
  };

  const toggleRecording = () => {
    const newRecordingState = !meetingSettings.isRecording;
    setMeetingSettings((prev) => ({ ...prev, isRecording: newRecordingState }));

    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "meetingControl",
          payload: {
            action: "toggleRecording",
            roomId: meetingId,
            adminId: currentUserId.current,
            isRecording: newRecordingState,
          },
        }),
      );
    }

    addAdminNotification(
      `Recording ${newRecordingState ? "started" : "stopped"}`,
      "success",
    );
  };

  const endMeetingWithConfirmation = () => {
    setShowEndConfirm(true);
  };

  const confirmEndMeeting = () => {
    setShowEndConfirm(false);
    startEndCountdown();
  };

  const startEndCountdown = () => {
    let countdown = 10;
    setEndCountdown(countdown);

    // Notify all participants
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "meetingControl",
          payload: {
            action: "endWarning",
            roomId: meetingId,
            adminId: currentUserId.current,
            countdown: countdown,
          },
        }),
      );
    }

    const countdownInterval = setInterval(() => {
      countdown -= 1;
      setEndCountdown(countdown);

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        forceEndMeeting();
      } else if (
        socketRef.current &&
        socketRef.current.connected
      ) {
        sendSocketMessage(
          JSON.stringify({
            type: "meetingControl",
            payload: {
              action: "endCountdown",
              roomId: meetingId,
              adminId: currentUserId.current,
              countdown: countdown,
            },
          }),
        );
      }
    }, 1000);
  };

  const forceEndMeeting = () => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "meetingControl",
          payload: {
            action: "endMeeting",
            roomId: meetingId,
            adminId: currentUserId.current,
          },
        }),
      );
    }

    cleanup();
    navigate("/dashboard");
  };

  const addAdminNotification = (message, type = "info", duration = 3000) => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };

    setAdminNotifications((prev) => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications

    // Auto-remove after duration
    setTimeout(() => {
      setAdminNotifications((prev) =>
        prev.filter((n) => n.id !== notification.id),
      );
    }, duration);
  };

  const updateMeetingSettings = (setting, value) => {
    setMeetingSettings((prev) => ({ ...prev, [setting]: value }));

    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "meetingSettings",
          payload: {
            roomId: meetingId,
            adminId: currentUserId.current,
            settings: { [setting]: value },
          },
        }),
      );
    }
  };

  const handleMeetingControl = (payload) => {
    switch (payload.action) {
      case "toggleLock":
        if (payload.adminId !== currentUserId.current) {
          setMeetingSettings((prev) => ({
            ...prev,
            isLocked: payload.isLocked,
          }));
        }
        break;
      case "muteAll":
        if (payload.adminId !== currentUserId.current) {
          // Mute local audio
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
              setIsAudioEnabled(false);
            }
          }
        }
        break;
      case "toggleRecording":
        if (payload.adminId !== currentUserId.current) {
          setMeetingSettings((prev) => ({
            ...prev,
            isRecording: payload.isRecording,
          }));
        }
        break;
      case "endWarning":
        if (payload.adminId !== currentUserId.current) {
          addAdminNotification(
            `Admin is ending the meeting in ${payload.countdown} seconds`,
            "warning",
          );
        }
        break;
      case "endCountdown":
        if (payload.adminId !== currentUserId.current) {
          setEndCountdown(payload.countdown);
        }
        break;
      case "endMeeting":
        if (payload.adminId !== currentUserId.current) {
          cleanup();
          navigate("/dashboard");
        }
        break;
    }
  };

  const handleAdminNotification = (payload) => {
    if (
      user?.role === "admin" &&
      payload.targetAdmins?.includes(currentUserId.current)
    ) {
      addAdminNotification(payload.message, payload.type || "info");
    }
  };

  // Enhanced Participant Management Functions
  const admitAllWaiting = () => {
    waitingRoom.forEach((waitingUser) => {
      admitFromWaiting(waitingUser.userId);
    });
    addAdminNotification(
      `Admitted ${waitingRoom.length} participants`,
      "success",
    );
  };

  const clearAllRaisedHands = () => {
    raisedHands.forEach((hand) => {
      acknowledgeHand(hand.userId);
    });
    addAdminNotification(`Cleared ${raisedHands.length} raised hands`, "info");
  };

  const muteParticipant = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "participantControl",
          payload: {
            action: "mute",
            roomId: meetingId,
            targetUserId: userId,
            adminId: currentUserId.current,
          },
        }),
      );
    }

    const participant = participants.find((p) => p.id === userId);
    addAdminNotification(`Muted ${participant?.name || userId}`, "info");
  };

  const disableParticipantVideo = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "participantControl",
          payload: {
            action: "disableVideo",
            roomId: meetingId,
            targetUserId: userId,
            adminId: currentUserId.current,
          },
        }),
      );
    }

    const participant = participants.find((p) => p.id === userId);
    addAdminNotification(
      `Disabled video for ${participant?.name || userId}`,
      "info",
    );
  };

  const promoteToAdmin = (userId) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "participantControl",
          payload: {
            action: "promote",
            roomId: meetingId,
            targetUserId: userId,
            adminId: currentUserId.current,
          },
        }),
      );
    }

    const participant = participants.find((p) => p.id === userId);
    addAdminNotification(
      `Promoted ${participant?.name || userId} to admin`,
      "success",
    );
  };

  const bulkMuteAllExceptAdmins = () => {
    participants
      .filter((p) => p.role !== "admin")
      .forEach((participant) => {
        muteParticipant(participant.id);
      });
  };

  const kickParticipant = (userId, reason = "Removed by admin") => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        JSON.stringify({
          type: "participantControl",
          payload: {
            action: "kick",
            roomId: meetingId,
            targetUserId: userId,
            adminId: currentUserId.current,
            reason: reason,
          },
        }),
      );
    }

    const participant = participants.find((p) => p.id === userId);
    addAdminNotification(`Removed ${participant?.name || userId}`, "warning");
  };

  const handleParticipantControl = (payload) => {
    if (payload.targetUserId === currentUserId.current) {
      switch (payload.action) {
        case "mute":
          if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
              setIsAudioEnabled(false);
            }
          }
          addAdminNotification("You have been muted by admin", "warning");
          break;
        case "disableVideo":
          if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = false;
              setIsVideoEnabled(false);
            }
          }
          addAdminNotification(
            "Your video has been disabled by admin",
            "warning",
          );
          break;
        case "promote":
          // Update user role in context/store if needed
          addAdminNotification("You have been promoted to admin!", "success");
          break;
        case "kick":
          addAdminNotification(
            `You have been removed from the meeting: ${payload.reason}`,
            "error",
          );
          setTimeout(() => {
            cleanup();
            navigate("/dashboard");
          }, 2000);
          break;
      }
    } else if (user?.role === "admin") {
      // Notify other admins about participant control actions
      const participant = participants.find(
        (p) => p.id === payload.targetUserId,
      );
      const adminName =
        participants.find((p) => p.id === payload.adminId)?.name || "Admin";

      switch (payload.action) {
        case "mute":
          addAdminNotification(
            `${adminName} muted ${participant?.name || payload.targetUserId}`,
            "info",
          );
          break;
        case "disableVideo":
          addAdminNotification(
            `${adminName} disabled video for ${participant?.name || payload.targetUserId}`,
            "info",
          );
          break;
        case "promote":
          addAdminNotification(
            `${adminName} promoted ${participant?.name || payload.targetUserId} to admin`,
            "success",
          );
          break;
        case "kick":
          addAdminNotification(
            `${adminName} removed ${participant?.name || payload.targetUserId}`,
            "warning",
          );
          break;
      }
    }
  };

  const handleParticipantJoinedNotification = (payload) => {
    if (user?.role === "admin") {
      addAdminNotification(
        `${payload.userName || payload.userId} joined the meeting`,
        "info",
      );
    }
  };

  const handleParticipantLeftNotification = (payload) => {
    if (user?.role === "admin") {
      const reason = payload.reason ? ` (${payload.reason})` : "";
      addAdminNotification(
        `${payload.userName || payload.userId} left the meeting${reason}`,
        "info",
      );
    }
  };

  // Enhanced notification system with types and priorities
  const addNotificationToast = (message, type = "info", duration = 5000) => {
    const toast = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
      duration,
    };

    // Create toast notification (you could use a toast library here)
    const toastElement = document.createElement("div");
    toastElement.className = `fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 animate-in slide-in-from-right duration-300 ${
      type === "success"
        ? "btn-base btn-success"
        : type === "error"
          ? "btn-base btn-destructive"
          : type === "warning"
            ? "btn-base btn-warning"
            : "btn-base btn-primary"
    }`;

    toastElement.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="text-sm font-medium">${message}</div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-xs opacity-75 hover:opacity-100">×</button>
      </div>
    `;

    document.body.appendChild(toastElement);

    // Auto remove
    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.remove();
      }
    }, duration);
  };

  const handleRoomJoined = (payload) => {
    console.log("🏠 Room joined successfully:", payload);
    const { roomId, users, isRecording } = payload;
    
    // Set participants from existing room users
    if (users && Array.isArray(users)) {
      const participants = users
        .filter(user => user.id !== currentUserId.current) // Exclude self
        .map(user => ({
          id: user.id,
          name: user.name,
          isScreenSharing: user.isScreenSharing || false,
          isAudioMuted: user.isAudioMuted || false,
          isVideoMuted: user.isVideoMuted || false,
        }));
      
      console.log("👥 Setting initial participants:", participants);
      setParticipants(participants);
      
      // Create peer connections for existing users
      participants.forEach(participant => {
        console.log("🔗 Creating peer connection for existing user:", participant.id);
        createPeerConnection(participant.id, false); // Don't create offers yet, wait for them
      });
    }
    
    // Update recording status
    if (isRecording !== undefined) {
      setRecordingStatus(isRecording);
    }
  };

  const handleUserJoined = (payload) => {
    console.log("👥 User joined event:", payload);
    const userId = payload.user?.id;
    const userName = payload.user?.name;

    if (!userId) {
      console.error("❌ User joined event missing user ID:", payload);
      return;
    }

    // Check if we already have this user to prevent duplicates
    if (peerConnectionsRef.current.has(userId)) {
      console.log("👤 User already has peer connection:", userId);
      return;
    }

    if (!localStreamRef.current) {
      console.log("⏳ Local stream not ready, retrying...");
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn(
        "⚠️ Socket.IO not connected, retrying user join for:",
        userId,
      );
      setTimeout(() => handleUserJoined(payload), 100);
      return;
    }

    // Add to participants list
    setParticipants((prev) => {
      const existingUser = prev.find((p) => p.id === userId);
      if (existingUser) {
        console.log("👤 User already in participants:", userId);
        return prev;
      }
      console.log("➕ Adding new participant:", userId);
      return [
        ...prev,
        { id: userId, name: userName || userId },
      ];
    });

    // Tie-breaking logic to prevent glare
    const shouldCreateOffer = currentUserId.current > userId;

    if (shouldCreateOffer) {
      negotiationState.current.set(userId, "offering");
      console.log("🔍 Offer decision: Creating offer for", userId);
      createPeerConnection(userId, true);
    } else {
      negotiationState.current.set(userId, "stable");
      console.log("🔍 Offer decision: Waiting for offer from", userId);
      createPeerConnection(userId, false);
    }
  };

  const handleUserLeft = (payload) => {
    setParticipants((prev) => prev.filter((p) => p.id !== payload.userId));
    const pc = peerConnectionsRef.current.get(payload.userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(payload.userId);
      negotiationState.current.delete(payload.userId);
      console.log("🗑️ Removed peer connection for:", payload.userId);
    }
  };

  const handleParticipants = (payload) => {
    console.log("📋 Received participants list:", payload);

    // Process each existing participant - don't create offers, wait for them
    if (payload && Array.isArray(payload)) {
      payload.forEach((participant) => {
        if (
          participant.userId &&
          participant.userId !== currentUserId.current
        ) {
          if (peerConnectionsRef.current.has(participant.userId)) {
            console.log(
              "Skipping participant, already have a connection:",
              participant.userId,
            );
            return;
          }
          console.log(
            "👤 Processing existing participant:",
            participant.userId,
          );

          // Don't add to participants list if already exists
          setParticipants((prev) => {
            const existingUser = prev.find((p) => p.id === participant.userId);
            if (existingUser) {
              return prev;
            }
            return [
              ...prev,
              {
                id: participant.userId,
                name: participant.userName || participant.userId,
              },
            ];
          });

          // Create peer connection but don't create offer (wait for them to offer us)
          createPeerConnection(participant.userId, false);
        }
      });
    }
  };

  // Keep pinned stage video in sync with selected stream
  useEffect(() => {
    if (!pinnedVideoRef.current) return;
    if (pinnedId === "local") {
      if (localStreamRef.current) {
        pinnedVideoRef.current.srcObject = localStreamRef.current;
      }
    } else if (pinnedId) {
      const stream = remoteVideosRef.current.get(pinnedId);
      if (stream) {
        pinnedVideoRef.current.srcObject = stream;
      }
    }
  }, [pinnedId]);

  // Mirror pinnedId in a ref for access inside event handlers
  useEffect(() => {
    pinnedIdRef.current = pinnedId;
  }, [pinnedId]);

  // Update pinned video when local stream first becomes available
  useEffect(() => {
    if (
      pinnedId === "local" &&
      pinnedVideoRef.current &&
      localStreamRef.current
    ) {
      pinnedVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStream, pinnedId]);

  // Ensure the currently rendered local video element always has the stream
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [pinnedId, localStream]);

  const createPeerConnection = async (userId, shouldCreateOffer = true) => {
    if (!localStreamRef.current) {
      console.warn("Local stream not ready, cannot create peer connection");
      return null;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open, cannot create peer connection");
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "000000002068541318",
          credential: "cvDp8AdIOuPvV0MnH38biHJEYHA=",
        },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all",
      bundlePolicy: "balanced",
    });

    if (localStreamRef.current) {
      console.log("🎬 Adding local tracks to peer connection for:", userId);
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(
          "➕ Adding track:",
          track.kind,
          "enabled:",
          track.enabled,
          "readyState:",
          track.readyState,
        );
        pc.addTrack(track, localStreamRef.current);
      });
      console.log("✅ All local tracks added for:", userId);
    } else {
      console.warn("No local stream available for peer connection");
    }

    pc.ontrack = (event) => {
      console.log(
        "🎥 Received track event from:",
        userId,
        "Stream:",
        event.streams[0],
        "Tracks:",
        event.streams[0].getTracks(),
      );
      console.log(
        "📊 Track details:",
        event.streams[0].getTracks().map((track) => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        })),
      );

      if (!remoteVideosRef.current.has(userId)) {
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
      // If this user is currently pinned, update the stage video immediately
      if (pinnedIdRef.current === userId && pinnedVideoRef.current) {
        pinnedVideoRef.current.srcObject = event.streams[0];
      }
      const remoteVideo = document.getElementById(`remote-video-${userId}`);
      if (remoteVideo) {
        console.log(
          "📺 Setting remote video for:",
          userId,
          "Element found:",
          !!remoteVideo,
        );
        remoteVideo.srcObject = event.streams[0];
      } else {
        console.log(
          "❌ Remote video element not found for:",
          userId,
          "Buffering stream",
        );
        remoteVideosRef.current.set(userId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (
          socketRef.current &&
          socketRef.current.connected
        ) {
          sendIceCandidate(userId, event.candidate.toJSON());
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        console.log("ICE gathering complete for:", userId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔌 Connection state for", userId, ":", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("🎉 Peer connection SUCCESS with:", userId);
      } else if (pc.connectionState === "failed") {
        console.error("💥 Peer connection FAILED with:", userId);
        console.error("🔍 Debug info:", {
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          localDescription: !!pc.localDescription,
          remoteDescription: !!pc.remoteDescription,
        });

        if (pc.signalingState !== "closed") {
          console.log("🔄 Attempting ICE restart for:", userId);
          pc.restartIce();
        } else {
          console.warn(
            "⚠️ Peer connection closed, cannot restart ICE for:",
            userId,
          );
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(
        "🧊 ICE connection state for",
        userId,
        ":",
        pc.iceConnectionState,
      );
      if (pc.iceConnectionState === "connected") {
        console.log("🎯 ICE connection SUCCESS for:", userId);
      } else if (pc.iceConnectionState === "failed") {
        console.error("❄️ ICE connection FAILED for:", userId);
        // Log the stats for debugging
        pc.getStats().then((stats) => {
          stats.forEach((report) => {
            if (
              report.type === "candidate-pair" &&
              report.state === "succeeded"
            ) {
              console.log("✅ Successful candidate pair:", report);
            } else if (
              report.type === "local-candidate" ||
              report.type === "remote-candidate"
            ) {
              console.log(
                "📊 Candidate:",
                report.candidateType,
                report.ip,
                report.port,
              );
            }
          });
        });
      } else if (pc.iceConnectionState === "disconnected") {
        console.warn("⚡ ICE connection DISCONNECTED for:", userId);
      }
    };

    peerConnectionsRef.current.set(userId, pc);
    console.log(
      "💾 Stored peer connection for:",
      userId,
      "Total connections:",
      peerConnectionsRef.current.size,
    );
    console.log(
      "🗂️ Current peer connections:",
      Array.from(peerConnectionsRef.current.keys()),
    );

    if (pendingAnswers.current.has(userId)) {
      try {
        await pc.setRemoteDescription(pendingAnswers.current.get(userId));
        console.log("Applied buffered answer for:", userId);
        pendingAnswers.current.delete(userId);
      } catch (error) {
        console.error("Error applying buffered answer for:", userId, error);
      }
    }

    if (pendingCandidates.current.has(userId)) {
      const bufferedCandidates = pendingCandidates.current.get(userId);
      console.log(
        `Applying ${bufferedCandidates.length} buffered ICE candidates for:`,
        userId,
      );
      for (const candidateData of bufferedCandidates) {
        try {
          if (
            candidateData &&
            candidateData.candidate &&
            candidateData.candidate.trim() !== ""
          ) {
            const candidateInit = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidateInit);
            console.log("Applied buffered ICE candidate for:", userId);
          }
        } catch (error) {
          console.error(
            "Error applying buffered ICE candidate for:",
            userId,
            error,
          );
        }
      }
      pendingCandidates.current.delete(userId);
    }

    if (shouldCreateOffer) {
      try {
        console.log("📤 Creating offer for:", userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (
          socketRef.current &&
          socketRef.current.connected
        ) {
          console.log("📨 Sending offer to:", userId);
          sendOffer(userId, offer);
        } else {
          console.error("❌ WebSocket not open, cannot send offer to:", userId);
        }
      } catch (error) {
        console.error("❌ Error creating/sending offer to:", userId, error);
      }
    } else {
      console.log("⏳ Waiting to receive offer from:", userId);
    }

    return pc;
  };

  const handleOffer = async (payload) => {
    console.log("📥 Received offer from:", payload.senderId);

    const state = negotiationState.current.get(payload.senderId);
    if (state === "offering") {
      console.warn("⚠️ Glare detected! Ignoring offer from", payload.senderId);
      return;
    }
    negotiationState.current.set(payload.senderId, "answering");

    // Add sender to participants list if not already there
    setParticipants((prev) => {
      const existingUser = prev.find((p) => p.id === payload.senderId);
      if (existingUser) {
        return prev;
      }
      console.log("➕ Adding participant from offer:", payload.senderId);
      return [...prev, { id: payload.senderId, name: payload.senderId }];
    });

    // Wait a bit for React to render the participant before creating peer connection
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Ensure we have a peer connection
    let pc = peerConnectionsRef.current.get(payload.senderId);
    if (!pc) {
      console.log(
        "🔨 Creating peer connection for offer from:",
        payload.senderId,
      );
      pc = await createPeerConnection(payload.senderId, false);
    }

    if (!pc) {
      console.error(
        "❌ Failed to create peer connection for:",
        payload.senderId,
      );
      return;
    }

    try {
      console.log(
        "📝 Setting remote description for offer from:",
        payload.senderId,
      );
      await pc.setRemoteDescription(payload.sdp);

      console.log("📤 Creating answer for:", payload.senderId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (
        socketRef.current &&
        socketRef.current.connected
      ) {
        console.log("📨 Sending answer to:", payload.senderId);
        sendAnswer(payload.senderId, answer);
        negotiationState.current.set(payload.senderId, "stable");
      }
    } catch (error) {
      console.error("❌ Error handling offer from:", payload.senderId, error);
      negotiationState.current.set(payload.senderId, "stable");
    }
  };

  const handleAnswer = async (payload) => {
    console.log("📥 Received answer from:", payload.senderId);
    console.log(
      "🔍 Looking for peer connection. Available connections:",
      Array.from(peerConnectionsRef.current.keys()),
    );
    console.log(
      "🔍 peerConnectionsRef Map size:",
      peerConnectionsRef.current.size,
    );

    const pc = peerConnectionsRef.current.get(payload.senderId);
    if (!pc) {
      console.error(
        "❌ No peer connection found for answer from:",
        payload.senderId,
      );
      console.error(
        "🔍 Available peer connections:",
        Array.from(peerConnectionsRef.current.keys()),
      );
      console.log("📦 Buffering answer from:", payload.senderId);
      pendingAnswers.current.set(payload.senderId, payload.sdp);
      return;
    }

    try {
      console.log(
        "📝 Setting remote description for answer from:",
        payload.senderId,
      );
      await pc.setRemoteDescription(payload.sdp);
      negotiationState.current.set(payload.senderId, "stable");
      console.log(
        "✅ Remote description set successfully for:",
        payload.senderId,
      );

      // Process buffered ICE candidates
      if (pendingCandidates.current.has(payload.senderId)) {
        const bufferedCandidates = pendingCandidates.current.get(
          payload.senderId,
        );
        console.log(
          `📦 Processing ${bufferedCandidates.length} buffered ICE candidates for:`,
          payload.senderId,
        );

        for (const candidateData of bufferedCandidates) {
          try {
            if (
              candidateData &&
              candidateData.candidate &&
              candidateData.candidate.trim() !== ""
            ) {
              const candidateInit = new RTCIceCandidate(candidateData);
              await pc.addIceCandidate(candidateInit);
              console.log(
                "✅ Processed buffered ICE candidate for:",
                payload.senderId,
              );
            }
          } catch (error) {
            console.error("❌ Error processing buffered ICE candidate:", error);
          }
        }
        pendingCandidates.current.delete(payload.senderId);
      }
    } catch (error) {
      console.error("❌ Error setting remote description:", error);
    }
  };

  const handleIceCandidate = async (payload) => {
    if (
      !payload.candidate ||
      !payload.candidate.candidate ||
      payload.candidate.candidate.trim() === ""
    ) {
      console.error(
        "Invalid or empty ICE candidate received:",
        payload.candidate,
      );
      console.warn(
        "Check backend WebSocket server for candidate generation issues",
      );
      return;
    }

    const pc = peerConnectionsRef.current.get(payload.senderId);
    if (pc) {
      try {
        if (!pc.remoteDescription) {
          console.log(
            "Remote description not set, buffering ICE candidate from:",
            payload.senderId,
          );
          if (!pendingCandidates.current.has(payload.senderId)) {
            pendingCandidates.current.set(payload.senderId, []);
          }
          pendingCandidates.current
            .get(payload.senderId)
            .push(payload.candidate);
          return;
        }
        const candidateInit = new RTCIceCandidate(payload.candidate);
        await pc.addIceCandidate(candidateInit);
        console.log("ICE candidate added successfully for:", payload.senderId);
      } catch (error) {
        console.error("Error adding ICE candidate:", error, payload.candidate);
      }
    } else {
      console.log(
        "Peer connection not found, buffering ICE candidate from:",
        payload.senderId,
      );
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
          audio: true,
        });
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
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
      console.error("Error toggling screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
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
      navigate("/");
    } else {
      navigate("/dashboard");
    }
  };

  const generateMeetingLink = () => {
    return `${window.location.origin}/meeting/${meetingId}/join`;
  };

  const handleCopyMeetingLink = async () => {
    const meetingLink = generateMeetingLink();
    try {
      await navigator.clipboard.writeText(meetingLink);
      alert("Meeting link copied to clipboard!");
    } catch (error) {
      const textArea = document.createElement("textarea");
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        alert("Meeting link copied to clipboard!");
      } catch (fallbackError) {
        alert(`Failed to copy link. Please copy manually: ${meetingLink}`);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleInviteUsers = () => {
    const emails = prompt("Enter email addresses (comma-separated):");
    if (!emails) return;
    const emailList = emails
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email);
    if (emailList.length === 0) return;
    sendInvitations(emailList);
  };

  const sendInvitations = async (emails) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: JSON.stringify({
            meeting_id: parseInt(meetingId),
            emails: emails,
            message: `You're invited to join the meeting`,
          }),
        },
      );
      const result = await response.json();
      if (response.ok && result.success) {
        alert(`Invitations sent successfully to ${emails.join(", ")}`);
      } else {
        alert(
          "Failed to send invitations: " + (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      alert("Error sending invitations: " + error.message);
    }
  };

  const sendTypingStatus = (roomId, userId, isTyping) => {
    if (socketRef.current && socketRef.current.connected) {
      sendSocketMessage(
        "typingStatus", {
            roomId: roomId,
            userId: userId,
            isTyping: isTyping,
          }
      );
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    peerConnectionsRef.current.forEach((pc) => pc.close());
    if (socketRef.current) {
      socketRef.current.close();
    }
    setLocalStream(null);
    peerConnectionsRef.current.clear();
    setSocket(null);
  };

  // Enhanced responsive video grid layout with adaptive sizing
  const getGridLayout = (numParticipants) => {
    if (numParticipants === 1) return "grid-cols-1";
    if (numParticipants === 2) return "grid-cols-1 md:grid-cols-2";
    if (numParticipants === 3)
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    if (numParticipants === 4) return "grid-cols-2 lg:grid-cols-2";
    if (numParticipants <= 6) return "grid-cols-2 md:grid-cols-3";
    if (numParticipants <= 9) return "grid-cols-3";
    if (numParticipants <= 16) return "grid-cols-3 lg:grid-cols-4";
    return "grid-cols-4";
  };

  // Get participant count for layout calculation
  const totalParticipants = participants.length + 1;

  // Monitor permission requests and raise hands for admin notifications
  useEffect(() => {
    if (user?.role === "admin" && permissionRequests.length > 0) {
      const latestRequest = permissionRequests[permissionRequests.length - 1];
      addNotificationToast(
        `New permission request from ${latestRequest.userName}`,
        "info",
      );
    }
  }, [permissionRequests.length]);

  useEffect(() => {
    if (user?.role === "admin" && raisedHands.length > 0) {
      const latestHand = raisedHands[raisedHands.length - 1];
      addNotificationToast(`${latestHand.userName} raised their hand`, "info");
    }
  }, [raisedHands.length]);

  // Enhanced default meeting state for no-video scenarios
  const DefaultMeetingState = () => (
    <Card className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-20 h-20 btn-base btn-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-10 h-10 text-on-dark" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Ready to connect</h3>
        <p className="text-muted mb-4">
          Turn on your camera and microphone when ready to join the
          conversation.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={toggleVideo} variant="outline" className="gap-2">
            <Video className="w-4 h-4" />
            Turn on camera
          </Button>
          <Button onClick={toggleAudio} variant="outline" className="gap-2">
            <Mic className="w-4 h-4" />
            Unmute
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top App Bar */}
      <header className="bg-card border-b border-border px-6 py-3 shadow-sm">
        <div className="flex justify-between items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              Meeting • {meetingId}
            </h1>
            <p className="text-xs text-muted-foreground">
              {participants.length + 1} participant
              {participants.length === 0 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button
                onClick={handleInviteUsers}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </Button>
            )}
            <Button
              onClick={handleCopyMeetingLink}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Share className="w-4 h-4" />
              Share
            </Button>
            <Button
              onClick={() => setShowParticipants(!showParticipants)}
              variant={showParticipants ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              People
            </Button>
            <Button
              onClick={() => setShowChat(!showChat)}
              variant={showChat ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </Button>
            <Button onClick={toggleDarkMode} variant="outline" size="sm">
              {isDarkMode ? (
                <MdLightMode className="w-4 h-4" />
              ) : (
                <MdDarkMode className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {isLoadingMedia ? (
          <div className="flex-1 flex items-center justify-center flex-col">
            <LoadingSpinner size={60} />
            <p className="mt-3 text-lg text-muted-foreground">
              Loading media devices...
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Enhanced Stage + Grid/Filmstrip Layout */}
            {!pinnedId ? (
              totalParticipants === 1 && !isVideoEnabled ? (
                <DefaultMeetingState />
              ) : (
                <div
                  className={`grid ${getGridLayout(totalParticipants)} gap-4 flex-1 auto-rows-[minmax(0,1fr)]`}
                >
                  {/* Local Tile */}
                  <Card
                    className={`relative overflow-hidden rounded-xl border-border bg-black aspect-video ${speakingUsers.includes("local") ? "ring-2 ring-green-500" : ""}`}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs">
                      You {isScreenSharing && "(Screen Sharing)"}
                      {speakingUsers.includes("local") && (
                        <span className="ml-2 inline-flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        </span>
                      )}
                    </div>
                    {/* Pin button */}
                    <div className="absolute top-2 right-2">
                      <Button
                        onClick={() => setPinnedId("local")}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full"
                        title="Pin"
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                    </div>
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                        <VideoOff className="w-12 h-12 text-neutral-400" />
                      </div>
                    )}
                  </Card>

                  {/* Remote Tiles */}
                  {participants.map((participant) => (
                    <Card
                      key={participant.id}
                      className={`relative overflow-hidden rounded-xl border-border bg-black aspect-video ${speakingUsers.includes(participant.id) ? "ring-2 ring-green-500" : ""}`}
                    >
                      <video
                        id={`remote-video-${participant.id}`}
                        ref={(videoElement) => {
                          console.log(
                            "🎬 Video element ref callback for:",
                            participant.id,
                            "Element:",
                            !!videoElement,
                            "Has stream:",
                            remoteVideosRef.current.has(participant.id),
                          );
                          if (videoElement) {
                            if (remoteVideosRef.current.has(participant.id)) {
                              console.log(
                                "📺 Applying buffered stream to video element for:",
                                participant.id,
                              );
                              videoElement.srcObject =
                                remoteVideosRef.current.get(participant.id);
                            }
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs">
                        {participant.name}
                        {speakingUsers.includes(participant.id) && (
                          <span className="ml-2 inline-flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          </span>
                        )}
                      </div>
                      {/* Pin button */}
                      <div className="absolute top-2 right-2">
                        <Button
                          onClick={() => setPinnedId(participant.id)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          title="Pin"
                        >
                          <Pin className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                {/* Enhanced Spotlight stage with screen share detection */}
                <Card
                  className={`relative flex-1 overflow-hidden rounded-xl border-border bg-black ${isScreenSharing && pinnedId === "local" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <video
                    ref={pinnedVideoRef}
                    autoPlay
                    playsInline
                    muted={pinnedId === "local"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs">
                    {pinnedId === "local"
                      ? `You${isScreenSharing ? " (Screen Sharing)" : ""}`
                      : participants.find((p) => p.id === pinnedId)?.name ||
                        pinnedId}
                    {speakingUsers.includes(pinnedId) && (
                      <span className="ml-2 inline-flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      </span>
                    )}
                  </div>
                  {/* Unpin button */}
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <Button
                      onClick={() => setPinnedId(null)}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full"
                      title="Unpin"
                    >
                      <PinOff className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* Filmstrip */}
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {/* Local thumbnail (if not pinned) */}
                  {pinnedId !== "local" && (
                    <Card
                      className={`relative overflow-hidden rounded-lg border-border bg-black w-56 h-32 shrink-0 aspect-video ${speakingUsers.includes("local") ? "ring-2 ring-green-500" : ""}`}
                    >
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px]">
                        You {isScreenSharing && "(Screen Sharing)"}
                        {speakingUsers.includes("local") && (
                          <span className="ml-1 inline-flex items-center">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <Button
                          onClick={() => setPinnedId("local")}
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full"
                          title="Pin"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Remote thumbnails (exclude pinned) */}
                  {participants
                    .filter((p) => p.id !== pinnedId)
                    .map((participant) => (
                      <Card
                        key={participant.id}
                        className={`relative overflow-hidden rounded-lg border-border bg-black w-56 h-32 shrink-0 aspect-video ${speakingUsers.includes(participant.id) ? "ring-2 ring-green-500" : ""}`}
                      >
                        <video
                          id={`remote-video-${participant.id}`}
                          ref={(videoElement) => {
                            if (videoElement) {
                              if (remoteVideosRef.current.has(participant.id)) {
                                videoElement.srcObject =
                                  remoteVideosRef.current.get(participant.id);
                              }
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px]">
                          {participant.name}
                          {speakingUsers.includes(participant.id) && (
                            <span className="ml-1 inline-flex items-center">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                            </span>
                          )}
                        </div>
                        <div className="absolute top-2 right-2">
                          <Button
                            onClick={() => setPinnedId(participant.id)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full"
                            title="Pin"
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="flex justify-center items-center pb-2">
              <Card className="rounded-full px-4 py-2 border-border bg-card/80 backdrop-blur-lg supports-[backdrop-filter]:bg-card/60 shadow-lg">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={toggleAudio}
                    size="sm"
                    variant={isAudioEnabled ? "default" : "destructive"}
                    className="rounded-full w-12 h-12 p-0"
                  >
                    {isAudioEnabled ? (
                      <Mic className="w-5 h-5" />
                    ) : (
                      <MicOff className="w-5 h-5" />
                    )}
                  </Button>
                  <Button
                    onClick={toggleVideo}
                    size="sm"
                    variant={isVideoEnabled ? "default" : "destructive"}
                    className="rounded-full w-12 h-12 p-0"
                  >
                    {isVideoEnabled ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <VideoOff className="w-5 h-5" />
                    )}
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
                    size="sm"
                    variant="outline"
                    className="rounded-full w-12 h-12 p-0"
                    title="Request Permissions"
                    onClick={() => setShowPermissionRequest(true)}
                  >
                    <UserPlus className="w-5 h-5" />
                  </Button>
                  {/* Spacer */}
                  <div className="w-2" />
                  <Button
                    onClick={leaveMeeting}
                    size="sm"
                    variant="destructive"
                    className="rounded-full w-16 h-12 p-0"
                    title="Leave call"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </Button>
                  {/* Spacer */}
                  <div className="w-2" />
                  <Button
                    onClick={() => setShowParticipants(!showParticipants)}
                    size="sm"
                    variant={showParticipants ? "default" : "outline"}
                    className="rounded-full w-12 h-12 p-0"
                    title="People"
                  >
                    <Users className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() => setShowChat(!showChat)}
                    size="sm"
                    variant={showChat ? "default" : "outline"}
                    className="rounded-full w-12 h-12 p-0"
                    title="Chat"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full w-12 h-12 p-0"
                    title="Layout"
                    disabled
                  >
                    <LayoutGrid className="w-5 h-5 opacity-50" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full w-12 h-12 p-0"
                    title="More options"
                    disabled
                  >
                    <MoreVertical className="w-5 h-5 opacity-50" />
                  </Button>
                  <Button
                    onClick={toggleRaiseHand}
                    size="sm"
                    variant={isHandRaised ? "default" : "outline"}
                    className={`rounded-full w-12 h-12 p-0 ${isHandRaised ? "bg-yellow-500 hover:bg-yellow-600" : ""}`}
                    title={isHandRaised ? "Lower Hand" : "Raise Hand"}
                  >
                    <Hand
                      className={`w-5 h-5 ${isHandRaised ? "text-white" : ""}`}
                    />
                  </Button>
                  {user?.role === "admin" && (
                    <Button
                      onClick={() => setShowAdminControls(!showAdminControls)}
                      size="sm"
                      variant={showAdminControls ? "default" : "outline"}
                      className="rounded-full w-12 h-12 p-0"
                      title="Admin Controls"
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
        {(showChat || showParticipants) && (
          <aside className="w-80 bg-card border-l border-border flex flex-col shadow-lg max-h-full overflow-hidden">
            {showParticipants && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Waiting Room Section - Only visible to admins */}
                {user?.role === "admin" && waitingRoom.length > 0 && (
                  <div className="border-b border-border">
                    <div className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Waiting Room ({waitingRoom.length})
                      </h3>
                      <div className="space-y-2">
                        {waitingRoom.map((waitingUser) => (
                          <div
                            key={waitingUser.userId}
                            className="flex items-center gap-2"
                          >
                            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">
                              {waitingUser.userName[0]}
                            </div>
                            <span className="text-sm flex-1">
                              {waitingUser.userName}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  admitFromWaiting(waitingUser.userId)
                                }
                              >
                                Admit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  removeParticipant(waitingUser.userId)
                                }
                                title="Deny"
                              >
                                <UserX className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Raised Hands Queue */}
                {raisedHands.length > 0 && (
                  <div className="border-b border-border">
                    <div className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Hand className="w-4 h-4 text-yellow-500" />
                        Raised Hands ({raisedHands.length})
                      </h3>
                      <div className="space-y-2">
                        {raisedHands.map((hand, index) => (
                          <div
                            key={hand.userId}
                            className="flex items-center gap-2"
                          >
                            <div className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center text-sm">
                              {hand.userName[0]}
                            </div>
                            <span className="text-sm flex-1">
                              {hand.userName}
                            </span>
                            {user?.role === "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => acknowledgeHand(hand.userId)}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Participants List with Scrollable Area */}
                <div className="flex-1 overflow-hidden">
                  <div className="p-4">
                    <h3 className="font-semibold mb-3">
                      Participants ({participants.length + 1})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="space-y-2">
                      {/* Local User */}
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm relative">
                          {user?.first_name?.[0] || "Y"}
                          {user?.role === "admin" && (
                            <Crown className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            You {isHandRaised && "✋"}
                          </span>
                          {speakingUsers.includes("local") && (
                            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Volume2 className="w-3 h-3" />
                              <span>Speaking</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isAudioEnabled ? (
                            <Mic className="w-4 h-4 text-green-500" />
                          ) : (
                            <MicOff className="w-4 h-4 text-red-500" />
                          )}
                          {isVideoEnabled ? (
                            <Video className="w-4 h-4 text-green-500" />
                          ) : (
                            <VideoOff className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>

                      {/* Remote Participants */}
                      {participants.map((participant) => {
                        const hasRaisedHand = raisedHands.some(
                          (hand) => hand.userId === participant.id,
                        );
                        const isSpeaking = speakingUsers.includes(
                          participant.id,
                        );

                        return (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm relative">
                              {participant.name[0]}
                              {participant.role === "admin" && (
                                <Crown className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm truncate">
                                {participant.name} {hasRaisedHand && "✋"}
                              </span>
                              {isSpeaking && (
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                  <Volume2 className="w-3 h-3" />
                                  <span>Speaking</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Placeholder for remote audio/video status */}
                              <Mic className="w-4 h-4 text-muted-foreground" />
                              <Video className="w-4 h-4 text-muted-foreground" />

                              {/* Admin controls */}
                              {user?.role === "admin" && (
                                <div className="flex gap-1 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Mute participant"
                                    onClick={() =>
                                      muteParticipant(participant.id)
                                    }
                                  >
                                    <VolumeX className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Disable video"
                                    onClick={() =>
                                      disableParticipantVideo(participant.id)
                                    }
                                  >
                                    <VideoOff className="w-4 h-4" />
                                  </Button>
                                  {participant.role !== "admin" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Promote to admin"
                                      onClick={() =>
                                        promoteToAdmin(participant.id)
                                      }
                                    >
                                      <Crown className="w-4 h-4 text-yellow-500" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Remove participant"
                                    onClick={() =>
                                      kickParticipant(participant.id)
                                    }
                                  >
                                    <UserX className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showChat && (
              <div className="flex-1 p-4">
                <MeetingChatInterface
                  roomId={meetingId}
                  meetingId={meetingId}
                  socket={socketRef.current}
                  participants={participants}
                  onMessageCount={(count) => {
                    // Optional: Update message count if needed
                    console.log("New message count:", count);
                  }}
                />
              </div>
            )}
          </aside>
        )}
        {showAdminControls && (
          <aside className="w-80 bg-card border-l border-border flex flex-col shadow-lg overflow-hidden">
            {/* Admin Control Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Admin Controls
                </h3>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Meeting management & controls
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Admin Notifications */}
              {adminNotifications.length > 0 && (
                <div className="p-3 border-b border-border bg-yellow-50 dark:bg-yellow-950">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Recent Actions
                    </span>
                  </div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {adminNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="text-xs text-yellow-700 dark:text-yellow-300"
                      >
                        <span className="font-mono">
                          {notification.timestamp}
                        </span>{" "}
                        - {notification.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Controls */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <Power className="w-4 h-4" />
                  Meeting Controls
                </div>

                {/* Primary Controls Row 1 */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="flex items-center gap-2 h-10"
                    variant={meetingSettings.isLocked ? "default" : "outline"}
                    onClick={toggleMeetingLock}
                  >
                    {meetingSettings.isLocked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                    {meetingSettings.isLocked ? "Unlock" : "Lock"}
                  </Button>

                  <Button
                    className="flex items-center gap-2 h-10"
                    variant="outline"
                    onClick={muteAllParticipants}
                  >
                    <VolumeX className="w-4 h-4" />
                    Mute All
                  </Button>
                </div>

                {/* Primary Controls Row 2 */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="flex items-center gap-2 h-10"
                    variant={
                      meetingSettings.isRecording ? "destructive" : "outline"
                    }
                    onClick={toggleRecording}
                  >
                    {meetingSettings.isRecording ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Record className="w-4 h-4" />
                    )}
                    {meetingSettings.isRecording ? "Stop Rec" : "Record"}
                  </Button>

                  <Button
                    className="flex items-center gap-2 h-10"
                    variant="destructive"
                    onClick={endMeetingWithConfirmation}
                  >
                    <Power className="w-4 h-4" />
                    End Meeting
                  </Button>
                </div>

                {/* Meeting Settings */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                    <Settings className="w-4 h-4" />
                    Meeting Settings
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Allow Chat</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={meetingSettings.allowChat}
                          onChange={(e) =>
                            updateMeetingSettings("allowChat", e.target.checked)
                          }
                        />
                        <div className="w-9 h-5 bg-muted0 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-muted0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Screen Share</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={meetingSettings.allowScreenShare}
                          onChange={(e) =>
                            updateMeetingSettings(
                              "allowScreenShare",
                              e.target.checked,
                            )
                          }
                        />
                        <div className="w-9 h-5 bg-muted0 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-muted0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Require Permission</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={meetingSettings.requirePermission}
                          onChange={(e) =>
                            updateMeetingSettings(
                              "requirePermission",
                              e.target.checked,
                            )
                          }
                        />
                        <div className="w-9 h-5 bg-muted0 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-muted0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Permission Management */}
                <div className="pt-3 border-t border-border">
                  <Button
                    className="w-full justify-between"
                    variant="outline"
                    onClick={() => setShowAdminApproval(true)}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Permission Requests
                    </span>
                    {permissionRequests.length > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {permissionRequests.length}
                      </span>
                    )}
                  </Button>
                </div>

                {/* Participant Management */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                    <Users className="w-4 h-4" />
                    Quick Actions
                  </div>

                  <div className="space-y-2">
                    {waitingRoom.length > 0 && (
                      <Button
                        className="w-full justify-between text-sm"
                        variant="outline"
                        size="sm"
                        onClick={admitAllWaiting}
                      >
                        <span>Admit All Waiting</span>
                        <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {waitingRoom.length}
                        </span>
                      </Button>
                    )}

                    {raisedHands.length > 0 && (
                      <Button
                        className="w-full justify-between text-sm"
                        variant="outline"
                        size="sm"
                        onClick={clearAllRaisedHands}
                      >
                        <span>Clear All Hands</span>
                        <span className="bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {raisedHands.length}
                        </span>
                      </Button>
                    )}

                    {participants.length > 0 && (
                      <Button
                        className="w-full text-sm"
                        variant="outline"
                        size="sm"
                        onClick={bulkMuteAllExceptAdmins}
                      >
                        Mute Non-Admins
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Permission Request Modal */}
      <PermissionRequestModal
        isOpen={showPermissionRequest}
        onClose={() => setShowPermissionRequest(false)}
        onSendRequest={sendPermissionRequest}
      />

      {/* Admin Approval Modal */}
      <AdminApprovalModal
        isOpen={showAdminApproval}
        onClose={() => setShowAdminApproval(false)}
        permissionRequests={permissionRequests}
        onApprove={handlePermissionApproval}
        onDeny={handlePermissionDenial}
        onBulkAction={handleBulkPermissionAction}
      />

      {/* End Meeting Confirmation Dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold">End Meeting</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to end this meeting? This will disconnect
              all participants and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmEndMeeting}>
                End Meeting
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* End Meeting Countdown */}
      {endCountdown !== null && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="font-medium">
              Meeting ending in {endCountdown} seconds
            </span>
          </div>
        </div>
      )}

      {/* Real-time permission status indicators */}
      {(permissionStatus.audio === "pending" ||
        permissionStatus.video === "pending" ||
        permissionStatus.screen === "pending") && (
        <div className="fixed bottom-20 right-4 bg-card border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium mb-2">Permission Status</div>
          <div className="space-y-1 text-xs">
            {permissionStatus.audio === "pending" && (
              <div className="flex items-center gap-2">
                <Mic className="w-3 h-3" />
                <span>Microphone: Pending</span>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
            )}
            {permissionStatus.video === "pending" && (
              <div className="flex items-center gap-2">
                <Video className="w-3 h-3" />
                <span>Camera: Pending</span>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
            )}
            {permissionStatus.screen === "pending" && (
              <div className="flex items-center gap-2">
                <Monitor className="w-3 h-3" />
                <span>Screen Share: Pending</span>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced WebSocket message handlers for Task 10 - outside component to avoid re-creation
const createEnhancedHandlers = (
  setSpeakingUsers,
  setParticipants,
  setEndCountdown,
  addAdminNotification,
  setMeetingSettings,
  setRaisedHands,
  setWaitingRoom,
  navigate,
  localStream,
  peerConnectionsRef,
  socketRef,
  currentUserId,
) => ({
  handleSpeakingDetection: (payload) => {
    const { userId, isSpeaking, audioLevel, timestamp } = payload;

    setSpeakingUsers((prev) => {
      if (isSpeaking) {
        const existingIndex = prev.findIndex(
          (speaker) => speaker.userId === userId,
        );
        const speakerData = {
          userId,
          audioLevel: audioLevel || 0,
          timestamp: timestamp || Date.now(),
        };

        if (existingIndex >= 0) {
          const newSpeakers = [...prev];
          newSpeakers[existingIndex] = speakerData;
          return newSpeakers;
        } else {
          return [...prev, speakerData];
        }
      } else {
        return prev.filter((speaker) => speaker.userId !== userId);
      }
    });

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === userId
          ? {
              ...p,
              isSpeaking,
              audioLevel: audioLevel || 0,
              lastSpeaking: timestamp || Date.now(),
            }
          : p,
      ),
    );
  },

  handleMeetingTermination: (payload) => {
    const { reason, countdown, adminName } = payload;

    if (countdown && countdown > 0) {
      setEndCountdown(countdown);
      addAdminNotification(
        `Meeting will end in ${countdown} seconds${adminName ? ` (ended by ${adminName})` : ""}`,
        "warning",
      );

      let timeLeft = countdown;
      const countdownInterval = setInterval(() => {
        timeLeft -= 1;
        setEndCountdown(timeLeft);

        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          handleForcedDisconnection(reason);
        } else if (timeLeft <= 5) {
          addAdminNotification(
            `Meeting ending in ${timeLeft} seconds`,
            "error",
          );
        }
      }, 1000);
    } else {
      handleForcedDisconnection(reason);
    }
  },

  handleForcedDisconnection: (reason) => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (socketRef.current) {
      socketRef.current.close();
    }

    addAdminNotification(
      reason === "ended_by_admin"
        ? "Meeting was ended by admin"
        : reason === "scheduled_end"
          ? "Meeting reached scheduled end time"
          : reason === "system_maintenance"
            ? "Meeting ended due to system maintenance"
            : "Meeting has ended",
      "error",
    );

    setTimeout(() => {
      navigate("/dashboard");
    }, 3000);
  },

  handleStateSync: (payload) => {
    const { meetingState, participants: syncParticipants, settings } = payload;

    if (settings) {
      setMeetingSettings((prev) => ({ ...prev, ...settings }));
    }

    if (syncParticipants) {
      setParticipants(syncParticipants);
    }

    if (meetingState) {
      if (meetingState.raisedHands) {
        setRaisedHands(meetingState.raisedHands);
      }
      if (meetingState.waitingRoom) {
        setWaitingRoom(meetingState.waitingRoom);
      }
      if (meetingState.speakingUsers) {
        setSpeakingUsers(meetingState.speakingUsers);
      }
    }
  },

  handleConnectionQuality: (payload) => {
    const { userId, quality, bandwidth, latency, packetLoss } = payload;

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === userId
          ? {
              ...p,
              connectionQuality: {
                quality: quality || "good",
                bandwidth: bandwidth || 0,
                latency: latency || 0,
                packetLoss: packetLoss || 0,
                lastUpdate: Date.now(),
              },
            }
          : p,
      ),
    );

    if (quality === "poor" && userId === currentUserId.current) {
      addAdminNotification("Poor connection quality detected", "warning");
    }
  },
});

export default VideoConference;
