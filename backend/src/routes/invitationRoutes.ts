import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { invitationService } from '../services/invitationService';
import { InvitationType, UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

/**
 * @route POST /api/invitations
 * @desc Create a new invitation
 * @access Private (Admin/User)
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const {
      email,
      firstName,
      lastName,
      invitationType = InvitationType.USER,
      role = UserRole.USER,
      customMessage,
      meetingId,
      meetingRole,
      groupId,
      groupRole,
      expirationHours
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const invitation = await invitationService.createInvitation({
      email,
      firstName,
      lastName,
      invitationType,
      role,
      customMessage,
      senderId: req.user.id,
      clientId: req.user.clientId,
      meetingId,
      meetingRole,
      groupId,
      groupRole,
      expirationHours,
    });

    // Send invitation email automatically
    try {
      await invitationService.sendInvitationEmail(invitation.id);
    } catch (emailError) {
      console.warn('Failed to send invitation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        invitationType: invitation.invitationType,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        sender: invitation.sender,
        client: invitation.client,
        meeting: invitation.meeting,
        group: invitation.group,
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create invitation' 
    });
  }
});

/**
 * @route POST /api/invitations/bulk
 * @desc Create bulk invitations
 * @access Private (Admin)
 */
router.post('/bulk', authenticate, adminMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const {
      invitations,
      invitationType = InvitationType.BULK,
      groupId,
      meetingId,
      expirationHours
    } = req.body;

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({ error: 'Invitations array is required and must not be empty' });
    }

    if (invitations.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 invitations per bulk request' });
    }

    const result = await invitationService.createBulkInvitations({
      invitations,
      invitationType,
      senderId: req.user.id,
      clientId: req.user.clientId,
      groupId,
      meetingId,
      expirationHours,
    });

    // Send invitation emails for successful invitations
    for (const invitation of result.invitations) {
      try {
        await invitationService.sendInvitationEmail(invitation.id);
      } catch (emailError) {
        console.warn(`Failed to send invitation email to ${invitation.email}:`, emailError);
      }
    }

    res.status(201).json({
      success: true,
      result: {
        created: result.created,
        failed: result.failed,
        batchId: result.batchId,
        totalInvitations: result.invitations.length,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Error creating bulk invitations:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create bulk invitations' 
    });
  }
});

/**
 * @route GET /api/invitations
 * @desc Get invitations with pagination and filtering
 * @access Private (Admin)
 */
router.get('/', authenticate, adminMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const {
      page = 1,
      limit = 50,
      status,
      invitationType,
      senderId,
      search,
      startDate,
      endDate,
    } = req.query;

    const options: any = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100), // Max 100 per page
    };

    if (status) options.status = status;
    if (invitationType) options.invitationType = invitationType;
    if (senderId) options.senderId = senderId as string;
    if (search) options.search = search as string;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const result = await invitationService.getInvitations(req.user.clientId, options);

    res.json({
      success: true,
      invitations: result.invitations,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch invitations' 
    });
  }
});

/**
 * @route GET /api/invitations/stats
 * @desc Get invitation statistics
 * @access Private (Admin)
 */
router.get('/stats', authenticate, adminMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { startDate, endDate } = req.query;
    
    const options: { startDate?: Date; endDate?: Date } = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const stats = await invitationService.getInvitationStats(
      req.user.clientId,
      options.startDate,
      options.endDate
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching invitation stats:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch invitation stats' 
    });
  }
});

/**
 * @route GET /api/invitations/token/:token
 * @desc Get invitation details by token (for accept page)
 * @access Public
 */
router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const invitation = await invitationService.getInvitationByToken(token);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found or expired' });
    }

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        invitationType: invitation.invitationType,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        isExpired: invitation.isExpired,
        isProcessed: invitation.isProcessed,
        daysUntilExpiration: invitation.daysUntilExpiration,
        sender: invitation.sender,
        client: invitation.client,
        meeting: invitation.meeting,
        group: invitation.group,
      },
    });
  } catch (error) {
    console.error('Error fetching invitation by token:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch invitation' 
    });
  }
});

/**
 * @route POST /api/invitations/accept
 * @desc Accept invitation and create user account
 * @access Public
 */
router.post('/accept', async (req, res) => {
  try {
    const { token, userData } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!userData || !userData.firstName || !userData.lastName || !userData.password) {
      return res.status(400).json({ 
        error: 'User data (firstName, lastName, password) is required' 
      });
    }

    const result = await invitationService.acceptInvitation({
      token,
      userData,
    });

    res.status(201).json({
      success: true,
      message: 'Invitation accepted successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        displayName: result.user.displayName,
        role: result.user.role,
        clientId: result.user.clientId,
      },
      tokens: result.tokens,
      invitation: result.invitation,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to accept invitation' 
    });
  }
});

/**
 * @route POST /api/invitations/decline
 * @desc Decline invitation
 * @access Public
 */
router.post('/decline', async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const success = await invitationService.declineInvitation(token, reason);

    res.json({
      success,
      message: 'Invitation declined successfully',
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to decline invitation' 
    });
  }
});

/**
 * @route POST /api/invitations/:id/resend
 * @desc Resend invitation email
 * @access Private (Admin or Sender)
 */
router.post('/:id/resend', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { id } = req.params;

    // TODO: Add check to ensure user can resend this invitation
    // (either admin or sender)

    const success = await invitationService.resendInvitation(id);

    res.json({
      success,
      message: success ? 'Invitation resent successfully' : 'Failed to resend invitation',
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to resend invitation' 
    });
  }
});

/**
 * @route DELETE /api/invitations/:id
 * @desc Cancel invitation
 * @access Private (Admin or Sender)
 */
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { id } = req.params;

    // TODO: Add check to ensure user can cancel this invitation
    // (either admin or sender)

    const success = await invitationService.cancelInvitation(id);

    res.json({
      success,
      message: success ? 'Invitation cancelled successfully' : 'Failed to cancel invitation',
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to cancel invitation' 
    });
  }
});

/**
 * @route POST /api/invitations/cleanup
 * @desc Clean up expired invitations
 * @access Private (Admin)
 */
router.post('/cleanup', authenticate, adminMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const count = await invitationService.cleanupExpiredInvitations();

    res.json({
      success: true,
      message: `Cleaned up ${count} expired invitations`,
      expiredCount: count,
    });
  } catch (error) {
    console.error('Error cleaning up expired invitations:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to cleanup expired invitations' 
    });
  }
});

export default router;