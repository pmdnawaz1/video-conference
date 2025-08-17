import { prisma } from './prismaService';
import { EventEmitter } from 'events';

export interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  totalParticipants: number;
  averageParticipantsPerRoom: number;
  roomsWithRecording: number;
  roomsWithScreenShare: number;
}

export interface RoomActivity {
  roomId: string;
  roomName: string;
  participantCount: number;
  isRecording: boolean;
  hasScreenShare: boolean;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Room Management Service
 * Handles database operations for room lifecycle, analytics, and monitoring
 */
export class RoomManagementService extends EventEmitter {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Start periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.performMaintenance();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new room with optional meeting association
   */
  async createRoom(data: {
    name: string;
    clientId: string;
    createdBy?: string;
    maxParticipants?: number;
    meetingId?: string;
    isPrivate?: boolean;
  }) {
    try {
      const room = await prisma.room.create({
        data: {
          name: data.name,
          clientId: data.clientId,
          maxParticipants: data.maxParticipants || 50,
          isActive: true,
          isLocked: data.isPrivate || false,
          currentParticipants: 0,
        },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            }
          }
        }
      });

      // Link to meeting if provided
      if (data.meetingId) {
        await prisma.meeting.update({
          where: { id: data.meetingId },
          data: { roomId: room.id }
        });
      }

      this.emit('roomCreated', { room, createdBy: data.createdBy });
      
