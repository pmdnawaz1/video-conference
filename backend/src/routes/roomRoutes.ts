import { Router, Request, Response } from "express";
import { roomManagementService } from "../services/roomManagementService";
import { prisma } from "../services/prismaService";

const router = Router();

/**
 * POST /api/rooms
 * Create a new room
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, clientId, createdBy, maxParticipants, meetingId, isPrivate } =
      req.body;

    if (!name) {
      return res.status(400).json({
        error: "Room name is required",
      });
    }

    // Use default client if not provided
    let actualClientId = clientId;
    if (!actualClientId) {
      const defaultClient = await prisma.client.findFirst({
        where: { domain: "localhost" },
      });
      actualClientId = defaultClient?.id;
    }

    if (!actualClientId) {
      return res.status(400).json({
        error: "Client ID required",
        message: "No default client found. Please specify clientId.",
      });
    }

    const room = await roomManagementService.createRoom({
      name,
      clientId: actualClientId,
      createdBy,
      maxParticipants,
      meetingId,
      isPrivate,
    });

    res.status(201).json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        maxParticipants: room.maxParticipants,
        isActive: room.isActive,
        isLocked: room.isLocked,
        currentParticipants: room.currentParticipants,
        client: room.client,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({
      error: "Failed to create room",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms/:roomId/status
 * Get room status and basic information
 */
