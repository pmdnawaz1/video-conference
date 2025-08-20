import { Server as SocketIOServer, Socket } from "socket.io";
import { SocketUser, Room, WebRTCMessage, ChatMessage } from "../types";

// In-memory storage for rooms and users (will be moved to database later)
const rooms = new Map<string, Room>();
const users = new Map<string, SocketUser>();

export function initializeSocketIO(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Handle user joining
    socket.on("join-server", (userData: { name: string; email?: string }) => {
      const user: SocketUser = {
        id: socket.id,
        socketId: socket.id,
        name: userData.name,
        email: userData.email || "",
        isScreenSharing: false,
        isAudioMuted: false,
        isVideoMuted: false,
        lastSeen: new Date(),
        permissions: {
          canChat: true,
          canShare: true,
          isModerator: false,
        },
        status: "online",
      };

      users.set(socket.id, user);

      socket.emit("server-joined", {
        success: true,
        userId: socket.id,
        message: "Connected to signaling server",
      });

      console.log(`👤 User joined server: ${userData.name} (${socket.id})`);
    });

    // Handle room creation
    socket.on(
      "create-room",
      (data: { roomName?: string; maxUsers?: number }) => {
        const roomId = generateRoomId();
        const user = users.get(socket.id);

        if (!user) {
          socket.emit("error", {
            message: "User not found. Please join server first.",
          });
          return;
        }

        const room: Room = {
          id: roomId,
          name: data.roomName || `Room ${roomId}`,
          createdBy: socket.id,
          users: new Map(),
          maxUsers: data.maxUsers || 50,
          isRecording: false,
          createdAt: new Date(),
        };

        rooms.set(roomId, room);

        socket.emit("room-created", {
          roomId,
          roomName: room.name,
          success: true,
        });

        console.log(`🏠 Room created: ${roomId} by ${user.name}`);
      },
    );

    // Handle joining a room
    socket.on("join-room", (data: { roomId: string }) => {
      const { roomId } = data;
      const user = users.get(socket.id);
      const room = rooms.get(roomId);

      if (!user) {
        socket.emit("error", {
          message: "User not found. Please join server first.",
        });
        return;
      }

      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.users.size >= (room.maxUsers || 50)) {
        socket.emit("error", { message: "Room is full" });
        return;
      }

      // Add user to room
      user.roomId = roomId;
      room.users.set(socket.id, user);
      users.set(socket.id, user);

      // Join socket room
      socket.join(roomId);

      // Notify user of successful join
      socket.emit("room-joined", {
        roomId,
        users: Array.from(room.users.values()).map((u) => ({
          id: u.id,
          name: u.name,
          isScreenSharing: u.isScreenSharing,
          isAudioMuted: u.isAudioMuted,
          isVideoMuted: u.isVideoMuted,
        })),
      });

      // Notify other users in room
      socket.to(roomId).emit("user-joined", {
        user: {
          id: user.id,
          name: user.name,
          isScreenSharing: user.isScreenSharing,
          isAudioMuted: user.isAudioMuted,
          isVideoMuted: user.isVideoMuted,
        },
      });

      console.log(
        `🚪 User ${user.name} joined room ${roomId} (${room.users.size}/${room.maxUsers})`,
      );
    });

    // Handle WebRTC offer
    socket.on(
      "offer",
      (data: { roomId: string; targetUserId: string; offer: any }) => {
        const { roomId, targetUserId, offer } = data;
        const room = rooms.get(roomId);

        if (!room || !room.users.has(socket.id)) {
          socket.emit("error", { message: "Not in room" });
          return;
        }

        socket.to(targetUserId).emit("offer", {
          fromUserId: socket.id,
          offer,
        });

        console.log(
          `📞 Offer sent from ${socket.id} to ${targetUserId} in room ${roomId}`,
        );
      },
    );

    // Handle WebRTC answer
    socket.on(
      "answer",
      (data: { roomId: string; targetUserId: string; answer: any }) => {
        const { roomId, targetUserId, answer } = data;
        const room = rooms.get(roomId);

        if (!room || !room.users.has(socket.id)) {
          socket.emit("error", { message: "Not in room" });
          return;
        }

        socket.to(targetUserId).emit("answer", {
          fromUserId: socket.id,
          answer,
        });

        console.log(
          `📞 Answer sent from ${socket.id} to ${targetUserId} in room ${roomId}`,
        );
      },
    );

    // Handle ICE candidates
    socket.on(
      "ice-candidate",
      (data: { roomId: string; targetUserId: string; candidate: any }) => {
        const { roomId, targetUserId, candidate } = data;
        const room = rooms.get(roomId);

        if (!room || !room.users.has(socket.id)) {
          socket.emit("error", { message: "Not in room" });
          return;
        }

        socket.to(targetUserId).emit("ice-candidate", {
          fromUserId: socket.id,
          candidate,
        });
      },
    );

    // Handle screen sharing
    socket.on("start-screen-share", (data: { roomId: string }) => {
      const { roomId } = data;
      const user = users.get(socket.id);
      const room = rooms.get(roomId);

      if (!user || !room || !room.users.has(socket.id)) {
        socket.emit("error", { message: "Not in room" });
        return;
      }

      // Stop all other users' screen sharing
      room.users.forEach((roomUser, userId) => {
        if (userId !== socket.id && roomUser.isScreenSharing) {
          roomUser.isScreenSharing = false;
          users.set(userId, roomUser);
          socket.to(userId).emit("stop-screen-share", { force: true });
        }
      });

      // Start screen sharing for current user
      user.isScreenSharing = true;
      room.users.set(socket.id, user);
      users.set(socket.id, user);

      // Notify all users in room
      socket.to(roomId).emit("screen-share-started", {
        userId: socket.id,
        userName: user.name,
      });

      socket.emit("screen-share-started", { success: true });

      console.log(`🖥️  Screen share started by ${user.name} in room ${roomId}`);
    });

    socket.on("stop-screen-share", (data: { roomId: string }) => {
      const { roomId } = data;
      const user = users.get(socket.id);
      const room = rooms.get(roomId);

      if (!user || !room || !room.users.has(socket.id)) {
        return;
      }

      user.isScreenSharing = false;
      room.users.set(socket.id, user);
      users.set(socket.id, user);

      socket.to(roomId).emit("screen-share-stopped", {
        userId: socket.id,
        userName: user.name,
      });

      socket.emit("screen-share-stopped", { success: true });

      console.log(`🖥️  Screen share stopped by ${user.name} in room ${roomId}`);
    });

    // Handle audio/video mute toggles
    socket.on("toggle-audio", (data: { roomId: string; muted: boolean }) => {
      updateMediaState(socket, data.roomId, { isAudioMuted: data.muted });
    });

    socket.on("toggle-video", (data: { roomId: string; muted: boolean }) => {
      updateMediaState(socket, data.roomId, { isVideoMuted: data.muted });
    });

    // Handle chat messages
    socket.on("chat-message", (data: { roomId: string; message: string }) => {
      const { roomId, message } = data;
      const user = users.get(socket.id);
      const room = rooms.get(roomId);

      if (!user || !room || !room.users.has(socket.id)) {
        socket.emit("error", { message: "Not in room" });
        return;
      }

      const chatMessage: ChatMessage = {
        id: generateMessageId(),
        roomId,
        userId: socket.id,
        userName: user.name,
        message,
        timestamp: new Date(),
        type: "text",
      };

      // Broadcast to all users in room including sender
      io.to(roomId).emit("chat-message", chatMessage);

      console.log(`💬 Chat message in ${roomId} by ${user.name}: ${message}`);
    });

    // Handle leaving room
    socket.on("leave-room", () => {
      handleUserLeavingRoom(socket);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
      handleUserLeavingRoom(socket);
      users.delete(socket.id);
    });
  });

  // Helper functions
  function updateMediaState(
    socket: Socket,
    roomId: string,
    mediaState: Partial<SocketUser>,
  ) {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room || !room.users.has(socket.id)) {
      return;
    }

    Object.assign(user, mediaState);
    room.users.set(socket.id, user);
    users.set(socket.id, user);

    socket.to(roomId).emit("user-media-state", {
      userId: socket.id,
      ...mediaState,
    });
  }

  function handleUserLeavingRoom(socket: Socket) {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    // Remove user from room
    room.users.delete(socket.id);

    // Notify other users
    socket.to(user.roomId).emit("user-left", {
      userId: socket.id,
      userName: user.name,
    });

    // Leave socket room
    socket.leave(user.roomId);

    // Clean up empty rooms
    if (room.users.size === 0) {
      rooms.delete(user.roomId);
      console.log(`🗑️  Empty room deleted: ${user.roomId}`);
    }

    // Update user state
    user.roomId = undefined;
    users.set(socket.id, user);

    console.log(`🚪 User ${user.name} left room ${user.roomId}`);
  }

  function generateRoomId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  function generateMessageId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }
}
