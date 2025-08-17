import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authService } from '../services/authService';
import { meetingManagementService } from '../services/meetingManagementService';
import { prisma } from '../services/prismaService';
import { 
  authenticate, 
  authorize,
  authorizeOwnership,
  rateLimit,
  handleCorsAuth,
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware to all user routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);

// Rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
});

/**
 * GET /api/users/me
 * Get current user profile (alias for /auth/me)
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await authService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account may have been deleted'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      firstName,
      lastName,
      displayName,
      avatar,
      timezone,
      locale,
      preferences
    } = req.body;

    const updatedUser = await authService.updateProfile(req.user.id, {
      firstName,
      lastName,
      displayName,
      avatar,
      timezone,
      locale,
      preferences
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user profile by ID (public info only unless same user or admin)
 */
router.get('/:userId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const isOwnProfile = req.user.id === userId;
    const isAdmin = req.user.role && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        ...(isOwnProfile || isAdmin ? {
          role: true,
          email: true,
          isEmailVerified: true,
          timezone: true,
          locale: true,
          preferences: true,
          lastLoginAt: true,
        } : {}),
        createdAt: true,
        ...(isAdmin ? {
          client: {
            select: {
              id: true,
              name: true,
              domain: true,
            }
          }
        } : {}),
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if same client for non-admins
    if (!isOwnProfile && !isAdmin) {
      const requestingUser = await authService.getUserById(req.user.id);
      const targetUser = await authService.getUserById(userId);
      
      if (requestingUser?.clientId !== targetUser?.clientId) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view users from your organization'
        });
      }
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/:userId/meetings
 * Get user's meetings
 */
router.get('/:userId/meetings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const {
      status,
      timeRange,
      limit = '20',
      offset = '0'
    } = req.query;

    // Check if user can access this data
    const isOwnData = req.user.id === userId;
    const isAdmin = req.user.role && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isOwnData && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own meetings'
      });
    }

    const filters = {
      status: status as any,
      timeRange: timeRange as any,
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
    };

    const result = await meetingManagementService.getUserMeetings(userId, filters);

    res.json({
      success: true,
      meetings: result.meetings.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        meetingType: meeting.meetingType,
        status: meeting.status,
        scheduledStartTime: meeting.scheduledStartTime,
        scheduledEndTime: meeting.scheduledEndTime,
        maxParticipants: meeting.maxParticipants,
        participantCount: meeting._count.participants,
        creator: meeting.creator,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      })),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting user meetings:', error);
    res.status(500).json({
      error: 'Failed to get user meetings',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/:userId/analytics
 * Get user analytics
 */
router.get('/:userId/analytics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const { period = 'monthly', limit = '12' } = req.query;

    // Check if user can access this data
    const isOwnData = req.user.id === userId;
    const isAdmin = req.user.role && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isOwnData && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own analytics'
      });
    }

    const analytics = await prisma.userAnalytics.findMany({
      where: {
        userId,
        period: period as string,
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit as string),
    });

    // Calculate summary statistics
    const totalMeetings = analytics.reduce((sum, a) => sum + a.meetingsCreated + a.meetingsJoined, 0);
    const totalDuration = analytics.reduce((sum, a) => sum + a.totalMeetingDuration, 0);
    const totalMessages = analytics.reduce((sum, a) => sum + a.messagesSet, 0);

    res.json({
      success: true,
      analytics: {
        data: analytics,
        summary: {
          totalMeetings,
          totalDuration,
          totalMessages,
          averageMeetingDuration: totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0,
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
 * GET /api/users/search
 * Search users within the same organization
 */
router.get('/search', authenticate, generalRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { q, limit = '20', offset = '0' } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchQuery = q.trim();
    const limitNum = Math.min(parseInt(limit as string), 50);
    const offsetNum = parseInt(offset as string);

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          clientId: currentUser.clientId,
          isActive: true,
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
            { displayName: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          role: true,
          email: true,
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.user.count({
        where: {
          clientId: currentUser.clientId,
          isActive: true,
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
            { displayName: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      error: 'Failed to search users',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/users
 * List users in the same organization (admin only)
 */
router.get('/', authenticate, authorize(UserRole.ADMIN), generalRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { 
      role,
      isActive = 'true',
      limit = '20',
      offset = '0'
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string), 100);
    const offsetNum = parseInt(offset as string);

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const whereClause: any = {
      clientId: currentUser.clientId,
    };

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== 'all') {
      whereClause.isActive = isActive === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          role: true,
          email: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: [
          { role: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      }
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({
      error: 'Failed to list users',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/:userId/role
 * Update user role (admin only)
 */
router.put('/:userId/role', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: `Role must be one of: ${Object.values(UserRole).join(', ')}`
      });
    }

    // Only super admins can create other super admins
    if (role === UserRole.SUPER_ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only super admins can assign super admin role'
      });
    }

    // Users cannot change their own role
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot change own role',
        message: 'You cannot change your own role'
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        email: true,
      }
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(500).json({
      error: 'Failed to update user role',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/:userId/status
 * Activate/deactivate user (admin only)
 */
router.put('/:userId/status', authenticate, authorize(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'isActive must be a boolean value'
      });
    }

    // Users cannot deactivate themselves
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({
        error: 'Cannot deactivate own account',
        message: 'You cannot deactivate your own account'
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        isActive,
        // Increment token version to invalidate all sessions if deactivating
        tokenVersion: isActive ? undefined : { increment: 1 }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        isActive: true,
        email: true,
      }
    });

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(500).json({
      error: 'Failed to update user status',
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/users/:userId
 * Delete user (super admin only)
 */
router.delete('/:userId', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;

    // Users cannot delete themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot delete own account',
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists and get their info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (CASCADE will handle related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({
      success: true,
      message: `User ${user.firstName} ${user.lastName} (${user.email}) deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'Internal server error'
    });
  }
});

export default router;