router.get("/:roomId/status", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isLocked: true,
        isRecording: true,
        screenShareUserId: true,
        maxParticipants: true,
        currentParticipants: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
        _count: {
          select: {
            participants: { where: { isPresent: true } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        message: `Room with ID ${roomId} does not exist`,
      });
    }

    res.json({
      success: true,
      roomId: room.id,
      name: room.name,
      status: room.isActive ? "active" : "inactive",
      isActive: room.isActive,
      isLocked: room.isLocked,
      isRecording: room.isRecording,
      hasScreenShare: !!room.screenShareUserId,
      maxParticipants: room.maxParticipants,
      currentParticipants: room._count.participants,
      availableSlots: room.maxParticipants - room._count.participants,
      client: room.client,
      createdAt: room.createdAt,
      lastActivity: room.updatedAt,
    });
  } catch (error) {
    console.error("Error getting room status:", error);
    res.status(500).json({
      error: "Failed to get room status",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms/:roomId/screen-share
 * Get screen sharing status for a room
 */
router.get("/:roomId/screen-share", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // Get room from database
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        screenShareUserId: true,
        isActive: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        message: `Room with ID ${roomId} does not exist`,
      });
    }

    // Get real-time screen sharing state from WebRTC signaling service
    const isScreenSharing = !!room.screenShareUserId;

    res.json({
      roomId: room.id,
      roomName: room.name,
      isScreenSharing,
      screenShareUserId: room.screenShareUserId,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting screen share status:", error);
    res.status(500).json({
      error: "Failed to get screen share status",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms/:roomId/users
 * Get users/participants in a room
 */
router.get("/:roomId/users", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { includeInactive = "false" } = req.query;

    // Get room participants from database
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        isActive: true,
        participants: {
          where: includeInactive === "true" ? {} : { isPresent: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        message: `Room with ID ${roomId} does not exist`,
      });
    }

    if (!room.isActive) {
      return res.status(404).json({
        error: "Room not active",
        message: `Room ${roomId} is no longer active`,
      });
    }

    const users = room.participants.map((p) => ({
      id: p.user.id,
      name: p.user.displayName || `${p.user.firstName} ${p.user.lastName}`,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      avatar: p.user.avatar,
      role: p.user.role,
      isModerator: p.isModerator,
      isPresent: p.isPresent,
      isAudioMuted: p.isAudioMuted,
      isVideoMuted: p.isVideoMuted,
      isScreenSharing: p.isScreenSharing,
      connectionQuality: p.connectionQuality,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
    }));

    res.json({
      success: true,
      roomId: room.id,
      roomName: room.name,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isPresent).length,
      users: users,
    });
  } catch (error) {
    console.error("Error getting room users:", error);
    res.status(500).json({
      error: "Failed to get room users",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms/:roomId
 * Get room details
 */
router.get("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await roomManagementService.getRoomDetails(roomId);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        message: `Room with ID ${roomId} does not exist`,
      });
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        isLocked: room.isLocked,
        isRecording: room.isRecording,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants,
        screenShareUserId: room.screenShareUserId,
        client: room.client,
        meeting: room.meeting,
        participants: room.participants.map((p) => ({
          id: p.user.id,
          name: p.user.displayName || `${p.user.firstName} ${p.user.lastName}`,
          isModerator: p.isModerator,
          joinedAt: p.joinedAt,
          isAudioMuted: p.isAudioMuted,
          isVideoMuted: p.isVideoMuted,
          isScreenSharing: p.isScreenSharing,
          connectionQuality: p.connectionQuality,
        })),
        metrics: room.metrics,
        recentMessages: room.chatMessages.slice(-10), // Last 10 messages
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting room details:", error);
    res.status(500).json({
      error: "Failed to get room details",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * PUT /api/rooms/:roomId
 * Update room settings
 */
router.put("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { isLocked, maxParticipants } = req.body;

    const room = await roomManagementService.updateRoomSettings(roomId, {
      isLocked,
      maxParticipants,
    });

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        isLocked: room.isLocked,
        maxParticipants: room.maxParticipants,
        currentParticipants: room.currentParticipants,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({
      error: "Failed to update room",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /api/rooms/:roomId/join
 * Add user to room
 */
router.post("/:roomId/join", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { userId, meetingId, isModerator } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const participant = await roomManagementService.addUserToRoom({
      userId,
      roomId,
      meetingId,
      isModerator,
    });

    res.json({
      success: true,
      participant: {
        userId: participant.userId,
        roomId: participant.roomId,
        isModerator: participant.isModerator,
        joinedAt: participant.joinedAt,
        user: participant.user,
      },
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({
      error: "Failed to join room",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /api/rooms/:roomId/leave
 * Remove user from room
 */
router.post("/:roomId/leave", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const success = await roomManagementService.removeUserFromRoom(
      userId,
      roomId,
    );

    res.json({
      success,
      message: success ? "User left room successfully" : "User was not in room",
    });
  } catch (error) {
    console.error("Error leaving room:", error);
    res.status(500).json({
      error: "Failed to leave room",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /api/rooms/:roomId/end
 * End/close room
 */
router.post("/:roomId/end", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { endedBy } = req.body;

    const room = await roomManagementService.endRoom(roomId, endedBy);

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        currentParticipants: room.currentParticipants,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error ending room:", error);
    res.status(500).json({
      error: "Failed to end room",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms/stats
 * Get room statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;

    const stats = await roomManagementService.getRoomStats(clientId as string);
    const activity = await roomManagementService.getRecentActivity(
      clientId as string,
      5,
    );

    res.json({
      success: true,
      stats,
      recentActivity: activity,
    });
  } catch (error) {
    console.error("Error getting room stats:", error);
    res.status(500).json({
      error: "Failed to get room statistics",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /api/rooms
 * List rooms with pagination and filtering
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { clientId, isActive, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (clientId) whereClause.clientId = clientId;
    if (isActive !== undefined) whereClause.isActive = isActive === "true";

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where: whereClause,
        include: {
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
          meeting: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          _count: {
            select: {
              participants: { where: { isPresent: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.room.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        isLocked: room.isLocked,
        isRecording: room.isRecording,
        maxParticipants: room.maxParticipants,
        currentParticipants: room._count.participants,
        hasScreenShare: !!room.screenShareUserId,
        client: room.client,
        meeting: room.meeting,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error listing rooms:", error);
    res.status(500).json({
      error: "Failed to list rooms",
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;
