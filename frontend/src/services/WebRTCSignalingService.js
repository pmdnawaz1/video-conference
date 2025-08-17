/**
 * WebRTC Signaling Service
 * Handles WebRTC signaling communication with the backend
 * Ensures compatibility with backend WebSocket message formats
 */
import webSocketService from './WebSocketService.js';

class WebRTCSignalingService {
  constructor() {
    this.isConnected = false;
    this.currentUser = null;
    this.currentRoom = null;
    this.messageHandlers = new Map();
    this.setupEventHandlers();
  }

  // ===========================================
  // Connection Management
  // ===========================================

  async connect(serverUrl, user) {
    try {
      await webSocketService.connect(serverUrl);
      this.currentUser = user;
      
      // Join the server first
      await this.joinServer(user);
      
      this.isConnected = true;
      console.log('🟢 WebRTC Signaling connected');
      return { success: true };
    } catch (error) {
      console.error('❌ WebRTC Signaling connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  disconnect() {
    if (this.currentRoom) {
      this.leaveRoom();
    }
    webSocketService.disconnect();
    this.isConnected = false;
    this.currentUser = null;
    this.currentRoom = null;
    console.log('🔴 WebRTC Signaling disconnected');
  }

  // ===========================================
  // Server and Room Management
  // ===========================================

  async joinServer(user) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server join timeout'));
      }, 10000);

      // Listen for server join response
      const handleServerJoined = (data) => {
        clearTimeout(timeout);
        webSocketService.off('server-joined', handleServerJoined);
        webSocketService.off('error', handleError);
        
        if (data.success) {
          console.log('✅ Joined WebRTC server:', data.message);
          resolve(data);
        } else {
          reject(new Error(data.message || 'Failed to join server'));
        }
      };

      const handleError = (data) => {
        clearTimeout(timeout);
        webSocketService.off('server-joined', handleServerJoined);
        webSocketService.off('error', handleError);
        reject(new Error(data.message || 'Server join failed'));
      };

      webSocketService.on('server-joined', handleServerJoined);
      webSocketService.on('error', handleError);

