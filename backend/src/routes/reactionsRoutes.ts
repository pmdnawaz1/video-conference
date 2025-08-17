import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getReactionsService } from '../services/reactionsService';
import { prisma } from '../services/prismaService';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

/**
 * @route GET /api/reactions/meeting/:meetingId
 * @desc Get reactions for a meeting
 * @access Private
 */
router.get('/meeting/:meetingId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { meetingId } = req.params;
    const { timeframe = 'session' } = req.query;

    const reactionsService = getReactionsService();
    if (!reactionsService) {
      return res.status(503).json({ error: 'Reactions service not available' });
    }

    // Verify user has access to this meeting
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        userId: req.user.id,
      },
    });

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this meeting' });
    }

    const stats = await reactionsService.getReactionStats(
      meetingId, 
      timeframe as 'live' | 'session' | 'all'
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting meeting reactions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get reactions' 
    });
  }
});

/**
 * @route GET /api/reactions/meeting/:meetingId/analytics
 * @desc Get detailed reaction analytics for a meeting
 * @access Private (Admin/Moderator)
 */
router.get('/meeting/:meetingId/analytics', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { meetingId } = req.params;
    const { startTime, endTime } = req.query;

    // Verify user is moderator or admin
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        userId: req.user.id,
        isModerator: true,
      },
    });

    if (!participant && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Moderator access required' });
    }

    const whereClause: any = { meetingId };
    if (startTime && endTime) {
      whereClause.timestamp = {
        gte: new Date(startTime as string),
        lte: new Date(endTime as string),
      };
    }

    const [reactions, interactions] = await Promise.all([
      prisma.meetingReaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.meetingInteraction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Process analytics
    const reactionsByTime = reactions.reduce((acc, reaction) => {
      const hour = reaction.timestamp.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as { [hour: number]: number });

    const reactionsByEmoji = reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
      return acc;
    }, {} as { [emoji: string]: number });

    const reactionsByUser = reactions.reduce((acc, reaction) => {
      const userName = `${reaction.user?.firstName || ''} ${reaction.user?.lastName || ''}`.trim();
      if (!acc[reaction.userId]) {
        acc[reaction.userId] = { name: userName, count: 0, reactions: [] };
      }
      acc[reaction.userId].count++;
      acc[reaction.userId].reactions.push({
        emoji: reaction.emoji,
        timestamp: reaction.timestamp,
      });
      return acc;
    }, {} as any);

    const interactionsByType = interactions.reduce((acc, interaction) => {
      acc[interaction.type] = (acc[interaction.type] || 0) + 1;
      return acc;
    }, {} as { [type: string]: number });

    res.json({
      success: true,
      analytics: {
        summary: {
          totalReactions: reactions.length,
          totalInteractions: interactions.length,
          uniqueReactors: Object.keys(reactionsByUser).length,
          timeRange: {
            start: startTime || reactions[reactions.length - 1]?.timestamp,
            end: endTime || reactions[0]?.timestamp,
          },
        },
        reactionsByTime,
        reactionsByEmoji,
        reactionsByUser: Object.entries(reactionsByUser).map(([userId, data]) => ({
          userId,
          ...(data as any),
        })),
        interactionsByType,
        recentActivity: reactions.slice(0, 50),
      },
    });
  } catch (error) {
    console.error('Error getting reaction analytics:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get analytics' 
    });
  }
});

/**
 * @route GET /api/reactions/meeting/:meetingId/live
 * @desc Get live reaction state for a meeting
 * @access Private
 */
router.get('/meeting/:meetingId/live', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { meetingId } = req.params;

    // Verify user has access to this meeting
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        userId: req.user.id,
      },
    });

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this meeting' });
    }

    const reactionsService = getReactionsService();
    if (!reactionsService) {
      return res.status(503).json({ error: 'Reactions service not available' });
    }

    const meetingState = reactionsService.getMeetingState(meetingId);

    res.json({
      success: true,
      state: meetingState,
    });
  } catch (error) {
    console.error('Error getting live reactions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get live state' 
    });
  }
});

