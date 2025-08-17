import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from './prismaService';
import { roomManagementService } from './roomManagementService';
import { SocketUser, WebRTCMessage, ChatMessage } from '../types';
import { ChatService, initializeChatService } from './chatService';
import { ReactionsService, initializeReactionsService } from './reactionsService';
import { getAnalyticsService } from './analyticsService';
import { ChatMessageType } from '@prisma/client';
import multer from 'multer';
import path from 'path';

// Private messaging interface
interface PrivateMessage {
  fromUserId: string;
  toUserId: string;
  content: string;
  timestamp: Date;
}

// In-memory storage for real-time state (complementing database)
const activeUsers = new Map<string, SocketUser>();
const activeRooms = new Map<string, {
  id: string;
  name: string;
  users: Map<string, SocketUser>;
  isRecording: boolean;
  screenShareUserId?: string;
  createdAt: Date;
}>();
const privateMessages = new Map<string, PrivateMessage[]>();
const typingUsers = new Map<string, Set<string>>();
const raisedHands = new Map<string, Set<string>>();

export class WebRTCSignalingService {
  private io: SocketIOServer;
  private chatService: ChatService;
  private reactionsService: ReactionsService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.chatService = initializeChatService(io);
    this.reactionsService = initializeReactionsService(io);
    this.initializeHandlers();
  }

  private initializeHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 WebRTC client connected: ${socket.id}`);

      // Enhanced user joining with database integration
      socket.on('join-server', async (userData: { 
        name: string; 
        email?: string;
        userId?: string; // For authenticated users
      }) => {
        try {
          const user: SocketUser = {
            id: userData.userId || socket.id,
            socketId: socket.id,
            name: userData.name,
            email: userData.email || '',
            isScreenSharing: false,
            isAudioMuted: false,
            isVideoMuted: false,
            lastSeen: new Date(),
            permissions: {
              canChat: true,
              canShare: true,
              isModerator: false,
            },
            status: 'online',
          };

          activeUsers.set(socket.id, user);
          
          socket.emit('server-joined', {
            success: true,
            userId: user.id,
            socketId: socket.id,
            message: 'Connected to WebRTC signaling server'
          });

          console.log(`👤 User joined WebRTC server: ${userData.name} (${socket.id})`);
        } catch (error) {
          console.error('Error handling join-server:', error);
          socket.emit('error', { message: 'Failed to join server' });
        }
      });

      // Enhanced room creation with database persistence
      socket.on('create-room', async (data: { 
        roomName?: string; 
        maxUsers?: number;
        meetingId?: string;
      }) => {
        try {
          const user = activeUsers.get(socket.id);
          
          if (!user) {
            socket.emit('error', { message: 'User not found. Please join server first.' });
            return;
          }

          // Create room in database if meetingId is provided
          let dbRoom = null;
          if (data.meetingId) {
            // Link to existing meeting
            const meeting = await prisma.meeting.findUnique({
              where: { id: data.meetingId },
              include: { room: true }
            });

            if (!meeting) {
              socket.emit('error', { message: 'Meeting not found' });
              return;
            }

            if (!meeting.room) {
              // Create room for meeting
              dbRoom = await prisma.room.create({
                data: {
                  name: meeting.title,
                  maxParticipants: data.maxUsers || meeting.maxParticipants,
                  clientId: meeting.clientId,
                },
              });

              // Link room to meeting
              await prisma.meeting.update({
                where: { id: data.meetingId },
                data: { roomId: dbRoom.id }
              });
            } else {
              dbRoom = meeting.room;
            }
          }

          // Create in-memory room state
          const roomId = dbRoom?.id || this.generateRoomId();
          const room = {
            id: roomId,
            name: data.roomName || dbRoom?.name || `Room ${roomId}`,
            users: new Map<string, SocketUser>(),
            isRecording: false,
            createdAt: new Date(),
          };

          activeRooms.set(roomId, room);
          
          socket.emit('room-created', {
            roomId,
            roomName: room.name,
            meetingId: data.meetingId,
            success: true
          });

          console.log(`🏠 Room created: ${roomId} by ${user.name}`);
        } catch (error) {
          console.error('Error creating room:', error);
          socket.emit('error', { message: 'Failed to create room' });
        }
      });

      // Enhanced room joining with database tracking
      socket.on('join-room', async (data: { roomId: string; meetingId?: string }) => {
        try {
          const { roomId, meetingId } = data;
          const user = activeUsers.get(socket.id);
          const room = activeRooms.get(roomId);

          if (!user) {
            socket.emit('error', { message: 'User not found. Please join server first.' });
            return;
          }

          if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          if (room.users.size >= 50) { // Default max
            socket.emit('error', { message: 'Room is full' });
            return;
          }

          // Update user room and meeting association
          user.roomId = roomId;
          user.meetingId = meetingId;
          room.users.set(socket.id, user);
          activeUsers.set(socket.id, user);

          // Join socket room for broadcasting
          socket.join(roomId);

          // Update database if meeting is involved
          if (meetingId) {
            try {
              await prisma.meetingParticipant.upsert({
                where: {
                  userId_meetingId: {
                    userId: user.id,
                    meetingId: meetingId,
                  },
                },
                create: {
                  userId: user.id,
                  meetingId: meetingId,
                  roomId: roomId,
                  isPresent: true,
                  joinedAt: new Date(),
                },
                update: {
                  isPresent: true,
                  joinedAt: new Date(),
                  leftAt: null,
                },
              });

              // Track user joining meeting for analytics
              try {
                const analyticsService = getAnalyticsService();
                await analyticsService.trackUserJoin(meetingId, user.id);
              } catch (analyticsError) {
                console.error('Error tracking user join:', analyticsError);
              }
            } catch (dbError) {
              console.error('Error updating participant in database:', dbError);
              // Continue with WebRTC signaling even if DB update fails
            }
          }

          // Send current room state to joining user
          const roomUsers = Array.from(room.users.values()).map(u => ({
            id: u.id,
            name: u.name,
            isScreenSharing: u.isScreenSharing,
            isAudioMuted: u.isAudioMuted,
            isVideoMuted: u.isVideoMuted,
          }));

          socket.emit('room-joined', {
            roomId,
            users: roomUsers,
            isRecording: room.isRecording,
          });

          // Notify other users in room
          socket.to(roomId).emit('user-joined', {
            user: {
              id: user.id,
              name: user.name,
              isScreenSharing: user.isScreenSharing,
              isAudioMuted: user.isAudioMuted,
              isVideoMuted: user.isVideoMuted,
            }
          });

          console.log(`🚪 User ${user.name} joined room ${roomId} (${room.users.size}/50)`);
        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // WebRTC signaling handlers
      socket.on('offer', (data: { roomId: string; targetUserId: string; offer: any }) => {
        this.handleWebRTCSignaling(socket, 'offer', data);
      });

      socket.on('answer', (data: { roomId: string; targetUserId: string; answer: any }) => {
        this.handleWebRTCSignaling(socket, 'answer', data);
      });

      socket.on('ice-candidate', (data: { roomId: string; targetUserId: string; candidate: any }) => {
        this.handleWebRTCSignaling(socket, 'ice-candidate', data);
      });

      // Enhanced screen sharing with database tracking
      socket.on('start-screen-share', async (data: { roomId: string }) => {
        await this.handleScreenShareStart(socket, data.roomId);
      });

      socket.on('stop-screen-share', async (data: { roomId: string }) => {
        await this.handleScreenShareStop(socket, data.roomId);
      });

      // Media state management
      socket.on('toggle-audio', (data: { roomId: string; muted: boolean }) => {
        this.updateMediaState(socket, data.roomId, { isAudioMuted: data.muted });
      });

      socket.on('toggle-video', (data: { roomId: string; muted: boolean }) => {
        this.updateMediaState(socket, data.roomId, { isVideoMuted: data.muted });
      });

      // Enhanced chat with comprehensive features
      socket.on('chat-message', async (data: { 
        roomId: string; 
        message: string;
        meetingId?: string;
        replyToId?: string;
        mentionedUsers?: string[];
      }) => {
        await this.handleChatMessage(socket, data);
      });

      // Private messaging
      socket.on('private-message', async (data: {
        toUserId: string;
        content: string;
      }) => {
        await this.handlePrivateMessage(socket, data);
      });

      // Typing indicators
      socket.on('typing-start', (data: {
        meetingId?: string;
        roomId?: string;
      }) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing-stop', (data: {
        meetingId?: string;
        roomId?: string;
      }) => {
        this.handleTypingStop(socket, data);
      });

      // Message reactions
      socket.on('message-reaction', async (data: {
        messageId: string;
        emoji: string;
      }) => {
        await this.handleMessageReaction(socket, data);
      });

      // Message editing and deletion
      socket.on('edit-message', async (data: {
        messageId: string;
        newContent: string;
      }) => {
        await this.handleEditMessage(socket, data);
      });

      socket.on('delete-message', async (data: {
        messageId: string;
        isModeration?: boolean;
      }) => {
        await this.handleDeleteMessage(socket, data);
      });

      // Real-time interactions
      socket.on('raise-hand', (data: {
        meetingId?: string;
        roomId?: string;
      }) => {
        this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', (data: {
        meetingId?: string;
        roomId?: string;
      }) => {
        this.handleLowerHand(socket, data);
      });

      socket.on('emoji-reaction', (data: {
        emoji: string;
        meetingId?: string;
        roomId?: string;
      }) => {
        this.handleEmojiReaction(socket, data);
      });

      // Connection quality monitoring
      socket.on('connection-quality', (data: { roomId: string; quality: string; stats?: any }) => {
        this.handleConnectionQuality(socket, data);
      });

      // Disconnect and cleanup handlers
      socket.on('leave-room', () => {
        this.handleUserLeavingRoom(socket);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 WebRTC client disconnected: ${socket.id}`);
        this.handleUserLeavingRoom(socket);
        activeUsers.delete(socket.id);
      });
    });
  }

  private handleWebRTCSignaling(
    socket: Socket, 
    messageType: 'offer' | 'answer' | 'ice-candidate', 
    data: any
  ) {
    const { roomId, targetUserId } = data;
    const room = activeRooms.get(roomId);
    const user = activeUsers.get(socket.id);
    
    if (!room || !user || !room.users.has(socket.id)) {
      socket.emit('error', { message: 'Not authorized for this room' });
      return;
    }

    // Find target socket ID from user ID
    let targetSocketId: string | null = null;
    for (const [socketId, roomUser] of room.users) {
      if (roomUser.id === targetUserId) {
        targetSocketId = socketId;
        break;
      }
    }

    if (!targetSocketId) {
      socket.emit('error', { message: 'Target user not found in room' });
      return;
    }

    // Forward signaling message to target user
    const signalData = {
      fromUserId: user.id,
      fromSocketId: socket.id,
      ...data
    };

    socket.to(targetSocketId).emit(messageType, signalData);

    console.log(`📡 ${messageType} forwarded from ${user.id} to ${targetUserId} in room ${roomId}`);
  }

  private async handleScreenShareStart(socket: Socket, roomId: string) {
    const user = activeUsers.get(socket.id);
    const room = activeRooms.get(roomId);
    
    if (!user || !room || !room.users.has(socket.id)) {
      socket.emit('error', { message: 'Not in room' });
      return;
    }

    // Stop all other users' screen sharing (only one at a time)
    let stoppedUsers = 0;
    room.users.forEach((roomUser, socketId) => {
      if (socketId !== socket.id && roomUser.isScreenSharing) {
        roomUser.isScreenSharing = false;
        this.io.to(socketId).emit('force-stop-screen-share', { 
          reason: `${user.name} started screen sharing`,
          newScreenShareUserId: user.id,
          newScreenShareUserName: user.name
        });
        console.log(`🛑 Forced stop screen share for ${roomUser.name} (${roomUser.id})`);
        stoppedUsers++;
      }
    });

    if (stoppedUsers > 0) {
      console.log(`🔄 Stopped ${stoppedUsers} other screen share(s) to start ${user.name}'s screen share`);
    }

    // Start screen sharing for current user
    user.isScreenSharing = true;
    room.users.set(socket.id, user);
    room.screenShareUserId = user.id;
    activeUsers.set(socket.id, user);

    // Update database room state
    try {
      await prisma.room.updateMany({
        where: { id: roomId },
        data: { screenShareUserId: user.id },
      });

      // Track screen share start for analytics
      const analyticsService = getAnalyticsService();
      if (user.meetingId) {
        await analyticsService.trackScreenShare(user.meetingId, user.id, 'start');
      }
    } catch (error) {
      console.error('Error updating screen share in database:', error);
    }

    // Notify all users in room about the new screen share
    socket.to(roomId).emit('screen-share-started', {
      userId: user.id,
      userName: user.name,
      roomId: roomId,
      timestamp: new Date().toISOString()
    });

    // Confirm to the user who started screen sharing
    socket.emit('screen-share-started', { 
      success: true, 
      userId: user.id,
      userName: user.name,
      roomId: roomId
    });

    console.log(`🖥️  Screen share started by ${user.name} in room ${roomId}`);
  }

  private async handleScreenShareStop(socket: Socket, roomId: string) {
    const user = activeUsers.get(socket.id);
    const room = activeRooms.get(roomId);
    
    if (!user || !room || !room.users.has(socket.id)) {
      return;
    }

    user.isScreenSharing = false;
    room.users.set(socket.id, user);
    room.screenShareUserId = undefined;
    activeUsers.set(socket.id, user);

    // Update database room state
    try {
      await prisma.room.updateMany({
        where: { id: roomId },
        data: { screenShareUserId: null },
      });

      // Track screen share stop for analytics
      const analyticsService = getAnalyticsService();
      if (user.meetingId) {
        await analyticsService.trackScreenShare(user.meetingId, user.id, 'stop');
      }
    } catch (error) {
      console.error('Error updating screen share in database:', error);
    }

    // Notify all users in room about screen share stopping
    socket.to(roomId).emit('screen-share-stopped', {
      userId: user.id,
      userName: user.name,
      roomId: roomId,
      timestamp: new Date().toISOString()
    });

    // Confirm to the user who stopped screen sharing
    socket.emit('screen-share-stopped', { 
      success: true,
      userId: user.id,
      userName: user.name,
      roomId: roomId
    });

    console.log(`🖥️  Screen share stopped by ${user.name} in room ${roomId}`);
  }

  private updateMediaState(socket: Socket, roomId: string, mediaState: Partial<SocketUser>) {
    const user = activeUsers.get(socket.id);
    const room = activeRooms.get(roomId);
    
    if (!user || !room || !room.users.has(socket.id)) {
      return;
    }

    // Update user state
    Object.assign(user, mediaState);
    room.users.set(socket.id, user);
    activeUsers.set(socket.id, user);

    // Broadcast media state change to room
    socket.to(roomId).emit('user-media-state', {
      userId: user.id,
      ...mediaState
    });

    console.log(`🎚️  Media state updated for ${user.name}: ${JSON.stringify(mediaState)}`);
  }

  private async handleChatMessage(socket: Socket, data: { 
    roomId: string; 
    message: string;
    meetingId?: string;
    replyToId?: string;
    mentionedUsers?: string[];
  }) {
    try {
      const { roomId, message, meetingId, replyToId, mentionedUsers } = data;
      const user = activeUsers.get(socket.id);
      const room = activeRooms.get(roomId);
      
      if (!user || !room || !room.users.has(socket.id)) {
        socket.emit('error', { message: 'Not in room' });
        return;
      }

      // Check permissions
      if (!user.permissions.canChat) {
        socket.emit('error', { message: 'Chat permission denied' });
        return;
      }

      // Use enhanced chat service if meetingId is provided
      if (meetingId) {
        // Process mentions
        if (mentionedUsers && mentionedUsers.length > 0) {
          for (const mentionedUserId of mentionedUsers) {
            const mentionedUserSocket = this.findUserSocket(mentionedUserId);
            if (mentionedUserSocket) {
              this.io.to(mentionedUserSocket).emit('mentioned-in-message', {
                messageContent: message,
                fromUser: user.name,
                meetingId,
                roomId,
              });
            }
          }
        }

        await this.chatService.sendMessage({
          content: message,
          userId: user.id,
          meetingId,
          roomId,
          replyToId,
        });

        // Track message for analytics
        try {
          const analyticsService = getAnalyticsService();
          await analyticsService.trackMessage(meetingId, user.id);
        } catch (analyticsError) {
          console.error('Error tracking message:', analyticsError);
        }
      } else {
        // Fallback to basic chat for rooms without meetings
        const chatMessage: ChatMessage = {
          id: this.generateMessageId(),
          roomId,
          userId: user.id,
          userName: user.name,
          message,
          timestamp: new Date(),
          type: 'text'
        };

        this.io.to(roomId).emit('chat-message', chatMessage);
      }

      // Clear typing indicator
      this.handleTypingStop(socket, { roomId, meetingId });

      console.log(`💬 Chat message in ${roomId} by ${user.name}: ${message}`);
    } catch (error) {
      console.error('Error handling chat message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handlePrivateMessage(socket: Socket, data: {
    toUserId: string;
    content: string;
  }) {
    try {
      const fromUser = activeUsers.get(socket.id);
      if (!fromUser) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      const toUserSocket = this.findUserSocket(data.toUserId);
      if (!toUserSocket) {
        socket.emit('error', { message: 'Recipient not online' });
        return;
      }

      const privateMessage: PrivateMessage = {
        fromUserId: fromUser.id,
        toUserId: data.toUserId,
        content: data.content,
        timestamp: new Date(),
      };

      // Store conversation history
      const conversationKey = [fromUser.id, data.toUserId].sort().join('-');
      if (!privateMessages.has(conversationKey)) {
        privateMessages.set(conversationKey, []);
      }
      privateMessages.get(conversationKey)!.push(privateMessage);

      // Send to recipient
      this.io.to(toUserSocket).emit('private-message', {
        from: {
          id: fromUser.id,
          name: fromUser.name,
        },
        content: data.content,
        timestamp: privateMessage.timestamp,
      });

      // Confirm to sender
      socket.emit('private-message-sent', {
        toUserId: data.toUserId,
        content: data.content,
        timestamp: privateMessage.timestamp,
      });

      console.log(`📧 Private message from ${fromUser.name} to ${data.toUserId}`);
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  }

  private handleTypingStart(socket: Socket, data: {
    meetingId?: string;
    roomId?: string;
  }) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const roomKey = data.roomId || (data.meetingId ? `meeting-${data.meetingId}` : '');
    if (!roomKey) return;
    
    if (!typingUsers.has(roomKey)) {
      typingUsers.set(roomKey, new Set());
    }
    
    typingUsers.get(roomKey)!.add(user.id);

    // Broadcast typing indicator
    socket.to(roomKey).emit('user-typing', {
      userId: user.id,
      userName: user.name,
      isTyping: true,
    });

    // Auto-clear typing after 3 seconds
    setTimeout(() => {
      this.handleTypingStop(socket, data);
    }, 3000);
  }

  private handleTypingStop(socket: Socket, data: {
    meetingId?: string;
    roomId?: string;
  }) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const roomKey = data.roomId || (data.meetingId ? `meeting-${data.meetingId}` : '');
    if (!roomKey) return;
    
    if (typingUsers.has(roomKey)) {
      typingUsers.get(roomKey)!.delete(user.id);
      
      // Broadcast typing stop
      socket.to(roomKey).emit('user-typing', {
        userId: user.id,
        userName: user.name,
        isTyping: false,
      });
    }
  }

  private async handleMessageReaction(socket: Socket, data: {
    messageId: string;
    emoji: string;
  }) {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      await this.chatService.toggleReaction(data.messageId, user.id, data.emoji);
    } catch (error) {
      console.error('Error handling reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  private async handleEditMessage(socket: Socket, data: {
    messageId: string;
    newContent: string;
  }) {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      await this.chatService.editMessage(data.messageId, user.id, data.newContent);
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  }

  private async handleDeleteMessage(socket: Socket, data: {
    messageId: string;
    isModeration?: boolean;
  }) {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      if (data.isModeration && !user.permissions.isModerator) {
        socket.emit('error', { message: 'Moderation permission required' });
        return;
      }

      await this.chatService.deleteMessage(data.messageId, user.id, data.isModeration);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  }

  private handleRaiseHand(socket: Socket, data: {
    meetingId?: string;
    roomId?: string;
  }) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const roomKey = data.roomId || (data.meetingId ? `meeting-${data.meetingId}` : '');
    if (!roomKey) return;

    // Track raised hands
    if (!raisedHands.has(roomKey)) {
      raisedHands.set(roomKey, new Set());
    }
    raisedHands.get(roomKey)!.add(user.id);
    
    user.handRaised = true;
    activeUsers.set(socket.id, user);

    // Broadcast hand raised
    socket.to(roomKey).emit('hand-raised', {
      userId: user.id,
      userName: user.name,
      timestamp: new Date(),
    });

    console.log(`✋ Hand raised by ${user.name}`);
  }

  private handleLowerHand(socket: Socket, data: {
    meetingId?: string;
    roomId?: string;
  }) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const roomKey = data.roomId || (data.meetingId ? `meeting-${data.meetingId}` : '');
    if (!roomKey) return;

    // Remove from raised hands
    if (raisedHands.has(roomKey)) {
      raisedHands.get(roomKey)!.delete(user.id);
    }
    
    user.handRaised = false;
    activeUsers.set(socket.id, user);

    // Broadcast hand lowered
    socket.to(roomKey).emit('hand-lowered', {
      userId: user.id,
      userName: user.name,
      timestamp: new Date(),
    });

    console.log(`✋ Hand lowered by ${user.name}`);
  }

  private handleEmojiReaction(socket: Socket, data: {
    emoji: string;
    meetingId?: string;
    roomId?: string;
  }) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const roomKey = data.roomId || (data.meetingId ? `meeting-${data.meetingId}` : '');
    if (!roomKey) return;

    // Broadcast emoji reaction (temporary, disappears after a few seconds)
    socket.to(roomKey).emit('emoji-reaction', {
      userId: user.id,
      userName: user.name,
      emoji: data.emoji,
      timestamp: new Date(),
    });

    console.log(`🎭 Emoji reaction ${data.emoji} by ${user.name}`);
  }

  private async handleConnectionQuality(socket: Socket, data: { roomId: string; quality: string; stats?: any }) {
    const user = activeUsers.get(socket.id);
    const room = activeRooms.get(data.roomId);
    
    if (!user || !room || !room.users.has(socket.id)) {
      return;
    }

    // Log connection quality for monitoring
    console.log(`📊 Connection quality for ${user.name}: ${data.quality}`);

    // Track connection quality for analytics
    try {
      const analyticsService = getAnalyticsService();
      if (user.meetingId) {
        await analyticsService.trackConnectionQuality(user.meetingId, user.id, data.quality, data.stats);
      }
    } catch (error) {
      console.error('Error tracking connection quality:', error);
    }
  }

  private async handleUserLeavingRoom(socket: Socket) {
    const user = activeUsers.get(socket.id);
    if (!user || !user.roomId) return;

    const room = activeRooms.get(user.roomId);
    if (!room) return;

    try {
      // Update database participant state
      await prisma.meetingParticipant.updateMany({
        where: {
          userId: user.id,
          isPresent: true,
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      // Track user leaving for analytics
      try {
        const analyticsService = getAnalyticsService();
        if (user.meetingId) {
          await analyticsService.trackUserLeave(user.meetingId, user.id);
        }
      } catch (analyticsError) {
        console.error('Error tracking user leave:', analyticsError);
      }

      // Remove user from room
      room.users.delete(socket.id);
      
      // Clear screen sharing if this user was sharing
      if (room.screenShareUserId === user.id) {
        room.screenShareUserId = undefined;
        await prisma.room.updateMany({
          where: { id: user.roomId },
          data: { screenShareUserId: null },
        });
      }

      // Notify other users
      socket.to(user.roomId).emit('user-left', {
        userId: user.id,
        userName: user.name
      });

      // Leave socket room
      socket.leave(user.roomId);

      // Clean up empty rooms
      if (room.users.size === 0) {
        activeRooms.delete(user.roomId);
        console.log(`🗑️  Empty room deleted: ${user.roomId}`);
      }

      console.log(`🚪 User ${user.name} left room ${user.roomId}`);
    } catch (error) {
      console.error('Error handling user leaving room:', error);
    }

    // Clear user room association
    user.roomId = undefined;
    activeUsers.set(socket.id, user);
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private generateMessageId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }

  // Helper methods
  private findUserSocket(userId: string): string | null {
    for (const [socketId, user] of activeUsers.entries()) {
      if (user.id === userId) {
        return socketId;
      }
    }
    return null;
  }

  // Public methods for external access
  public getRoomState(roomId: string) {
    return activeRooms.get(roomId);
  }

  public getUserState(socketId: string) {
    return activeUsers.get(socketId);
  }

  public getActiveRoomsCount(): number {
    return activeRooms.size;
  }

  public getActiveUsersCount(): number {
    return activeUsers.size;
  }

  public getActiveUsersInMeeting(meetingId: string): SocketUser[] {
    return Array.from(activeUsers.values())
      .filter(user => user.meetingId === meetingId);
  }

  public getUsersInRoom(roomId: string): SocketUser[] {
    return Array.from(activeUsers.values())
      .filter(user => user.roomId === roomId);
  }

  public getRaisedHands(roomId: string): string[] {
    const hands = raisedHands.get(roomId);
    return hands ? Array.from(hands) : [];
  }

  public getTypingUsers(roomId: string): string[] {
    const typing = typingUsers.get(roomId);
    return typing ? Array.from(typing) : [];
  }

  public getChatService(): ChatService {
    return this.chatService;
  }
}

export default WebRTCSignalingService;