      console.log(`🏠 Room created: ${room.name} (${room.id}) for client ${room.client.name}`);
      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      throw new Error('Failed to create room');
    }
  }

  /**
   * Get room details with current state
   */
  async getRoomDetails(roomId: string) {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          client: {
            select: {
              name: true,
              domain: true,
              features: true,
            }
          },
          meeting: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              scheduledStartTime: true,
              scheduledEndTime: true,
              isRecordingEnabled: true,
              allowScreenShare: true,
              allowChat: true,
            }
          },
          participants: {
            where: { isPresent: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatar: true,
                }
              }
            },
            orderBy: { joinedAt: 'asc' }
          },
          chatMessages: {
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                }
              }
            }
          }
        }
      });

      if (!room) {
        return null;
      }

      // Calculate additional metrics
      const totalDuration = await this.calculateRoomDuration(roomId);
      const peakParticipants = await this.getPeakParticipants(roomId);

      return {
        ...room,
        metrics: {
          totalDuration,
          peakParticipants,
          messageCount: room.chatMessages.length,
        },
        chatMessages: room.chatMessages.reverse(), // Show oldest first
      };
    } catch (error) {
      console.error('Error getting room details:', error);
      throw new Error('Failed to get room details');
    }
  }

  /**
   * Add user to room
   */
  async addUserToRoom(data: {
    userId: string;
    roomId: string;
    meetingId?: string;
    isModerator?: boolean;
  }) {
    try {
      // Check if room exists and has capacity
      const room = await prisma.room.findUnique({
        where: { id: data.roomId },
        include: { _count: { select: { participants: { where: { isPresent: true } } } } }
      });

      if (!room) {
        throw new Error('Room not found');
      }

      if (room._count.participants >= room.maxParticipants) {
        throw new Error('Room is full');
      }

      // Add participant
      const participant = await prisma.meetingParticipant.upsert({
        where: {
          userId_meetingId: {
            userId: data.userId,
            meetingId: data.meetingId || 'instant-' + data.roomId, // Use room ID if no meeting
          },
        },
        create: {
          userId: data.userId,
          meetingId: data.meetingId || 'instant-' + data.roomId,
          roomId: data.roomId,
          isPresent: true,
          joinedAt: new Date(),
          isModerator: data.isModerator || false,
        },
        update: {
          isPresent: true,
          joinedAt: new Date(),
          leftAt: null,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            }
          }
        }
      });

      // Update room participant count
      await this.updateRoomParticipantCount(data.roomId);

      this.emit('userJoinedRoom', { participant, room });
      
      console.log(`👤 User ${participant.user.displayName} joined room ${room.name}`);
      return participant;
    } catch (error) {
      console.error('Error adding user to room:', error);
      throw error;
    }
  }

  /**
   * Remove user from room
   */
  async removeUserFromRoom(userId: string, roomId: string, meetingId?: string) {
    try {
      // Update participant status
      const updated = await prisma.meetingParticipant.updateMany({
        where: {
          userId,
          roomId,
          isPresent: true,
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      if (updated.count > 0) {
        // Update room participant count
        await this.updateRoomParticipantCount(roomId);
        
        // Get user info for logging
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, firstName: true, lastName: true }
        });

        this.emit('userLeftRoom', { userId, roomId, userName: user?.displayName });
        
        console.log(`👤 User ${user?.displayName} left room ${roomId}`);
      }

      return updated.count > 0;
    } catch (error) {
      console.error('Error removing user from room:', error);
      throw new Error('Failed to remove user from room');
    }
  }

  /**
   * Update room settings
   */
  async updateRoomSettings(roomId: string, updates: {
    isLocked?: boolean;
    isRecording?: boolean;
    screenShareUserId?: string | null;
    maxParticipants?: number;
  }) {
    try {
      const room = await prisma.room.update({
        where: { id: roomId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      this.emit('roomUpdated', { room, updates });
      
      return room;
    } catch (error) {
      console.error('Error updating room settings:', error);
      throw new Error('Failed to update room settings');
    }
  }

  /**
   * End/close room
   */
  async endRoom(roomId: string, endedBy?: string) {
    try {
      // End all active participants
      await prisma.meetingParticipant.updateMany({
        where: {
          roomId,
          isPresent: true,
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      // Deactivate room
      const room = await prisma.room.update({
        where: { id: roomId },
        data: {
          isActive: false,
          currentParticipants: 0,
          updatedAt: new Date(),
        },
      });

      // Update associated meeting status
      await prisma.meeting.updateMany({
        where: { roomId },
        data: {
          status: 'ENDED',
          actualEndTime: new Date(),
        },
      });

      this.emit('roomEnded', { room, endedBy });
      
      console.log(`🏠 Room ended: ${room.name} (${roomId})`);
      return room;
    } catch (error) {
      console.error('Error ending room:', error);
      throw new Error('Failed to end room');
    }
  }

  /**
   * Get room statistics
   */
  async getRoomStats(clientId?: string): Promise<RoomStats> {
    try {
      const whereClause = clientId ? { clientId } : {};

      const [
        totalRooms,
        activeRooms,
        participantCounts,
        recordingRooms,
        screenShareRooms
      ] = await Promise.all([
        prisma.room.count({ where: whereClause }),
        prisma.room.count({ where: { ...whereClause, isActive: true } }),
        prisma.room.aggregate({
          where: { ...whereClause, isActive: true },
          _sum: { currentParticipants: true },
          _count: { id: true }
        }),
        prisma.room.count({ where: { ...whereClause, isRecording: true } }),
        prisma.room.count({ 
          where: { 
            ...whereClause, 
            screenShareUserId: { not: null } 
          } 
        })
      ]);

      const totalParticipants = participantCounts._sum.currentParticipants || 0;
      const roomCountObj = participantCounts._count;
      const roomCount = typeof roomCountObj === 'number' ? roomCountObj : (roomCountObj?.id || 0);

      return {
        totalRooms,
        activeRooms,
        totalParticipants,
        averageParticipantsPerRoom: roomCount > 0 ? totalParticipants / roomCount : 0,
        roomsWithRecording: recordingRooms,
        roomsWithScreenShare: screenShareRooms,
      };
    } catch (error) {
      console.error('Error getting room stats:', error);
      throw new Error('Failed to get room statistics');
    }
  }

  /**
   * Get recent room activity
   */
  async getRecentActivity(clientId?: string, limit: number = 10): Promise<RoomActivity[]> {
    try {
      const whereClause = clientId ? { clientId } : {};

      const rooms = await prisma.room.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              participants: { where: { isPresent: true } }
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      return rooms.map(room => ({
        roomId: room.id,
        roomName: room.name,
        participantCount: room._count.participants,
        isRecording: room.isRecording,
        hasScreenShare: !!room.screenShareUserId,
        createdAt: room.createdAt,
        lastActivity: room.updatedAt,
      }));
    } catch (error) {
      console.error('Error getting recent activity:', error);
      throw new Error('Failed to get recent activity');
    }
  }

  /**
   * Perform maintenance tasks
   */
  private async performMaintenance() {
    try {
      console.log('🧹 Performing room maintenance...');

      // Clean up inactive rooms older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const inactiveRooms = await prisma.room.findMany({
        where: {
          isActive: true,
          updatedAt: { lt: oneHourAgo },
          currentParticipants: 0,
        },
      });

      for (const room of inactiveRooms) {
        await this.endRoom(room.id, 'system-cleanup');
      }

      // Clean up stale participants
      await prisma.meetingParticipant.updateMany({
        where: {
          isPresent: true,
          lastPingAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes ago
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      // Update room participant counts
      const activeRooms = await prisma.room.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      for (const room of activeRooms) {
        await this.updateRoomParticipantCount(room.id);
      }

      console.log(`🧹 Maintenance completed. Cleaned up ${inactiveRooms.length} inactive rooms`);
    } catch (error) {
      console.error('Error during maintenance:', error);
    }
  }

  /**
   * Update room participant count from database
   */
  private async updateRoomParticipantCount(roomId: string) {
    const count = await prisma.meetingParticipant.count({
      where: {
        roomId,
        isPresent: true,
      },
    });

    await prisma.room.update({
      where: { id: roomId },
      data: { currentParticipants: count },
    });

    return count;
  }

  /**
   * Calculate total room duration
   */
  private async calculateRoomDuration(roomId: string): Promise<number> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { createdAt: true, updatedAt: true, isActive: true }
    });

    if (!room) return 0;

    const endTime = room.isActive ? new Date() : room.updatedAt;
    return Math.round((endTime.getTime() - room.createdAt.getTime()) / 1000 / 60); // minutes
  }

  /**
   * Get peak participants for a room
   */
  private async getPeakParticipants(roomId: string): Promise<number> {
    // This would require a separate analytics table in a real implementation
    // For now, return current max or estimated based on total participants
    const totalParticipants = await prisma.meetingParticipant.count({
      where: { roomId }
    });

    return Math.max(totalParticipants, 1);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const roomManagementService = new RoomManagementService();

export default roomManagementService;