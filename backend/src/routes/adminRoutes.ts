import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../services/prismaService';
import { authService } from '../services/authService';
import { roomManagementService } from '../services/roomManagementService';
import { adminDashboardService } from '../services/adminDashboardService';
import { 
  authenticate, 
  authorize,
  rateLimit,
  handleCorsAuth,
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware to all admin routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);
router.use(authenticate);
router.use(authorize(UserRole.ADMIN)); // All admin routes require admin role

// Rate limiting for admin operations
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // 200 requests per window for admins
  message: 'Too many admin requests, please try again later'
});

router.use(adminRateLimit);

/**
 * GET /api/admin/dashboard
 * Get admin dashboard overview
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get current user's client ID
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const clientId = currentUser.clientId;

    // Get dashboard statistics using admin dashboard service
    const dashboardStats = await adminDashboardService.getDashboardStats(clientId);

    res.json({
      success: true,
      dashboard: dashboardStats,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/users
 * Get users with admin controls and pagination
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const clientId = currentUser.clientId;
    
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const search = req.query.search as string;
    const role = req.query.role as UserRole;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const userManagement = await adminDashboardService.getUsersManagement(clientId, {
      page,
      limit,
      search,
      role,
      isActive,
      sortBy: sortBy as any,
      sortOrder,
    });

    res.json({
      success: true,
      ...userManagement,
    });

  } catch (error) {
    console.error('Error getting admin users:', error);
    res.status(500).json({
      error: 'Failed to get users',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new user (admin operation)
 */
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { email, firstName, lastName, displayName, role, clientId } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email, firstName, lastName, and role are required'
      });
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: `Role must be one of: ${Object.values(UserRole).join(', ')}`
      });
    }

    const result = await adminDashboardService.createUser(currentUser.clientId, {
      email,
      firstName,
      lastName,
      displayName,
      role,
      clientId,
    });

    res.status(201).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User already exists',
          message: error.message
        });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Resource not found',
          message: error.message
        });
      }
    }

    res.status(500).json({
      error: 'Failed to create user',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update user details and status
 */
router.put('/users/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { userId } = req.params;
    const { role, isActive, firstName, lastName, displayName } = req.body;

    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (displayName !== undefined) updates.displayName = displayName;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided',
        message: 'At least one field must be provided for update'
      });
    }

    const updatedUser = await adminDashboardService.updateUser(userId, currentUser.clientId, updates);

    res.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'User not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to update user',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/meetings
 * Get meetings with admin analytics
 */
router.get('/meetings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const clientId = currentUser.clientId;
    
    // Parse date range if provided
    let dateRange: { start: Date; end: Date } | undefined;
    if (req.query.startDate && req.query.endDate) {
      dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string),
      };
    }

    const analytics = await adminDashboardService.getMeetingAnalytics(clientId, dateRange);

    res.json({
      success: true,
      analytics,
      dateRange,
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
 * GET /api/admin/system/health
 * Get detailed system health information
 */
router.get('/system/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const systemHealth = await adminDashboardService.getSystemHealth();

    res.json({
      success: true,
      health: systemHealth,
    });

  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({
      error: 'Failed to get system health',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users/:userId/impersonate
 * Impersonate user (super admin only)
 */
router.post('/users/:userId/impersonate', authorize(UserRole.SUPER_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;

    const tokens = await adminDashboardService.impersonateUser(userId, req.user.id);

    res.json({
      success: true,
      message: `Impersonating user ${userId}`,
      ...tokens,
      impersonatedBy: req.user.id,
      impersonatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error during impersonation:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'User not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to impersonate user',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/system/maintenance
 * Perform system maintenance operations (super admin only)
 */
router.post('/system/maintenance', authorize(UserRole.SUPER_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({
        error: 'Missing operation',
        message: 'operation field is required'
      });
    }

    let result: any = {};

    switch (operation) {
      case 'cleanup_old_rooms':
        // Clean up old inactive rooms
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const deletedRooms = await prisma.room.deleteMany({
          where: {
            isActive: false,
            updatedAt: { lt: cutoffDate }
          }
        });
        result = { deletedRooms: deletedRooms.count };
        break;

      case 'cleanup_old_meetings':
        // Clean up old ended meetings
        const meetingCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const deletedMeetings = await prisma.meeting.deleteMany({
          where: {
            status: 'ENDED',
            endTime: { lt: meetingCutoff }
          }
        });
        result = { deletedMeetings: deletedMeetings.count };
        break;

      case 'reset_user_sessions':
        // Increment token version for all users to invalidate sessions
        const updatedUsers = await prisma.user.updateMany({
          data: {
            tokenVersion: { increment: 1 }
          }
        });
        result = { affectedUsers: updatedUsers.count };
        break;

      default:
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Supported operations: cleanup_old_rooms, cleanup_old_meetings, reset_user_sessions'
        });
    }

    console.log(`🔧 System maintenance performed: ${operation} by admin ${req.user.id}`, result);

    res.json({
      success: true,
      operation,
      result,
      performedBy: req.user.id,
      performedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error during system maintenance:', error);
    res.status(500).json({
      error: 'Failed to perform maintenance',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/rooms
 * Get room statistics and management
 */
router.get('/rooms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const clientId = currentUser.clientId;
    
    // Get room statistics
    const roomStats = await roomManagementService.getRoomStats(clientId);

    // Get detailed room list
    const rooms = await prisma.room.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        meeting: true,
        _count: {
          select: {
            participants: true
          }
        }
      }
    });

    res.json({
      success: true,
      stats: roomStats,
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants,
        participantsCount: room._count.participants,
        meetingId: room.meeting?.id || null,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      })),
    });

  } catch (error) {
    console.error('Error getting room data:', error);
    res.status(500).json({
      error: 'Failed to get room data',
      message: 'Internal server error'
    });
  }
});

export default router;