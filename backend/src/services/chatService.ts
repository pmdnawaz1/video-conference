import { prisma } from './prismaService';
import { ChatMessageType } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs/promises';

export interface ChatMessageData {
  content: string;
  messageType?: ChatMessageType;
  userId: string;
  meetingId: string;
  roomId?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  replyToId?: string;
}

export interface FileUploadData {
  originalName: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface ChatMessageWithRelations {
  id: string;
  content: string;
  messageType: ChatMessageType;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  reactions?: any;
  isEdited: boolean;
  editedAt?: Date | null;
  userId: string;
  meetingId: string;
  roomId?: string | null;
  replyToId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    displayName?: string | null;
    avatar?: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    messageType: ChatMessageType;
    user: {
      firstName: string;
      lastName: string;
      displayName?: string | null;
    };
  } | null;
  replies: Array<{
    id: string;
    content: string;
    user: {
      firstName: string;
      lastName: string;
      displayName?: string | null;
    };
  }>;
}

export interface ChatPaginationOptions {
  page?: number;
  limit?: number;
  before?: string; // Message ID to get messages before
  after?: string;  // Message ID to get messages after
}

/**
 * Enhanced Chat Service with comprehensive messaging features
 * Supports text messages, file sharing, reactions, replies, and moderation
 */
