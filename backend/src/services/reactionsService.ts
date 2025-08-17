import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './prismaService';

export interface EmojiReaction {
  id: string;
  emoji: string;
  userId: string;
  meetingId: string;
  timestamp: Date;
  userName?: string;
}

export interface RaisedHand {
  userId: string;
  userName: string;
  timestamp: Date;
  meetingId: string;
}

export interface ParticipantStatus {
  userId: string;
  userName: string;
  status: 'online' | 'away' | 'presenting' | 'muted' | 'speaking';
  timestamp: Date;
  meetingId: string;
}

export interface ReactionStats {
  meetingId: string;
  totalReactions: number;
  reactionCounts: { [emoji: string]: number };
  topReactors: { userId: string; userName: string; count: number }[];
  peakReactionTime: Date | null;
}

/**
 * Reactions Service
 * Handles real-time emoji reactions, raise hand functionality, and participant interactions
 */
export class ReactionsService {
  private io: SocketIOServer;
  private activeReactions: Map<string, EmojiReaction[]> = new Map(); // meetingId -> reactions
  private raisedHands: Map<string, Map<string, RaisedHand>> = new Map(); // meetingId -> userId -> hand
  private participantStatuses: Map<string, Map<string, ParticipantStatus>> = new Map(); // meetingId -> userId -> status
  private reactionTimers: Map<string, NodeJS.Timeout> = new Map(); // reactionId -> timeout

  constructor(io: SocketIOServer) {
    this.io = io;
    this.initializeEventHandlers();
  }

  /**
   * Initialize Socket.IO event handlers for reactions
   */
  private initializeEventHandlers() {
    this.io.on('connection', (socket) => {
      // Emoji reaction events
      socket.on('emoji-reaction', async (data: {
        meetingId: string;
        userId: string;
        userName: string;
        emoji: string;
        duration?: number;
      }) => {
        await this.handleEmojiReaction(socket, data);
      });

      // Raise hand events
      socket.on('raise-hand', async (data: {
        meetingId: string;
        userId: string;
        userName: string;
      }) => {
        await this.handleRaiseHand(socket, data);
      });

      socket.on('lower-hand', async (data: {
        meetingId: string;
        userId: string;
      }) => {
        await this.handleLowerHand(socket, data);
      });

      // Participant status events
      socket.on('update-status', async (data: {
        meetingId: string;
        userId: string;
        userName: string;
        status: 'online' | 'away' | 'presenting' | 'muted' | 'speaking';
      }) => {
        await this.handleStatusUpdate(socket, data);
      });

      // Get current reactions and status
      socket.on('get-reactions', async (data: { meetingId: string }) => {
        await this.sendCurrentReactions(socket, data.meetingId);
      });

      socket.on('get-raised-hands', async (data: { meetingId: string }) => {
        await this.sendRaisedHands(socket, data.meetingId);
      });

      socket.on('get-participant-statuses', async (data: { meetingId: string }) => {
        await this.sendParticipantStatuses(socket, data.meetingId);
      });

      // Moderator controls
      socket.on('clear-reactions', async (data: {
        meetingId: string;
        moderatorId: string;
      }) => {
        await this.handleClearReactions(socket, data);
      });

      socket.on('lower-all-hands', async (data: {
        meetingId: string;
        moderatorId: string;
      }) => {
        await this.handleLowerAllHands(socket, data);
      });

      // Reaction analytics
      socket.on('get-reaction-stats', async (data: {
        meetingId: string;
        timeframe?: 'live' | 'session' | 'all';
      }) => {
        await this.sendReactionStats(socket, data);
      });
    });
  }

