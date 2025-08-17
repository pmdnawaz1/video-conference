import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../services/prismaService';
import { authService } from '../services/authService';
import { roomManagementService } from '../services/roomManagementService';
import { getAnalyticsService } from '../services/analyticsService';
import { 
  authenticate, 
  authorize,
  rateLimit,
  handleCorsAuth,
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware to all analytics routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);

// Rate limiting for analytics (more restrictive)
const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per window
  message: 'Too many analytics requests, please try again later'
});

router.use(analyticsRateLimit);

/**
 * GET /api/analytics/overview
 * Get platform overview analytics
 */
router.get('/overview', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get current user to determine access level
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
    const clientFilter = isAdmin ? { clientId: currentUser.clientId } : {};

    // Get basic platform statistics
    const [
      totalUsers,
      activeUsers,
      totalMeetings,
      activeMeetings,
      totalRooms,
      activeRooms,
      todayMeetings,
      weeklyMeetings
    ] = await Promise.all([
      prisma.user.count({ where: { ...clientFilter, isActive: true } }),
      prisma.user.count({ 
        where: { 
          ...clientFilter, 
          isActive: true,
          lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        } 
      }),
      prisma.meeting.count({ where: clientFilter }),
      prisma.meeting.count({ where: { ...clientFilter, status: 'ACTIVE' } }),
      prisma.room.count({ where: clientFilter }),
      prisma.room.count({ where: { ...clientFilter, isActive: true } }),
      prisma.meeting.count({
        where: {
          ...clientFilter,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          }
        }
      }),
      prisma.meeting.count({
        where: {
          ...clientFilter,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          }
        }
      }),
    ]);

    // Get room statistics if admin
    let roomStats = null;
    if (isAdmin) {
      roomStats = await roomManagementService.getRoomStats(currentUser.clientId);
    }

    // Get recent activity
    const recentMeetings = await prisma.meeting.findMany({
      where: {
        ...clientFilter,
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          }
        },
        _count: {
          select: {
            participants: { where: { isPresent: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      analytics: {
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers,
            activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
          },
          meetings: {
            total: totalMeetings,
            active: activeMeetings,
            today: todayMeetings,
            thisWeek: weeklyMeetings,
          },
          rooms: {
            total: totalRooms,
            active: activeRooms,
            stats: roomStats,
          },
        },
        recentActivity: recentMeetings.map(meeting => ({
          id: meeting.id,
          title: meeting.title,
          status: meeting.status,
          creator: meeting.creator.displayName,
          participants: meeting._count.participants,
          updatedAt: meeting.updatedAt,
        })),
      }
    });
  } catch (error) {
    console.error('Error getting overview analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics overview',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/meetings
 * Get meeting analytics
 */
router.get('/meetings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { 
      period = 'daily',
      days = '30',
      userId 
    } = req.query;

    const dayCount = Math.min(parseInt(days as string), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dayCount);

    // Get current user to determine access level
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
    let whereClause: any = {
      createdAt: { gte: startDate }
    };

    // Apply filters based on permissions
    if (userId) {
      // Check if user can access this data
      if (userId !== req.user.id && !isAdmin) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view your own analytics'
        });
      }
      whereClause.createdBy = userId;
    } else if (!isAdmin) {
      // Non-admin users can only see their own data
      whereClause.createdBy = req.user.id;
    } else {
      // Admin users see data from their client
      whereClause.clientId = currentUser.clientId;
    }

    // Get meeting analytics
    const meetingAnalytics = await prisma.meetingAnalytics.findMany({
      where: {
        meeting: whereClause
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            status: true,
            meetingType: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregate analytics by period
    const analytics: any = {};
    
    meetingAnalytics.forEach(ma => {
      const date = ma.meeting.createdAt;
      let key: string;
      
      if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0]; // daily
      }

      if (!analytics[key]) {
        analytics[key] = {
          date: key,
          meetingCount: 0,
          totalDuration: 0,
          totalParticipants: 0,
          totalMessages: 0,
          averageDuration: 0,
          averageParticipants: 0,
        };
      }

      analytics[key].meetingCount++;
      analytics[key].totalDuration += ma.actualDuration;
      analytics[key].totalParticipants += ma.totalParticipants;
      analytics[key].totalMessages += ma.totalMessages;
    });

    // Calculate averages
    Object.values(analytics).forEach((data: any) => {
      data.averageDuration = data.meetingCount > 0 
        ? Math.round(data.totalDuration / data.meetingCount) 
        : 0;
      data.averageParticipants = data.meetingCount > 0 
        ? Math.round(data.totalParticipants / data.meetingCount) 
        : 0;
    });

    // Convert to array and sort by date
    const analyticsArray = Object.values(analytics).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate summary statistics
    const summary = {
      totalMeetings: meetingAnalytics.length,
      totalDuration: meetingAnalytics.reduce((sum, ma) => sum + ma.actualDuration, 0),
      averageDuration: meetingAnalytics.length > 0 
        ? Math.round(meetingAnalytics.reduce((sum, ma) => sum + ma.actualDuration, 0) / meetingAnalytics.length)
        : 0,
      totalParticipants: meetingAnalytics.reduce((sum, ma) => sum + ma.totalParticipants, 0),
      averageParticipants: meetingAnalytics.length > 0 
        ? Math.round(meetingAnalytics.reduce((sum, ma) => sum + ma.totalParticipants, 0) / meetingAnalytics.length)
        : 0,
      totalMessages: meetingAnalytics.reduce((sum, ma) => sum + ma.totalMessages, 0),
    };

    res.json({
      success: true,
      analytics: {
        period,
        days: dayCount,
        data: analyticsArray,
        summary,
      }
    });
  } catch (error) {
    console.error('Error getting meeting analytics:', error);
    res.status(500).json({
      error: 'Failed to get meeting analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/users
 * Get user analytics (admin only)
 */
router.get('/users', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { 
      period = 'monthly',
      months = '12'
    } = req.query;

    const monthCount = Math.min(parseInt(months as string), 24);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthCount);

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user analytics
    const userAnalytics = await prisma.userAnalytics.findMany({
      where: {
        clientId: currentUser.clientId,
        date: { gte: startDate },
        period: period as string,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { totalMeetingDuration: 'desc' }
      ]
    });

    // Aggregate by time period
    const analytics: any = {};
    
    userAnalytics.forEach(ua => {
      const key = ua.date.toISOString().split('T')[0];
      
      if (!analytics[key]) {
        analytics[key] = {
          date: key,
          totalUsers: 0,
          totalMeetings: 0,
          totalDuration: 0,
          totalMessages: 0,
          topUsers: [],
        };
      }

      analytics[key].totalUsers++;
      analytics[key].totalMeetings += ua.meetingsCreated + ua.meetingsJoined;
      analytics[key].totalDuration += ua.totalMeetingDuration;
      analytics[key].totalMessages += ua.messagesSet;
    });

    // Get top users for current period
    const topUsers = await prisma.userAnalytics.findMany({
      where: {
        clientId: currentUser.clientId,
        date: { gte: startDate },
        period: period as string,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          }
        }
      },
      orderBy: { totalMeetingDuration: 'desc' },
      take: 10,
    });

    // Calculate user engagement metrics
    const userEngagement = topUsers.map(ua => ({
      userId: ua.user.id,
      name: ua.user.displayName || `${ua.user.firstName} ${ua.user.lastName}`,
      meetingsCreated: ua.meetingsCreated,
      meetingsJoined: ua.meetingsJoined,
      totalMeetings: ua.meetingsCreated + ua.meetingsJoined,
      totalDuration: ua.totalMeetingDuration,
      averageDuration: (ua.meetingsCreated + ua.meetingsJoined) > 0 
        ? Math.round(ua.totalMeetingDuration / (ua.meetingsCreated + ua.meetingsJoined))
        : 0,
      messagesSet: ua.messagesSet,
    }));

    res.json({
      success: true,
      analytics: {
        period,
        months: monthCount,
        data: Object.values(analytics).sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        topUsers: userEngagement,
        summary: {
          totalUsers: new Set(userAnalytics.map(ua => ua.userId)).size,
          totalMeetings: userAnalytics.reduce((sum, ua) => sum + ua.meetingsCreated + ua.meetingsJoined, 0),
          totalDuration: userAnalytics.reduce((sum, ua) => sum + ua.totalMeetingDuration, 0),
          totalMessages: userAnalytics.reduce((sum, ua) => sum + ua.messagesSet, 0),
        }
      }
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      error: 'Failed to get user analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/usage
 * Get platform usage analytics
 */
router.get('/usage', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { days = '30' } = req.query;
    const dayCount = Math.min(parseInt(days as string), 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dayCount);

    // Get current user to determine access level
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
    const clientFilter = isAdmin ? { clientId: currentUser.clientId } : { createdBy: req.user.id };

    // Get daily usage statistics
    const usageStats: any[] = [];
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const [
        meetingsCreated,
        activeMeetings,
        totalParticipants,
        messagesSet,
        activeUsers
      ] = await Promise.all([
        prisma.meeting.count({
          where: {
            ...clientFilter,
            createdAt: { gte: dateStart, lte: dateEnd }
          }
        }),
        prisma.meeting.count({
          where: {
            ...clientFilter,
            actualStartTime: { gte: dateStart, lte: dateEnd },
            status: 'ACTIVE'
          }
        }),
        isAdmin ? prisma.meetingParticipant.count({
          where: {
            joinedAt: { gte: dateStart, lte: dateEnd },
            meeting: { clientId: currentUser.clientId }
          }
        }) : prisma.meetingParticipant.count({
          where: {
            userId: req.user.id,
            joinedAt: { gte: dateStart, lte: dateEnd }
          }
        }),
        isAdmin ? prisma.chatMessage.count({
          where: {
            createdAt: { gte: dateStart, lte: dateEnd },
            meeting: { clientId: currentUser.clientId }
          }
        }) : prisma.chatMessage.count({
          where: {
            userId: req.user.id,
            createdAt: { gte: dateStart, lte: dateEnd }
          }
        }),
        isAdmin ? prisma.user.count({
          where: {
            clientId: currentUser.clientId,
            lastLoginAt: { gte: dateStart, lte: dateEnd }
          }
        }) : 0
      ]);

      usageStats.push({
        date: date.toISOString().split('T')[0],
        meetingsCreated,
        activeMeetings,
        totalParticipants,
        messagesSet,
        activeUsers: isAdmin ? activeUsers : (totalParticipants > 0 ? 1 : 0), // For non-admin, just show if they were active
      });
    }

    // Calculate trends
    const totalMeetings = usageStats.reduce((sum, day) => sum + day.meetingsCreated, 0);
    const totalMessages = usageStats.reduce((sum, day) => sum + day.messagesSet, 0);
    const averageDailyMeetings = Math.round(totalMeetings / dayCount);
    const averageDailyMessages = Math.round(totalMessages / dayCount);

    res.json({
      success: true,
      analytics: {
        period: 'daily',
        days: dayCount,
        data: usageStats,
        summary: {
          totalMeetings,
          totalMessages,
          averageDailyMeetings,
          averageDailyMessages,
          peakDay: usageStats.reduce((max, day) => 
            day.meetingsCreated > max.meetingsCreated ? day : max, usageStats[0]
          ),
        }
      }
    });
  } catch (error) {
    console.error('Error getting usage analytics:', error);
    res.status(500).json({
      error: 'Failed to get usage analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data (admin only)
 */
router.get('/export', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { 
      type = 'meetings',
      format = 'json',
      days = '30'
    } = req.query;

    const dayCount = Math.min(parseInt(days as string), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dayCount);

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    let data: any[] = [];

    if (type === 'meetings') {
      data = await prisma.meeting.findMany({
        where: {
          clientId: currentUser.clientId,
          createdAt: { gte: startDate }
        },
        include: {
          creator: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          analytics: true,
          _count: {
            select: {
              participants: true,
              chatMessages: true,
              recordings: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else if (type === 'users') {
      data = await prisma.user.findMany({
        where: {
          clientId: currentUser.clientId,
          createdAt: { gte: startDate }
        },
        include: {
          _count: {
            select: {
              createdMeetings: true,
              meetingParticipants: true,
              chatMessages: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(data, type as string);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // Return JSON format
      res.json({
        success: true,
        exportType: type,
        format,
        period: `${dayCount} days`,
        generatedAt: new Date().toISOString(),
        data
      });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      error: 'Failed to export analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * Helper function to convert data to CSV format
 */
function convertToCSV(data: any[], type: string): string {
  if (data.length === 0) return '';

  let headers: string[] = [];
  let rows: string[] = [];

  if (type === 'meetings') {
    headers = ['ID', 'Title', 'Type', 'Status', 'Creator', 'Participants', 'Messages', 'Duration', 'Created At'];
    rows = data.map(meeting => [
      meeting.id,
      meeting.title.replace(/,/g, ';'), // Replace commas to avoid CSV issues
      meeting.meetingType,
      meeting.status,
      `${meeting.creator.firstName} ${meeting.creator.lastName}`,
      meeting._count.participants,
      meeting._count.chatMessages,
      meeting.duration || 0,
      meeting.createdAt.toISOString(),
    ].join(','));
  } else if (type === 'users') {
    headers = ['ID', 'Name', 'Email', 'Role', 'Meetings Created', 'Meetings Joined', 'Messages', 'Created At'];
    rows = data.map(user => [
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.role,
      user._count.createdMeetings,
      user._count.meetingParticipants,
      user._count.chatMessages,
      user.createdAt.toISOString(),
    ].join(','));
  }

  return [headers.join(','), ...rows].join('\n');
}

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics with insights
 */
router.get('/dashboard', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { days = '30' } = req.query;
    const dayCount = Math.min(parseInt(days as string), 90);

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const analyticsService = getAnalyticsService();
    const dashboard = await analyticsService.getDashboardAnalytics(currentUser.clientId, dayCount);

    res.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting dashboard analytics:', error);
    res.status(500).json({
      error: 'Failed to get dashboard analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/realtime/:meetingId
 * Get real-time analytics for an active meeting
 */
router.get('/realtime/:meetingId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { meetingId } = req.params;

    // Verify user has access to this meeting
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        userId: req.user.id,
        meetingId,
      },
      include: {
        meeting: {
          select: {
            title: true,
            status: true,
            createdBy: true,
          }
        }
      }
    });

    if (!participant) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a participant in this meeting'
      });
    }

    const analyticsService = getAnalyticsService();
    const realTimeMetrics = analyticsService.getRealTimeMetrics(meetingId);

    // Get current participant status
    const currentParticipants = await prisma.meetingParticipant.findMany({
      where: {
        meetingId,
        isPresent: true,
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

    res.json({
      success: true,
      meetingId,
      realTimeMetrics: {
        ...realTimeMetrics,
        participants: realTimeMetrics?.participants ? Array.from(realTimeMetrics.participants) : [],
        currentParticipants: currentParticipants.map(p => ({
          userId: p.userId,
          name: p.user.displayName || `${p.user.firstName} ${p.user.lastName}`,
          joinedAt: p.joinedAt,
          connectionQuality: p.connectionQuality,
          isAudioMuted: p.isAudioMuted,
          isVideoMuted: p.isVideoMuted,
          isScreenSharing: p.isScreenSharing,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting real-time analytics:', error);
    res.status(500).json({
      error: 'Failed to get real-time analytics',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/analytics/track/meeting-start
 * Track meeting start event
 */
router.post('/track/meeting-start', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required'
      });
    }

    // Verify user has permission to start this meeting
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        createdBy: req.user.id,
      }
    });

    if (!meeting) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only start meetings you created'
      });
    }

    const analyticsService = getAnalyticsService();
    await analyticsService.trackMeetingStart(meetingId, req.user.id);

    res.json({
      success: true,
      message: 'Meeting start tracked',
      meetingId,
    });
  } catch (error) {
    console.error('Error tracking meeting start:', error);
    res.status(500).json({
      error: 'Failed to track meeting start',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/analytics/track/meeting-end
 * Track meeting end event
 */
router.post('/track/meeting-end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required'
      });
    }

    // Verify user has permission to end this meeting
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        createdBy: req.user.id,
      }
    });

    if (!meeting) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only end meetings you created'
      });
    }

    const analyticsService = getAnalyticsService();
    await analyticsService.trackMeetingEnd(meetingId);

    res.json({
      success: true,
      message: 'Meeting end tracked',
      meetingId,
    });
  } catch (error) {
    console.error('Error tracking meeting end:', error);
    res.status(500).json({
      error: 'Failed to track meeting end',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/analytics/track/connection-quality
 * Track connection quality metrics
 */
router.post('/track/connection-quality', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { meetingId, quality, stats } = req.body;

    if (!meetingId || !quality) {
      return res.status(400).json({
        error: 'Meeting ID and quality are required'
      });
    }

    // Verify user is in this meeting
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        userId: req.user.id,
        meetingId,
        isPresent: true,
      }
    });

    if (!participant) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a participant in this meeting'
      });
    }

    const analyticsService = getAnalyticsService();
    await analyticsService.trackConnectionQuality(meetingId, req.user.id, quality, stats);

    res.json({
      success: true,
      message: 'Connection quality tracked',
    });
  } catch (error) {
    console.error('Error tracking connection quality:', error);
    res.status(500).json({
      error: 'Failed to track connection quality',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/insights/:clientId
 * Get AI-powered insights and recommendations
 */
router.get('/insights/:clientId', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { clientId } = req.params;
    const { days = '30' } = req.query;
    const dayCount = Math.min(parseInt(days as string), 90);

    // Verify admin has access to this client
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser || currentUser.clientId !== clientId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view insights for your own client'
      });
    }

    const analyticsService = getAnalyticsService();
    const dashboard = await analyticsService.getDashboardAnalytics(clientId, dayCount);

    // Generate additional insights
    const insights = {
      ...dashboard.insights,
      recommendations: [
        {
          category: 'engagement',
          title: 'Improve Meeting Engagement',
          description: 'Consider implementing interactive features like polls or breakout rooms',
          priority: 'medium',
          impact: 'high',
        },
        {
          category: 'performance',
          title: 'Optimize Server Performance',
          description: 'Monitor connection quality trends and consider CDN implementation',
          priority: 'low',
          impact: 'medium',
        },
        {
          category: 'user-experience',
          title: 'User Onboarding',
          description: 'Create guided tours for new users to improve adoption',
          priority: 'high',
          impact: 'high',
        },
      ],
      predictions: {
        nextWeekMeetings: Math.round(dashboard.overview.totalMeetings * 0.15), // Simple prediction
        userGrowthProjection: dashboard.overview.userGrowthRate,
        capacityRecommendation: dashboard.overview.activeMeetings > 10 ? 'scale-up' : 'current',
      },
    };

    res.json({
      success: true,
      insights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting analytics insights:', error);
    res.status(500).json({
      error: 'Failed to get analytics insights',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/analytics/performance
 * Get system performance metrics
 */
router.get('/performance', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { hours = '24' } = req.query;
    const hourCount = Math.min(parseInt(hours as string), 168); // Max 1 week

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const startTime = new Date(Date.now() - hourCount * 60 * 60 * 1000);

    // Get performance metrics
    const [
      connectionQualityStats,
      averageJoinTime,
      dropoutRates,
      systemLoad
    ] = await Promise.all([
      prisma.meetingParticipant.findMany({
        where: {
          meeting: { clientId: currentUser.clientId },
          lastPingAt: { gte: startTime },
          connectionQuality: { not: null },
        },
        select: {
          connectionQuality: true,
          lastPingAt: true,
        },
      }),
      prisma.meetingParticipant.aggregate({
        where: {
          meeting: { clientId: currentUser.clientId },
          joinedAt: { gte: startTime },
        },
        _avg: {
          duration: true,
        },
      }),
      prisma.meetingAnalytics.findMany({
        where: {
          meeting: {
            clientId: currentUser.clientId,
            createdAt: { gte: startTime },
          },
        },
        select: {
          dropoutRate: true,
          meeting: {
            select: {
              createdAt: true,
            },
          },
        },
      }),
      // System load would come from monitoring service
      { cpu: 45, memory: 60, network: 30 }, // Mock data
    ]);

    // Process connection quality distribution
    const qualityDistribution = connectionQualityStats.reduce((acc, stat) => {
      const quality = stat.connectionQuality || 'unknown';
      acc[quality] = (acc[quality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate hourly metrics
    const hourlyMetrics = [];
    for (let i = hourCount - 1; i >= 0; i--) {
      const hour = new Date(Date.now() - i * 60 * 60 * 1000);
      hour.setMinutes(0, 0, 0);
      const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);

      const hourDropouts = dropoutRates.filter(dr => 
        dr.meeting.createdAt >= hour && dr.meeting.createdAt < nextHour
      );

      const avgDropoutRate = hourDropouts.length > 0
        ? hourDropouts.reduce((sum, dr) => sum + dr.dropoutRate, 0) / hourDropouts.length
        : 0;

      hourlyMetrics.push({
        hour: hour.toISOString(),
        averageDropoutRate: Math.round(avgDropoutRate * 100) / 100,
        meetingCount: hourDropouts.length,
      });
    }

    res.json({
      success: true,
      performance: {
        connectionQuality: {
          distribution: qualityDistribution,
          totalReports: connectionQualityStats.length,
        },
        averageJoinTime: averageJoinTime._avg?.duration || 0,
        systemLoad,
        hourlyMetrics,
        summary: {
          period: `${hourCount} hours`,
          totalMeetings: dropoutRates.length,
          averageDropoutRate: dropoutRates.length > 0
            ? Math.round((dropoutRates.reduce((sum, dr) => sum + dr.dropoutRate, 0) / dropoutRates.length) * 100) / 100
            : 0,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    res.status(500).json({
      error: 'Failed to get performance analytics',
      message: 'Internal server error'
    });
  }
});

export default router;