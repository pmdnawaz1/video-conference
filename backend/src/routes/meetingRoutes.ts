import { Router, Request, Response } from "express";
import { MeetingType, UserRole } from "@prisma/client";
import { meetingManagementService } from "../services/meetingManagementService";
import {
  authenticate,
  authorize,
  authorizeClient,
  handleCorsAuth,
  logAuthenticatedRequests,
} from "../middleware/authMiddleware";
import { AuthenticatedRequest } from "../types";

const router = Router();

// Apply middleware to all meeting routes
router.use(handleCorsAuth);
router.use(logAuthenticatedRequests);

/**
 * POST /api/meetings
 * Create a new meeting
 */
router.post(
  "/",
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const {
        title,
        description,
        meetingType = "INSTANT",
        scheduledStartTime,
        scheduledEndTime,
        maxParticipants,
        isRecordingEnabled,
        isWaitingRoomEnabled,
        requiresApproval,
        allowScreenShare,
        allowChat,
        isPublic,
        meetingPassword,
        recurrencePattern,
        clientId,
      } = req.body;

      // Validation
      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          error: "Meeting title is required",
        });
      }

      if (meetingType === "SCHEDULED" && !scheduledStartTime) {
        return res.status(400).json({
          error: "Scheduled start time is required for scheduled meetings",
        });
      }

      if (
        scheduledStartTime &&
        scheduledEndTime &&
        new Date(scheduledEndTime) <= new Date(scheduledStartTime)
      ) {
        return res.status(400).json({
          error: "End time must be after start time",
        });
      }

      // Use user's client if not specified
      const actualClientId = clientId || req.user.clientId;

      const meeting = await meetingManagementService.createMeeting({
        title: title.trim(),
        description: description?.trim(),
        meetingType: meetingType as MeetingType,
        createdBy: req.user.id,
        clientId: actualClientId,
        scheduledStartTime: scheduledStartTime
          ? new Date(scheduledStartTime)
          : undefined,
        scheduledEndTime: scheduledEndTime
          ? new Date(scheduledEndTime)
          : undefined,
        maxParticipants,
        isRecordingEnabled,
        isWaitingRoomEnabled,
        requiresApproval,
        allowScreenShare,
        allowChat,
        isPublic,
        meetingPassword,
        recurrencePattern,
      });

      res.status(201).json({
        success: true,
        message: "Meeting created successfully",
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          meetingType: meeting.meetingType,
          status: meeting.status,
          scheduledStartTime: meeting.scheduledStartTime,
          scheduledEndTime: meeting.scheduledEndTime,
          maxParticipants: meeting.maxParticipants,
          isRecordingEnabled: meeting.isRecordingEnabled,
          allowScreenShare: meeting.allowScreenShare,
          allowChat: meeting.allowChat,
          isPublic: meeting.isPublic,
          roomId: meeting.roomId,
          creator: meeting.creator,
          client: meeting.client,
          createdAt: meeting.createdAt,
        },
      });
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(400).json({
        error: "Failed to create meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * GET /api/meetings/:meetingId
 * Get meeting details
 */
router.get(
  "/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const meeting = await meetingManagementService.getMeetingDetails(
        meetingId,
        req.user.id,
      );

      if (!meeting) {
        return res.status(404).json({
          error: "Meeting not found",
        });
      }

      res.json({
        success: true,
        meeting,
      });
    } catch (error) {
      console.error("Error getting meeting details:", error);

      if (error instanceof Error && error.message.includes("Access denied")) {
        return res.status(403).json({
          error: "Access denied",
          message: "You do not have permission to access this meeting",
        });
      }

      res.status(500).json({
        error: "Failed to get meeting details",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * PUT /api/meetings/:meetingId
 * Update meeting details
 */
router.put(
  "/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.id;
      delete updates.createdBy;
      delete updates.clientId;
      delete updates.createdAt;
      delete updates.updatedAt;

      const meeting = await meetingManagementService.updateMeeting(
        meetingId,
        updates,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Meeting updated successfully",
        meeting,
      });
    } catch (error) {
      console.error("Error updating meeting:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (error instanceof Error && error.message.includes("permissions")) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: error.message,
        });
      }

      res.status(400).json({
        error: "Failed to update meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/:meetingId/start
 * Start a meeting
 */
router.post(
  "/:meetingId/start",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const result = await meetingManagementService.startMeeting(
        meetingId,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Meeting started successfully",
        meeting: result.meeting,
        room: result.room,
      });
    } catch (error) {
      console.error("Error starting meeting:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (error instanceof Error && error.message.includes("already")) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: "Failed to start meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/:meetingId/end
 * End a meeting
 */
router.post(
  "/:meetingId/end",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const meeting = await meetingManagementService.endMeeting(
        meetingId,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Meeting ended successfully",
        meeting,
      });
    } catch (error) {
      console.error("Error ending meeting:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      res.status(500).json({
        error: "Failed to end meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/:meetingId/participants
 * Add participant to meeting
 */
router.post(
  "/:meetingId/participants",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;
      const { userId, isModerator, canShare, canChat } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: "User ID is required",
        });
      }

      const participant = await meetingManagementService.addParticipant({
        userId,
        meetingId,
        isModerator,
        canShare,
        canChat,
      });

      res.status(201).json({
        success: true,
        message: "Participant added successfully",
        participant,
      });
    } catch (error) {
      console.error("Error adding participant:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (error instanceof Error && error.message.includes("full")) {
        return res.status(400).json({ error: "Meeting is full" });
      }

      res.status(500).json({
        error: "Failed to add participant",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * DELETE /api/meetings/:meetingId/participants/:userId
 * Remove participant from meeting
 */
router.delete(
  "/:meetingId/participants/:userId",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId, userId } = req.params;

      const removed = await meetingManagementService.removeParticipant(
        userId,
        meetingId,
        req.user.id,
      );

      if (!removed) {
        return res.status(404).json({
          error: "Participant not found in meeting",
        });
      }

      res.json({
        success: true,
        message: "Participant removed successfully",
      });
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({
        error: "Failed to remove participant",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/:meetingId/participants/:userId/approve
 * Approve participant for meetings requiring approval
 */
router.post(
  "/:meetingId/participants/:userId/approve",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId, userId } = req.params;

      const participant = await meetingManagementService.approveParticipant(
        userId,
        meetingId,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Participant approved successfully",
        participant,
      });
    } catch (error) {
      console.error("Error approving participant:", error);
      res.status(500).json({
        error: "Failed to approve participant",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * GET /api/meetings
 * Get user's meetings with optional filtering
 */
router.get(
  "/",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, timeRange, limit = "20", offset = "0" } = req.query;

      const filters = {
        status: status as any,
        timeRange: timeRange as any,
        limit: Math.min(parseInt(limit as string), 100), // Max 100
        offset: parseInt(offset as string),
      };

      const result = await meetingManagementService.getUserMeetings(
        req.user.id,
        filters,
      );

      res.json({
        success: true,
        meetings: result.meetings.map((meeting) => ({
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
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error getting user meetings:", error);
      res.status(500).json({
        error: "Failed to get meetings",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * GET /api/meetings/:meetingId/analytics
 * Get meeting analytics
 */
router.get(
  "/:meetingId/analytics",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      // Check if user has access to this meeting
      const hasAccess = await meetingManagementService.checkMeetingAccess(
        meetingId,
        req.user.id,
      );
      if (!hasAccess) {
        return res.status(403).json({
          error: "Access denied",
          message:
            "You do not have permission to view analytics for this meeting",
        });
      }

      const analytics =
        await meetingManagementService.calculateMeetingAnalytics(meetingId);

      res.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error("Error getting meeting analytics:", error);
      res.status(500).json({
        error: "Failed to get meeting analytics",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * GET /api/meetings/:meetingId/access
 * Check if user has access to meeting
 */
router.get(
  "/:meetingId/access",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const hasAccess = await meetingManagementService.checkMeetingAccess(
        meetingId,
        req.user.id,
      );

      res.json({
        success: true,
        hasAccess,
      });
    } catch (error) {
      console.error("Error checking meeting access:", error);
      res.status(500).json({
        error: "Failed to check meeting access",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/join/:meetingId
 * Join a meeting (add current user as participant)
 */
router.post(
  "/join/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const participant = await meetingManagementService.addParticipant({
        userId: req.user.id,
        meetingId,
        isModerator: false,
      });

      res.json({
        success: true,
        message: "Successfully joined meeting",
        participant,
      });
    } catch (error) {
      console.error("Error joining meeting:", error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (error instanceof Error && error.message.includes("full")) {
        return res.status(400).json({ error: "Meeting is full" });
      }

      if (error instanceof Error && error.message.includes("ended")) {
        return res.status(400).json({ error: "Meeting has ended" });
      }

      res.status(500).json({
        error: "Failed to join meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

/**
 * POST /api/meetings/leave/:meetingId
 * Leave a meeting (remove current user as participant)
 */
router.post(
  "/leave/:meetingId",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId } = req.params;

      const removed = await meetingManagementService.removeParticipant(
        req.user.id,
        meetingId,
        req.user.id,
      );

      res.json({
        success: true,
        message: removed
          ? "Successfully left meeting"
          : "You were not in this meeting",
      });
    } catch (error) {
      console.error("Error leaving meeting:", error);
      res.status(500).json({
        error: "Failed to leave meeting",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

export default router;