export class ChatService {
  private io: SocketIOServer;
  private uploadsPath: string;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.uploadsPath = path.join(process.cwd(), 'uploads', 'chat');
    this.initializeUploadDirectory();
  }

  private async initializeUploadDirectory() {
    try {
      await fs.mkdir(this.uploadsPath, { recursive: true });
      console.log('📁 Chat uploads directory initialized');
    } catch (error) {
      console.error('📁 Error creating chat uploads directory:', error);
    }
  }

  /**
   * Send a chat message with full feature support
   */
  async sendMessage(messageData: ChatMessageData): Promise<ChatMessageWithRelations> {
    try {
      // Validate user exists and has permission
      const user = await prisma.user.findUnique({
        where: { id: messageData.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          clientId: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Validate meeting exists and user has access
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: messageData.meetingId,
          clientId: user.clientId,
        },
      });

      if (!meeting) {
        throw new Error('Meeting not found or access denied');
      }

      // Check if user is participant
      const participant = await prisma.meetingParticipant.findFirst({
        where: {
          userId: messageData.userId,
          meetingId: messageData.meetingId,
        },
      });

      if (!participant) {
        throw new Error('User is not a participant in this meeting');
      }

      // Check if user can send messages
      if (!participant.canChat) {
        throw new Error('User does not have chat permissions');
      }

      // Validate reply-to message if specified
      if (messageData.replyToId) {
        const replyToMessage = await prisma.chatMessage.findFirst({
          where: {
            id: messageData.replyToId,
            meetingId: messageData.meetingId,
          },
        });

        if (!replyToMessage) {
          throw new Error('Reply-to message not found');
        }
      }

      // Create message in database
      const chatMessage = await prisma.chatMessage.create({
        data: {
          content: messageData.content,
          messageType: messageData.messageType || ChatMessageType.TEXT,
          userId: messageData.userId,
          meetingId: messageData.meetingId,
          roomId: messageData.roomId,
          fileName: messageData.fileName,
          fileUrl: messageData.fileUrl,
          fileSize: messageData.fileSize,
          replyToId: messageData.replyToId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              messageType: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          replies: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
            take: 3, // Limit nested replies for performance
          },
        },
      });

      // Emit real-time message to room
      const messagePayload = {
        id: chatMessage.id,
        content: chatMessage.content,
        messageType: chatMessage.messageType,
        fileName: chatMessage.fileName,
        fileUrl: chatMessage.fileUrl,
        fileSize: chatMessage.fileSize,
        reactions: chatMessage.reactions,
        isEdited: chatMessage.isEdited,
        editedAt: chatMessage.editedAt,
        userId: chatMessage.userId,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userAvatar: user.avatar,
        meetingId: chatMessage.meetingId,
        roomId: chatMessage.roomId,
        replyTo: chatMessage.replyTo,
        replies: chatMessage.replies,
        timestamp: chatMessage.createdAt,
        createdAt: chatMessage.createdAt,
      };

      // Broadcast to room if roomId is specified
      if (messageData.roomId) {
        this.io.to(messageData.roomId).emit('chat-message', messagePayload);
      }

      // Broadcast to meeting participants
      this.io.to(`meeting-${messageData.meetingId}`).emit('chat-message', messagePayload);

      console.log(`💬 Message sent by ${user.firstName} in meeting ${messageData.meetingId}`);

      return chatMessage as ChatMessageWithRelations;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * Handle file upload for chat
   */
  async uploadFile(fileData: FileUploadData, userId: string, meetingId: string): Promise<string> {
    try {
      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (fileData.size > maxSize) {
        throw new Error('File size exceeds maximum limit of 50MB');
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-zip-compressed',
      ];

      if (!allowedTypes.includes(fileData.mimetype)) {
        throw new Error('File type not allowed');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(fileData.originalName);
      const fileName = `${timestamp}_${randomString}${extension}`;
      const filePath = path.join(this.uploadsPath, fileName);

      // Save file to disk
      await fs.writeFile(filePath, fileData.buffer);

      // Generate file URL (adjust based on your serving setup)
      const fileUrl = `/api/chat/files/${fileName}`;

      console.log(`📎 File uploaded: ${fileName} (${fileData.size} bytes)`);

      return fileUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Send file message
   */
  async sendFileMessage(
    fileData: FileUploadData,
    userId: string,
    meetingId: string,
    roomId?: string,
    replyToId?: string
  ): Promise<ChatMessageWithRelations> {
    try {
      const fileUrl = await this.uploadFile(fileData, userId, meetingId);

      const messageData: ChatMessageData = {
        content: `Shared file: ${fileData.originalName}`,
        messageType: ChatMessageType.FILE,
        userId,
        meetingId,
        roomId,
        fileName: fileData.originalName,
        fileUrl,
        fileSize: fileData.size,
        replyToId,
      };

      return await this.sendMessage(messageData);
    } catch (error) {
      console.error('Error sending file message:', error);
      throw error;
    }
  }

  /**
   * Add or remove emoji reaction
   */
  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<ChatMessageWithRelations> {
    try {
      // Get current message
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Validate user has access to the meeting
      const participant = await prisma.meetingParticipant.findFirst({
        where: {
          userId,
          meetingId: message.meetingId,
        },
      });

      if (!participant) {
        throw new Error('User is not a participant in this meeting');
      }

      // Parse existing reactions
      let reactions = message.reactions as any || {};

      // Initialize emoji if not exists
      if (!reactions[emoji]) {
        reactions[emoji] = {
          count: 0,
          users: [],
        };
      }

      // Check if user already reacted with this emoji
      const userIndex = reactions[emoji].users.findIndex((u: any) => u.userId === userId);

      if (userIndex >= 0) {
        // Remove reaction
        reactions[emoji].users.splice(userIndex, 1);
        reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);

        // Remove emoji if no users
        if (reactions[emoji].count === 0) {
          delete reactions[emoji];
        }
      } else {
        // Add reaction
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, displayName: true },
        });

        if (user) {
          reactions[emoji].users.push({
            userId,
            userName: user.displayName || `${user.firstName} ${user.lastName}`,
          });
          reactions[emoji].count += 1;
        }
      }

      // Update message with new reactions
      const updatedMessage = await prisma.chatMessage.update({
        where: { id: messageId },
        data: { reactions },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              messageType: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          replies: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
            take: 3,
          },
        },
      });

      // Emit reaction update to room and meeting
      const reactionPayload = {
        messageId,
        reactions: updatedMessage.reactions,
        emoji,
        userId,
        action: userIndex >= 0 ? 'remove' : 'add',
      };

      if (message.roomId) {
        this.io.to(message.roomId).emit('message-reaction', reactionPayload);
      }
      this.io.to(`meeting-${message.meetingId}`).emit('message-reaction', reactionPayload);

      console.log(`🎭 Reaction ${emoji} ${userIndex >= 0 ? 'removed' : 'added'} by user ${userId}`);

      return updatedMessage as ChatMessageWithRelations;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, userId: string, newContent: string): Promise<ChatMessageWithRelations> {
    try {
      // Get message and verify ownership
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: messageId,
          userId,
        },
      });

      if (!message) {
        throw new Error('Message not found or not owned by user');
      }

      // Prevent editing file messages
      if (message.messageType === ChatMessageType.FILE) {
        throw new Error('File messages cannot be edited');
      }

      // Update message
      const updatedMessage = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          content: newContent,
          isEdited: true,
          editedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              messageType: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          replies: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
            take: 3,
          },
        },
      });

      // Emit edit update
      const editPayload = {
        messageId,
        content: newContent,
        isEdited: true,
        editedAt: updatedMessage.editedAt,
      };

      if (message.roomId) {
        this.io.to(message.roomId).emit('message-edited', editPayload);
      }
      this.io.to(`meeting-${message.meetingId}`).emit('message-edited', editPayload);

      console.log(`✏️ Message ${messageId} edited by user ${userId}`);

      return updatedMessage as ChatMessageWithRelations;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  /**
   * Delete a message (soft delete by clearing content)
   */
  async deleteMessage(messageId: string, userId: string, isModeration = false): Promise<void> {
    try {
      // Get message and verify permissions
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: {
          meeting: {
            select: {
              id: true,
              createdBy: true,
            },
          },
        },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Check permissions (owner or meeting creator or moderator)
      let hasPermission = message.userId === userId || message.meeting.createdBy === userId;

      if (!hasPermission && isModeration) {
        // Check if user is moderator
        const participant = await prisma.meetingParticipant.findFirst({
          where: {
            userId,
            meetingId: message.meetingId,
            isModerator: true,
          },
        });
        hasPermission = !!participant;
      }

      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Soft delete by updating content
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          content: '[Message deleted]',
          fileName: null,
          fileUrl: null,
          fileSize: null,
          reactions: {},
        },
      });

      // Delete physical file if it was a file message
      if (message.fileUrl && message.messageType === ChatMessageType.FILE) {
        try {
          const fileName = path.basename(message.fileUrl);
          const filePath = path.join(this.uploadsPath, fileName);
          await fs.unlink(filePath);
        } catch (fileError) {
          console.warn('Could not delete file:', fileError);
        }
      }

      // Emit deletion update
      const deletePayload = {
        messageId,
        content: '[Message deleted]',
        isDeleted: true,
      };

      if (message.roomId) {
        this.io.to(message.roomId).emit('message-deleted', deletePayload);
      }
      this.io.to(`meeting-${message.meetingId}`).emit('message-deleted', deletePayload);

      console.log(`🗑️ Message ${messageId} deleted by user ${userId} ${isModeration ? '(moderation)' : ''}`);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Get chat history with pagination
   */
  async getChatHistory(
    meetingId: string,
    userId: string,
    options: ChatPaginationOptions = {}
  ): Promise<{
    messages: ChatMessageWithRelations[];
    pagination: {
      hasMore: boolean;
      nextCursor?: string;
      prevCursor?: string;
    };
  }> {
    try {
      // Verify user has access to meeting
      const participant = await prisma.meetingParticipant.findFirst({
        where: {
          userId,
          meetingId,
        },
      });

      if (!participant) {
        throw new Error('User is not a participant in this meeting');
      }

      const { page = 1, limit = 50, before, after } = options;
      const take = Math.min(limit, 100); // Max 100 messages per request

      let whereClause: any = {
        meetingId,
      };

      // Cursor-based pagination
      if (before) {
        whereClause.id = { lt: before };
      } else if (after) {
        whereClause.id = { gt: after };
      }

      const messages = await prisma.chatMessage.findMany({
        where: whereClause,
        take: take + 1, // Take one extra to check if there are more
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              messageType: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          replies: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
            take: 3,
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const hasMore = messages.length > take;
      if (hasMore) {
        messages.pop(); // Remove the extra message
      }

      const result = messages.reverse(); // Reverse to get chronological order

      return {
        messages: result as ChatMessageWithRelations[],
        pagination: {
          hasMore,
          nextCursor: hasMore && result.length > 0 ? result[result.length - 1].id : undefined,
          prevCursor: result.length > 0 ? result[0].id : undefined,
        },
      };
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  /**
   * Send system message (e.g., user joined, left, etc.)
   */
  async sendSystemMessage(
    meetingId: string,
    roomId: string | undefined,
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Get system user or create a system message without user
      const systemMessage = await prisma.chatMessage.create({
        data: {
          content,
          messageType: ChatMessageType.SYSTEM,
          userId: 'system', // This might need adjustment based on your system design
          meetingId,
          roomId,
        },
      });

      // Emit system message
      const messagePayload = {
        id: systemMessage.id,
        content: systemMessage.content,
        messageType: ChatMessageType.SYSTEM,
        userId: 'system',
        userName: 'System',
        meetingId,
        roomId,
        timestamp: systemMessage.createdAt,
        metadata,
      };

      if (roomId) {
        this.io.to(roomId).emit('system-message', messagePayload);
      }
      this.io.to(`meeting-${meetingId}`).emit('system-message', messagePayload);

      console.log(`🤖 System message sent to meeting ${meetingId}: ${content}`);
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  }

  /**
   * Get file by filename (for serving uploaded files)
   */
  async getFile(fileName: string): Promise<{ filePath: string; exists: boolean }> {
    const filePath = path.join(this.uploadsPath, fileName);
    
    try {
      await fs.access(filePath);
      return { filePath, exists: true };
    } catch {
      return { filePath, exists: false };
    }
  }

  /**
   * Clean up old files and messages (cleanup utility)
   */
  async cleanup(olderThanDays = 30): Promise<{ deletedFiles: number; cleanedMessages: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Get old file messages
      const oldFileMessages = await prisma.chatMessage.findMany({
        where: {
          messageType: ChatMessageType.FILE,
          createdAt: { lt: cutoffDate },
          fileUrl: { not: null },
        },
        select: { fileUrl: true },
      });

      let deletedFiles = 0;

      // Delete physical files
      for (const message of oldFileMessages) {
        if (message.fileUrl) {
          try {
            const fileName = path.basename(message.fileUrl);
            const filePath = path.join(this.uploadsPath, fileName);
            await fs.unlink(filePath);
            deletedFiles++;
          } catch (fileError) {
            console.warn(`Could not delete file ${message.fileUrl}:`, fileError);
          }
        }
      }

      // Clean up file references in database
      const cleanedMessages = await prisma.chatMessage.updateMany({
        where: {
          messageType: ChatMessageType.FILE,
          createdAt: { lt: cutoffDate },
        },
        data: {
          fileUrl: null,
          fileName: null,
          fileSize: null,
        },
      });

      console.log(`🧹 Cleanup completed: ${deletedFiles} files deleted, ${cleanedMessages.count} messages cleaned`);

      return {
        deletedFiles,
        cleanedMessages: cleanedMessages.count,
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance (will be initialized in webrtcSignalingService)
let chatServiceInstance: ChatService | null = null;

export const initializeChatService = (io: SocketIOServer) => {
  chatServiceInstance = new ChatService(io);
  return chatServiceInstance;
};

export const getChatService = (): ChatService => {
  if (!chatServiceInstance) {
    throw new Error('Chat service not initialized. Call initializeChatService first.');
  }
  return chatServiceInstance;
};

export default ChatService;