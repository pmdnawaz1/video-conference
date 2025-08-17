import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authService } from '../services/authService';
import { 
  authenticate, 
  authorize, 
  rateLimit, 
  handleCorsAuth, 
  logAuthenticatedRequests 
} from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply middleware to all auth routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);

// Rate limiting for auth endpoints (stricter limits)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later'
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
});

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authRateLimit, async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      displayName,
      clientId,
      clientDomain,
      role
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, firstName, and lastName are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Role validation (only allow admins to set roles other than USER)
    if (role && role !== UserRole.USER) {
      return res.status(403).json({
        error: 'Invalid role',
        message: 'Only administrators can assign special roles'
      });
    }

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      displayName,
      clientId,
      clientDomain,
      role: role || UserRole.USER
    });

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken: result.accessToken,
      user: result.user,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password, clientId, clientDomain } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    const result = await authService.login({
      email,
      password,
      clientId,
      clientDomain,
    });

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Invalid credentials'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', generalRateLimit, async (req: Request, res: Response) => {
  try {
    // Try to get refresh token from cookie first, then body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
    }

    const result = await authService.refreshToken(refreshToken);

    // Update HTTP-only cookie with new refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      accessToken: result.accessToken,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear refresh token cookie on error
    res.clearCookie('refreshToken');
    
    res.status(401).json({
      error: 'Token refresh failed',
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and invalidate tokens
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      await authService.logout(req.user.id);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Failed to logout user'
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'User not found in request'
      });
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
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
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
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /auth/password
 * Update user password
 */
router.put('/password', authenticate, authRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Both current and new passwords are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'New password must be at least 8 characters long'
      });
    }

    await authService.updatePassword(req.user.id, currentPassword, newPassword);

    // Clear refresh token cookie to force re-login
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Password updated successfully. Please log in again.'
    });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(400).json({
      error: 'Password update failed',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /auth/verify
 * Verify token validity (for client-side token validation)
 */
router.get('/verify', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    valid: true,
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      clientId: req.user!.clientId,
    }
  });
});

/**
 * GET /auth/permissions
 * Get user permissions and role information
 */
router.get('/permissions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Define permissions based on role
    const permissions = {
      [UserRole.GUEST]: [
        'room.join',
        'chat.send',
        'media.toggle'
      ],
      [UserRole.USER]: [
        'room.create',
        'room.join',
        'room.invite',
        'chat.send',
        'media.toggle',
        'screen.share',
        'profile.update'
      ],
      [UserRole.ADMIN]: [
        'room.create',
        'room.join',
        'room.manage',
        'room.invite',
        'room.moderate',
        'chat.send',
        'chat.moderate',
        'media.toggle',
        'screen.share',
        'recording.start',
        'recording.stop',
        'profile.update',
        'user.invite',
        'analytics.view'
      ],
      [UserRole.SUPER_ADMIN]: [
        'room.create',
        'room.join',
        'room.manage',
        'room.invite',
        'room.moderate',
        'chat.send',
        'chat.moderate',
        'media.toggle',
        'screen.share',
        'recording.start',
        'recording.stop',
        'profile.update',
        'user.invite',
        'user.manage',
        'client.manage',
        'analytics.view',
        'system.admin'
      ]
    };

    res.json({
      success: true,
      role: user.role,
      permissions: permissions[user.role] || [],
      clientFeatures: user.client.features || {},
    });

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      error: 'Failed to get permissions',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /auth/admin/create-user
 * Admin endpoint to create users with specific roles
 */
router.post('/admin/create-user', 
  authenticate, 
  authorize(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        displayName,
        role,
        clientId
      } = req.body;

      // Validation
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      // Only super admins can create super admins
      if (role === UserRole.SUPER_ADMIN && req.user!.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only super admins can create super admin accounts'
        });
      }

      // Use requesting user's client if not specified and not super admin
      const targetClientId = clientId || 
        (req.user!.role === UserRole.SUPER_ADMIN ? undefined : req.user!.clientId);

      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        displayName,
        clientId: targetClientId,
        role: role || UserRole.USER
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: result.user
      });

    } catch (error) {
      console.error('Admin create user error:', error);
      res.status(400).json({
        error: 'User creation failed',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
);

export default router;