      // Send join server message
      webSocketService.send('join-server', {
        name: user.firstName + ' ' + user.lastName,
        email: user.email,
        userId: user.id
      });
    });
  }

  async createRoom(roomName, maxUsers = 50, meetingId = null) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room creation timeout'));
      }, 10000);

      const handleRoomCreated = (data) => {
        clearTimeout(timeout);
        webSocketService.off('room-created', handleRoomCreated);
        webSocketService.off('error', handleError);
        
        if (data.success) {
          console.log('✅ Room created:', data.roomId);
          resolve(data);
        } else {
          reject(new Error('Failed to create room'));
        }
      };

      const handleError = (data) => {
        clearTimeout(timeout);
        webSocketService.off('room-created', handleRoomCreated);
        webSocketService.off('error', handleError);
        reject(new Error(data.message || 'Room creation failed'));
      };

      webSocketService.on('room-created', handleRoomCreated);
      webSocketService.on('error', handleError);

      webSocketService.send('create-room', {
        roomName,
        maxUsers,
        meetingId
      });
    });
  }

  async joinRoom(roomId, meetingId = null) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 10000);

      const handleRoomJoined = (data) => {
        clearTimeout(timeout);
        webSocketService.off('room-joined', handleRoomJoined);
        webSocketService.off('error', handleError);
        
        this.currentRoom = {
          id: roomId,
          users: data.users || [],
          isRecording: data.isRecording || false
        };
        
        console.log('✅ Joined room:', roomId);
        resolve(data);
      };

      const handleError = (data) => {
        clearTimeout(timeout);
        webSocketService.off('room-joined', handleRoomJoined);
        webSocketService.off('error', handleError);
        reject(new Error(data.message || 'Room join failed'));
      };

      webSocketService.on('room-joined', handleRoomJoined);
      webSocketService.on('error', handleError);

      webSocketService.send('join-room', {
        roomId,
        meetingId
      });
    });
  }

  leaveRoom() {
    if (this.currentRoom) {
      webSocketService.send('leave-room', {});
      this.currentRoom = null;
      console.log('👋 Left room');
    }
  }

  // ===========================================
  // WebRTC Signaling
  // ===========================================

  sendOffer(targetUserId, offer) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('offer', {
      roomId: this.currentRoom.id,
      targetUserId,
      offer
    });
  }

  sendAnswer(targetUserId, answer) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('answer', {
      roomId: this.currentRoom.id,
      targetUserId,
      answer
    });
  }

  sendIceCandidate(targetUserId, candidate) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('ice-candidate', {
      roomId: this.currentRoom.id,
      targetUserId,
      candidate
    });
  }

  // ===========================================
  // Media Controls
  // ===========================================

  startScreenShare() {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('start-screen-share', {
      roomId: this.currentRoom.id
    });
  }

  stopScreenShare() {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('stop-screen-share', {
      roomId: this.currentRoom.id
    });
  }

  toggleAudio(muted) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('toggle-audio', {
      roomId: this.currentRoom.id,
      muted
    });
  }

  toggleVideo(muted) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('toggle-video', {
      roomId: this.currentRoom.id,
      muted
    });
  }

  // ===========================================
  // Chat and Communication
  // ===========================================

  sendChatMessage(message, meetingId = null, replyToId = null, mentionedUsers = []) {
    if (!this.currentRoom) {
      throw new Error('Not in a room');
    }

    webSocketService.send('chat-message', {
      roomId: this.currentRoom.id,
      message,
      meetingId,
      replyToId,
      mentionedUsers
    });
  }

  sendPrivateMessage(toUserId, content) {
    webSocketService.send('private-message', {
      toUserId,
      content
    });
  }

  startTyping(meetingId = null) {
    if (!this.currentRoom) return;

    webSocketService.send('typing-start', {
      roomId: this.currentRoom.id,
      meetingId
    });
  }

  stopTyping(meetingId = null) {
    if (!this.currentRoom) return;

    webSocketService.send('typing-stop', {
      roomId: this.currentRoom.id,
      meetingId
    });
  }

  // ===========================================
  // Reactions and Interactions
  // ===========================================

  sendMessageReaction(messageId, emoji) {
    webSocketService.send('message-reaction', {
      messageId,
      emoji
    });
  }

  editMessage(messageId, newContent) {
    webSocketService.send('edit-message', {
      messageId,
      newContent
    });
  }

  deleteMessage(messageId, isModeration = false) {
    webSocketService.send('delete-message', {
      messageId,
      isModeration
    });
  }

  raiseHand(meetingId = null) {
    if (!this.currentRoom) return;

    webSocketService.send('raise-hand', {
      roomId: this.currentRoom.id,
      meetingId
    });
  }

  lowerHand(meetingId = null) {
    if (!this.currentRoom) return;

    webSocketService.send('lower-hand', {
      roomId: this.currentRoom.id,
      meetingId
    });
  }

  sendEmojiReaction(emoji, meetingId = null) {
    if (!this.currentRoom) return;

    webSocketService.send('emoji-reaction', {
      roomId: this.currentRoom.id,
      meetingId,
      emoji
    });
  }

  // ===========================================
  // Connection Quality
  // ===========================================

  reportConnectionQuality(quality, stats = null) {
    if (!this.currentRoom) return;

    webSocketService.send('connection-quality', {
      roomId: this.currentRoom.id,
      quality,
      stats
    });
  }

  // ===========================================
  // Event Handlers
  // ===========================================

  setupEventHandlers() {
    // WebRTC signaling events
    webSocketService.on('offer', (data) => {
      this.notifyHandlers('offer', data);
    });

    webSocketService.on('answer', (data) => {
      this.notifyHandlers('answer', data);
    });

    webSocketService.on('ice-candidate', (data) => {
      this.notifyHandlers('ice-candidate', data);
    });

    // Room events
    webSocketService.on('user-joined', (data) => {
      if (this.currentRoom && data.user) {
        this.currentRoom.users.push(data.user);
      }
      this.notifyHandlers('user-joined', data);
    });

    webSocketService.on('user-left', (data) => {
      if (this.currentRoom) {
        this.currentRoom.users = this.currentRoom.users.filter(
          user => user.id !== data.userId
        );
      }
      this.notifyHandlers('user-left', data);
    });

    // Media events
    webSocketService.on('screen-share-started', (data) => {
      this.notifyHandlers('screen-share-started', data);
    });

    webSocketService.on('screen-share-stopped', (data) => {
      this.notifyHandlers('screen-share-stopped', data);
    });

    webSocketService.on('force-stop-screen-share', (data) => {
      this.notifyHandlers('force-stop-screen-share', data);
    });

    webSocketService.on('user-media-state', (data) => {
      this.notifyHandlers('user-media-state', data);
    });

    // Chat events
    webSocketService.on('chat-message', (data) => {
      this.notifyHandlers('chat-message', data);
    });

    webSocketService.on('private-message', (data) => {
      this.notifyHandlers('private-message', data);
    });

    webSocketService.on('private-message-sent', (data) => {
      this.notifyHandlers('private-message-sent', data);
    });

    webSocketService.on('mentioned-in-message', (data) => {
      this.notifyHandlers('mentioned-in-message', data);
    });

    // Typing events
    webSocketService.on('user-typing', (data) => {
      this.notifyHandlers('user-typing', data);
    });

    // Reactions and interactions
    webSocketService.on('hand-raised', (data) => {
      this.notifyHandlers('hand-raised', data);
    });

    webSocketService.on('hand-lowered', (data) => {
      this.notifyHandlers('hand-lowered', data);
    });

    webSocketService.on('emoji-reaction', (data) => {
      this.notifyHandlers('emoji-reaction', data);
    });

    // Connection events
    webSocketService.on('connectionStateChange', (data) => {
      this.notifyHandlers('connectionStateChange', data);
    });

    webSocketService.on('latencyUpdate', (data) => {
      this.notifyHandlers('latencyUpdate', data);
    });

    webSocketService.on('connectionQuality', (data) => {
      this.notifyHandlers('connectionQuality', data);
    });

    // Error events
    webSocketService.on('error', (data) => {
      console.error('WebRTC Signaling Error:', data);
      this.notifyHandlers('error', data);
    });
  }

  // ===========================================
  // Event Handler Registration
  // ===========================================

  on(eventType, handler) {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType).add(handler);
  }

  off(eventType, handler) {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(eventType);
      }
    }
  }

  notifyHandlers(eventType, data) {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} handler:`, error);
        }
      });
    }
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  isInRoom() {
    return this.currentRoom !== null;
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getRoomUsers() {
    return this.currentRoom ? this.currentRoom.users : [];
  }

  getConnectionState() {
    return webSocketService.getConnectionState();
  }

  getLatency() {
    return webSocketService.getLatency();
  }

  getConnectionQuality() {
    return webSocketService.getConnectionQuality();
  }
}

// Singleton instance
const webRTCSignalingService = new WebRTCSignalingService();

export default webRTCSignalingService;