  /**
   * Handle emoji reaction
   */
  private async handleEmojiReaction(socket: any, data: {
    meetingId: string;
    userId: string;
    userName: string;
    emoji: string;
    duration?: number;
  }) {
    try {
      const reaction: EmojiReaction = {
        id: `${data.userId}_${Date.now()}_${Math.random()}`,
        emoji: data.emoji,
        userId: data.userId,
        userName: data.userName,
        meetingId: data.meetingId,
        timestamp: new Date(),
      };

      // Store in memory for real-time access
      if (!this.activeReactions.has(data.meetingId)) {
        this.activeReactions.set(data.meetingId, []);
      }
      this.activeReactions.get(data.meetingId)!.push(reaction);

      // Auto-remove reaction after duration (default 5 seconds)
      const duration = data.duration || 5000;
      const timer = setTimeout(() => {
        this.removeReaction(data.meetingId, reaction.id);
      }, duration);
      this.reactionTimers.set(reaction.id, timer);

      // Persist to database for analytics
      try {
        await prisma.meetingReaction.create({
          data: {
            meetingId: data.meetingId,
            userId: data.userId,
            emoji: data.emoji,
            timestamp: reaction.timestamp,
          },
        });
      } catch (dbError) {
        console.warn('Failed to persist reaction to database:', dbError);
      }

      // Broadcast to all participants in the meeting
      socket.to(data.meetingId).emit('reaction-added', reaction);
      socket.emit('reaction-added', reaction);

      console.log(`😊 Reaction added: ${data.emoji} by ${data.userName} in meeting ${data.meetingId}`);

    } catch (error) {
      console.error('Error handling emoji reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  /**
   * Remove reaction from active list
   */
  private removeReaction(meetingId: string, reactionId: string) {
    const reactions = this.activeReactions.get(meetingId);
    if (reactions) {
      const index = reactions.findIndex(r => r.id === reactionId);
      if (index !== -1) {
        reactions.splice(index, 1);
        
        // Broadcast removal
        this.io.to(meetingId).emit('reaction-removed', { reactionId });
        
        // Clear timer
        const timer = this.reactionTimers.get(reactionId);
        if (timer) {
          clearTimeout(timer);
          this.reactionTimers.delete(reactionId);
        }
      }
    }
  }

  /**
   * Handle raise hand
   */
  private async handleRaiseHand(socket: any, data: {
    meetingId: string;
    userId: string;
    userName: string;
  }) {
    try {
      const raisedHand: RaisedHand = {
        userId: data.userId,
        userName: data.userName,
        timestamp: new Date(),
        meetingId: data.meetingId,
      };

      // Store in memory
      if (!this.raisedHands.has(data.meetingId)) {
        this.raisedHands.set(data.meetingId, new Map());
      }
      this.raisedHands.get(data.meetingId)!.set(data.userId, raisedHand);

      // Persist to database
      try {
        await prisma.meetingInteraction.create({
          data: {
            meetingId: data.meetingId,
            userId: data.userId,
            type: 'HAND_RAISED',
            timestamp: raisedHand.timestamp,
          },
        });
      } catch (dbError) {
        console.warn('Failed to persist hand raise to database:', dbError);
      }

      // Broadcast to all participants
      this.io.to(data.meetingId).emit('hand-raised', raisedHand);

      console.log(`✋ Hand raised by ${data.userName} in meeting ${data.meetingId}`);

    } catch (error) {
      console.error('Error handling raise hand:', error);
      socket.emit('error', { message: 'Failed to raise hand' });
    }
  }

  /**
   * Handle lower hand
   */
  private async handleLowerHand(socket: any, data: {
    meetingId: string;
    userId: string;
  }) {
    try {
      // Remove from memory
      const hands = this.raisedHands.get(data.meetingId);
      if (hands && hands.has(data.userId)) {
        hands.delete(data.userId);

        // Persist to database
        try {
          await prisma.meetingInteraction.create({
            data: {
              meetingId: data.meetingId,
              userId: data.userId,
              type: 'HAND_LOWERED',
              timestamp: new Date(),
            },
          });
        } catch (dbError) {
          console.warn('Failed to persist hand lower to database:', dbError);
        }

        // Broadcast to all participants
        this.io.to(data.meetingId).emit('hand-lowered', {
          userId: data.userId,
          meetingId: data.meetingId,
        });

        console.log(`✋ Hand lowered by ${data.userId} in meeting ${data.meetingId}`);
      }

    } catch (error) {
      console.error('Error handling lower hand:', error);
      socket.emit('error', { message: 'Failed to lower hand' });
    }
  }

  /**
   * Handle participant status update
   */
  private async handleStatusUpdate(socket: any, data: {
    meetingId: string;
    userId: string;
    userName: string;
    status: 'online' | 'away' | 'presenting' | 'muted' | 'speaking';
  }) {
    try {
      const status: ParticipantStatus = {
        userId: data.userId,
        userName: data.userName,
        status: data.status,
        timestamp: new Date(),
        meetingId: data.meetingId,
      };

      // Store in memory
      if (!this.participantStatuses.has(data.meetingId)) {
        this.participantStatuses.set(data.meetingId, new Map());
      }
      this.participantStatuses.get(data.meetingId)!.set(data.userId, status);

      // Broadcast to all participants
      this.io.to(data.meetingId).emit('participant-status-updated', status);

      // Don't log speaking status changes (too noisy)
      if (data.status !== 'speaking') {
        console.log(`👤 Status updated: ${data.userName} is now ${data.status} in meeting ${data.meetingId}`);
      }

    } catch (error) {
      console.error('Error handling status update:', error);
      socket.emit('error', { message: 'Failed to update status' });
    }
  }

  /**
   * Send current reactions to a participant
   */
  private async sendCurrentReactions(socket: any, meetingId: string) {
    const reactions = this.activeReactions.get(meetingId) || [];
    socket.emit('current-reactions', { meetingId, reactions });
  }

  /**
   * Send raised hands to a participant
   */
  private async sendRaisedHands(socket: any, meetingId: string) {
    const hands = this.raisedHands.get(meetingId);
    const raisedHandsList = hands ? Array.from(hands.values()) : [];
    socket.emit('raised-hands', { meetingId, raisedHands: raisedHandsList });
  }

  /**
   * Send participant statuses to a participant
   */
  private async sendParticipantStatuses(socket: any, meetingId: string) {
    const statuses = this.participantStatuses.get(meetingId);
    const statusList = statuses ? Array.from(statuses.values()) : [];
    socket.emit('participant-statuses', { meetingId, statuses: statusList });
  }

  /**
   * Handle moderator clearing all reactions
   */
  private async handleClearReactions(socket: any, data: {
    meetingId: string;
    moderatorId: string;
  }) {
    try {
      // Verify moderator permissions
      const isModerator = await this.verifyModeratorPermissions(data.moderatorId, data.meetingId);
      if (!isModerator) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      // Clear all reactions for the meeting
      const reactions = this.activeReactions.get(data.meetingId) || [];
      reactions.forEach(reaction => {
        const timer = this.reactionTimers.get(reaction.id);
        if (timer) {
          clearTimeout(timer);
          this.reactionTimers.delete(reaction.id);
        }
      });

      this.activeReactions.set(data.meetingId, []);

      // Broadcast to all participants
      this.io.to(data.meetingId).emit('reactions-cleared', {
        meetingId: data.meetingId,
        moderatorId: data.moderatorId,
      });

      console.log(`🧹 All reactions cleared by moderator ${data.moderatorId} in meeting ${data.meetingId}`);

    } catch (error) {
      console.error('Error clearing reactions:', error);
      socket.emit('error', { message: 'Failed to clear reactions' });
    }
  }

  /**
   * Handle moderator lowering all hands
   */
  private async handleLowerAllHands(socket: any, data: {
    meetingId: string;
    moderatorId: string;
  }) {
    try {
      // Verify moderator permissions
      const isModerator = await this.verifyModeratorPermissions(data.moderatorId, data.meetingId);
      if (!isModerator) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      // Clear all raised hands for the meeting
      this.raisedHands.set(data.meetingId, new Map());

      // Broadcast to all participants
      this.io.to(data.meetingId).emit('all-hands-lowered', {
        meetingId: data.meetingId,
        moderatorId: data.moderatorId,
      });

      console.log(`✋ All hands lowered by moderator ${data.moderatorId} in meeting ${data.meetingId}`);

    } catch (error) {
      console.error('Error lowering all hands:', error);
      socket.emit('error', { message: 'Failed to lower all hands' });
    }
  }

  /**
   * Send reaction statistics
   */
  private async sendReactionStats(socket: any, data: {
    meetingId: string;
    timeframe?: 'live' | 'session' | 'all';
  }) {
    try {
      const stats = await this.getReactionStats(data.meetingId, data.timeframe);
      socket.emit('reaction-stats', stats);

    } catch (error) {
      console.error('Error getting reaction stats:', error);
      socket.emit('error', { message: 'Failed to get reaction stats' });
    }
  }

  /**
   * Get reaction statistics for a meeting
   */
  async getReactionStats(meetingId: string, timeframe: 'live' | 'session' | 'all' = 'live'): Promise<ReactionStats> {
    const liveReactions = this.activeReactions.get(meetingId) || [];
    
    // For live stats, use in-memory data
    if (timeframe === 'live') {
      const reactionCounts: { [emoji: string]: number } = {};
      liveReactions.forEach(reaction => {
        reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
      });

      return {
        meetingId,
        totalReactions: liveReactions.length,
        reactionCounts,
        topReactors: [], // Would need more tracking for live data
        peakReactionTime: null,
      };
    }

    // For session/all stats, query database
    try {
      const reactions = await prisma.meetingReaction.findMany({
        where: { meetingId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const reactionCounts: { [emoji: string]: number } = {};
      const userCounts: { [userId: string]: { name: string; count: number } } = {};

      reactions.forEach(reaction => {
        // Count by emoji
        reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
        
        // Count by user
        const userName = `${reaction.user?.firstName || ''} ${reaction.user?.lastName || ''}`.trim() || 'Unknown';
        if (!userCounts[reaction.userId]) {
          userCounts[reaction.userId] = { name: userName, count: 0 };
        }
        userCounts[reaction.userId].count++;
      });

      const topReactors = Object.entries(userCounts)
        .map(([userId, data]) => ({ userId, userName: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        meetingId,
        totalReactions: reactions.length,
        reactionCounts,
        topReactors,
        peakReactionTime: null, // Could be calculated from timestamp analysis
      };

    } catch (error) {
      console.error('Error querying reaction stats from database:', error);
      return {
        meetingId,
        totalReactions: 0,
        reactionCounts: {},
        topReactors: [],
        peakReactionTime: null,
      };
    }
  }

  /**
   * Verify if user has moderator permissions
   */
  private async verifyModeratorPermissions(userId: string, meetingId: string): Promise<boolean> {
    try {
      const participant = await prisma.meetingParticipant.findFirst({
        where: {
          userId,
          meetingId,
          isModerator: true,
        },
      });
      
      return !!participant;

    } catch (error) {
      console.error('Error verifying moderator permissions:', error);
      return false;
    }
  }

  /**
   * Clean up meeting reactions and interactions
   */
  async cleanupMeeting(meetingId: string) {
    // Clear memory
    this.activeReactions.delete(meetingId);
    this.raisedHands.delete(meetingId);
    this.participantStatuses.delete(meetingId);

    // Clear timers
    this.reactionTimers.forEach((timer, reactionId) => {
      if (reactionId.includes(meetingId)) {
        clearTimeout(timer);
        this.reactionTimers.delete(reactionId);
      }
    });

    console.log(`🧹 Cleaned up reactions for meeting ${meetingId}`);
  }

  /**
   * Get current state for a meeting
   */
  getMeetingState(meetingId: string) {
    return {
      reactions: this.activeReactions.get(meetingId) || [],
      raisedHands: Array.from(this.raisedHands.get(meetingId)?.values() || []),
      participantStatuses: Array.from(this.participantStatuses.get(meetingId)?.values() || []),
    };
  }
}

// Export singleton instance
let reactionsService: ReactionsService | null = null;

export function initializeReactionsService(io: SocketIOServer): ReactionsService {
  if (!reactionsService) {
    reactionsService = new ReactionsService(io);
  }
  return reactionsService;
}

export function getReactionsService(): ReactionsService | null {
  return reactionsService;
}

export default ReactionsService;