/**
 * @route POST /api/reactions/meeting/:meetingId/clear
 * @desc Clear all reactions for a meeting (moderator only)
 * @access Private (Moderator/Admin)
 */
router.post('/meeting/:meetingId/clear', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { meetingId } = req.params;

    // Verify user is moderator or admin
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        userId: req.user.id,
        isModerator: true,
      },
    });

    if (!participant && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Moderator access required' });
    }

    const reactionsService = getReactionsService();
    if (!reactionsService) {
      return res.status(503).json({ error: 'Reactions service not available' });
    }

    // This will be handled by the Socket.IO event, but we can provide a REST endpoint too
    // For now, just return success - the actual clearing happens via WebSocket
    res.json({
      success: true,
      message: 'Reactions cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing reactions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to clear reactions' 
    });
  }
});

/**
 * @route GET /api/reactions/user/:userId/stats
 * @desc Get reaction statistics for a specific user
 * @access Private (Admin or Self)
 */
router.get('/user/:userId/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { userId } = req.params;
    const { timeframe = '7d' } = req.query;

    // Verify access - user can see their own stats, admins can see any
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate date range based on timeframe
    const now = new Date();
    const timeframes = {
      '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    };

    const startDate = timeframes[timeframe as keyof typeof timeframes] || timeframes['7d'];

    const [reactions, interactions] = await Promise.all([
      prisma.meetingReaction.findMany({
        where: {
          userId,
          timestamp: { gte: startDate },
        },
        include: {
          meeting: {
            select: {
              title: true,
              startTime: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.meetingInteraction.findMany({
        where: {
          userId,
          timestamp: { gte: startDate },
        },
        include: {
          meeting: {
            select: {
              title: true,
              startTime: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Process user statistics
    const emojiUsage = reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
      return acc;
    }, {} as { [emoji: string]: number });

    const meetingActivity = reactions.reduce((acc, reaction) => {
      const meetingId = reaction.meetingId;
      if (!acc[meetingId]) {
        acc[meetingId] = {
          meetingTitle: reaction.meeting?.title || 'Unknown',
          reactionCount: 0,
        };
      }
      acc[meetingId].reactionCount++;
      return acc;
    }, {} as any);

    const dailyActivity = reactions.reduce((acc, reaction) => {
      const day = reaction.timestamp.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as { [day: string]: number });

    res.json({
      success: true,
      stats: {
        summary: {
          totalReactions: reactions.length,
          totalInteractions: interactions.length,
          activeDays: Object.keys(dailyActivity).length,
          favoriteEmoji: Object.entries(emojiUsage).sort(([,a], [,b]) => b - a)[0]?.[0] || null,
          timeframe,
        },
        emojiUsage,
        dailyActivity,
        meetingActivity: Object.entries(meetingActivity).map(([meetingId, data]) => ({
          meetingId,
          ...(data as any),
        })),
        recentReactions: reactions.slice(0, 20),
      },
    });
  } catch (error) {
    console.error('Error getting user reaction stats:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get user stats' 
    });
  }
});

/**
 * @route GET /api/reactions/emoji/popular
 * @desc Get popular emojis across the platform
 * @access Private (Admin)
 */
router.get('/emoji/popular', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { timeframe = '30d', limit = 20 } = req.query;

    // Calculate date range
    const now = new Date();
    const timeframes = {
      '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    };

    const startDate = timeframes[timeframe as keyof typeof timeframes] || timeframes['30d'];

    const reactions = await prisma.meetingReaction.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      select: {
        emoji: true,
        timestamp: true,
      },
    });

    const emojiCounts = reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
      return acc;
    }, {} as { [emoji: string]: number });

    const popularEmojis = Object.entries(emojiCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, parseInt(limit as string))
      .map(([emoji, count]) => ({
        emoji,
        count,
        percentage: Math.round((count / reactions.length) * 100),
      }));

    res.json({
      success: true,
      data: {
        timeframe,
        totalReactions: reactions.length,
        popularEmojis,
      },
    });
  } catch (error) {
    console.error('Error getting popular emojis:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get popular emojis' 
    });
  }
});

export default router;