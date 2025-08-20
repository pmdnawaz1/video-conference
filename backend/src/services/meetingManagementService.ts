import { prisma } from "./prismaService";
import { roomManagementService } from "./roomManagementService";
import { EventEmitter } from "events";
import { MeetingStatus, MeetingType, UserRole } from "@prisma/client";

export interface CreateMeetingData {
  title: string;
  description?: string;
  meetingType: MeetingType;
  createdBy: string;
  clientId: string;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  maxParticipants?: number;
  isRecordingEnabled?: boolean;
  isWaitingRoomEnabled?: boolean;
  requiresApproval?: boolean;
  allowScreenShare?: boolean;
  allowChat?: boolean;
  isPublic?: boolean;
  meetingPassword?: string;
  recurrencePattern?: any;
  parentMeetingId?: string;
}

export interface MeetingParticipantData {
  userId: string;
  meetingId: string;
  isModerator?: boolean;
  canShare?: boolean;
  canChat?: boolean;
}

export interface MeetingAnalytics {
  totalDuration: number;
  participantCount: number;
  maxConcurrentParticipants: number;
  messageCount: number;
  recordingDuration?: number;
  averageParticipationTime: number;
}

/**
 * Meeting Management Service
 * Handles complete meeting lifecycle, scheduling, and participant management
 */
export class MeetingManagementService extends EventEmitter {
  private meetingTimers: Map<string, NodeJS.Timeout> = new Map();
  private reminderTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializePeriodicTasks();
  }

  /**
   * Create a new meeting
   */
  async createMeeting(data: CreateMeetingData) {
    try {
      // Validate meeting data
      this.validateMeetingData(data);

      const meeting = await prisma.meeting.create({
        data: {
          title: data.title,
          description: data.description,
          meetingType: data.meetingType,
          status: data.meetingType === "INSTANT" ? "ACTIVE" : "SCHEDULED",
          createdBy: data.createdBy,
          clientId: data.clientId,
          scheduledStartTime: data.scheduledStartTime,
          scheduledEndTime: data.scheduledEndTime,
          maxParticipants: data.maxParticipants || 50,
          isRecordingEnabled: data.isRecordingEnabled || false,
          isWaitingRoomEnabled: data.isWaitingRoomEnabled || false,
          requiresApproval: data.requiresApproval || false,
          allowScreenShare: data.allowScreenShare !== false,
          allowChat: data.allowChat !== false,
          isPublic: data.isPublic || false,
          meetingPassword: data.meetingPassword,
          recurrencePattern: data.recurrencePattern,
          parentMeetingId: data.parentMeetingId,
          actualStartTime: data.meetingType === "INSTANT" ? new Date() : null,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
            },
          },
          client: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
      });

      // Create room for instant meetings
      if (data.meetingType === "INSTANT") {
        const room = await roomManagementService.createRoom({
          name: meeting.title,
          clientId: meeting.clientId,
          createdBy: meeting.createdBy,
          maxParticipants: meeting.maxParticipants,
          meetingId: meeting.id,
        });

        // Link room to meeting
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { roomId: room.id },
        });
      }

      // Schedule meeting start/end if it's a scheduled meeting
      if (data.meetingType === "SCHEDULED" && data.scheduledStartTime) {
        this.scheduleMeetingStart(meeting.id, data.scheduledStartTime);

        if (data.scheduledEndTime) {
          this.scheduleMeetingEnd(meeting.id, data.scheduledEndTime);
        }

        // Schedule reminder 5 minutes before
        const reminderTime = new Date(
          data.scheduledStartTime.getTime() - 5 * 60 * 1000,
        );
        if (reminderTime > new Date()) {
          this.scheduleReminder(meeting.id, reminderTime);
        }
      }

      // Generate recurring meetings if pattern provided
      if (data.recurrencePattern && data.scheduledStartTime) {
        await this.generateRecurringMeetings(meeting.id, data);
      }

      this.emit("meetingCreated", { meeting });

      console.log(
        `📅 Meeting created: ${meeting.title} (${meeting.id}) by ${meeting.creator.displayName}`,
      );
      return meeting;
    } catch (error) {
      console.error("Error creating meeting:", error);
      throw error;
    }
  }

  /**
   * Get meeting details with participants and analytics
   */
  async getMeetingDetails(meetingId: string, userId?: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              avatar: true,
            },
          },
          client: {
            select: {
              name: true,
              domain: true,
              features: true,
            },
          },
          room: {
            select: {
              id: true,
              name: true,
              isActive: true,
              isLocked: true,
              currentParticipants: true,
              screenShareUserId: true,
            },
          },
          participants: {
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
          chatMessages: {
            take: 100,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatar: true,
                },
              },
            },
          },
          recordings: {
            select: {
              id: true,
              title: true,
              fileName: true,
              fileUrl: true,
              duration: true,
              status: true,
              thumbnailUrl: true,
              createdAt: true,
            },
          },
          analytics: true,
        },
      });

      if (!meeting) {
        return null;
      }

      // Check if user has access to this meeting
      if (userId && !meeting.isPublic) {
        const hasAccess = await this.checkMeetingAccess(meetingId, userId);
        if (!hasAccess) {
          throw new Error("Access denied to this meeting");
        }
      }

      // Calculate real-time analytics
      const analytics = await this.calculateMeetingAnalytics(meetingId);

      return {
        ...meeting,
        analytics,
        chatMessages: meeting.chatMessages.reverse(), // Show oldest first
      };
    } catch (error) {
      console.error("Error getting meeting details:", error);
      throw error;
    }
  }

  /**
   * Update meeting details
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<CreateMeetingData>,
    updatedBy: string,
  ) {
    try {
      // Check if user can update this meeting
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { createdBy: true, status: true },
      });

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (meeting.createdBy !== updatedBy) {
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: updatedBy },
          select: { role: true },
        });

        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          throw new Error("Insufficient permissions to update meeting");
        }
      }

      // Validate updates
      if (updates.scheduledStartTime || updates.scheduledEndTime) {
        this.validateMeetingData(updates as CreateMeetingData);
      }

      const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        include: {
          creator: {
            select: {
              displayName: true,
            },
          },
        },
      });

      // Update scheduling if times changed
      if (updates.scheduledStartTime && meeting.status === "SCHEDULED") {
        this.clearMeetingTimers(meetingId);
        this.scheduleMeetingStart(meetingId, updates.scheduledStartTime);

        if (updates.scheduledEndTime) {
          this.scheduleMeetingEnd(meetingId, updates.scheduledEndTime);
        }
      }

      this.emit("meetingUpdated", { meeting: updatedMeeting, updatedBy });

      console.log(
        `📅 Meeting updated: ${updatedMeeting.title} by ${updatedBy}`,
      );
      return updatedMeeting;
    } catch (error) {
      console.error("Error updating meeting:", error);
      throw error;
    }
  }

  /**
   * Start a scheduled meeting
   */
  async startMeeting(meetingId: string, startedBy?: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          room: true,
          client: true,
        },
      });

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (meeting.status === "ACTIVE") {
        throw new Error("Meeting is already active");
      }

      if (meeting.status === "ENDED") {
        throw new Error("Meeting has already ended");
      }

      // Create room if it doesn't exist
      let room = meeting.room;
      if (!room) {
        room = await roomManagementService.createRoom({
          name: meeting.title,
          clientId: meeting.clientId,
          createdBy: startedBy || meeting.createdBy,
          maxParticipants: meeting.maxParticipants,
          meetingId: meeting.id,
        });

        // Link room to meeting
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { roomId: room.id },
        });
      }

      // Update meeting status
      const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: "ACTIVE",
          actualStartTime: new Date(),
        },
        include: {
          creator: {
            select: {
              displayName: true,
            },
          },
        },
      });

      this.emit("meetingStarted", { meeting: updatedMeeting, startedBy, room });

      console.log(
        `▶️  Meeting started: ${updatedMeeting.title} (${meetingId})`,
      );
      return { meeting: updatedMeeting, room };
    } catch (error) {
      console.error("Error starting meeting:", error);
      throw error;
    }
  }

  /**
   * End a meeting
   */
  async endMeeting(meetingId: string, endedBy?: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          room: true,
          participants: { where: { isPresent: true } },
        },
      });

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (meeting.status === "ENDED") {
        throw new Error("Meeting has already ended");
      }

      // End all active participants
      await prisma.meetingParticipant.updateMany({
        where: {
          meetingId,
          isPresent: true,
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      // Calculate meeting duration
      const startTime =
        meeting.actualStartTime ||
        meeting.scheduledStartTime ||
        meeting.createdAt;
      const duration = Math.round(
        (new Date().getTime() - startTime.getTime()) / 1000 / 60,
      ); // minutes

      // Update meeting status
      const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: "ENDED",
          actualEndTime: new Date(),
          duration,
        },
        include: {
          creator: {
            select: {
              displayName: true,
            },
          },
        },
      });

      // End associated room
      if (meeting.room) {
        await roomManagementService.endRoom(meeting.room.id, endedBy);
      }

      // Generate meeting analytics
      await this.generateMeetingAnalytics(meetingId);

      // Clear any scheduled timers
      this.clearMeetingTimers(meetingId);

      this.emit("meetingEnded", { meeting: updatedMeeting, endedBy });

      console.log(
        `⏹️  Meeting ended: ${updatedMeeting.title} (${meetingId}), Duration: ${duration}min`,
      );
      return updatedMeeting;
    } catch (error) {
      console.error("Error ending meeting:", error);
      throw error;
    }
  }

  /**
   * Add participant to meeting
   */
  async addParticipant(data: MeetingParticipantData) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: data.meetingId },
        select: {
          status: true,
          maxParticipants: true,
          requiresApproval: true,
          _count: {
            select: {
              participants: { where: { isPresent: true } },
            },
          },
        },
      });

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (meeting.status === "ENDED") {
        throw new Error("Meeting has ended");
      }

      if (meeting._count.participants >= meeting.maxParticipants) {
        throw new Error("Meeting is full");
      }

      const participant = await prisma.meetingParticipant.upsert({
        where: {
          userId_meetingId: {
            userId: data.userId,
            meetingId: data.meetingId,
          },
        },
        create: {
          userId: data.userId,
          meetingId: data.meetingId,
          isModerator: data.isModerator || false,
          canShare: data.canShare !== false,
          canChat: data.canChat !== false,
          isPresent: !meeting.requiresApproval, // If approval required, not present initially
          joinedAt: new Date(),
        },
        update: {
          isPresent: !meeting.requiresApproval,
          joinedAt: new Date(),
          leftAt: null,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
          meeting: {
            select: {
              title: true,
              roomId: true,
            },
          },
        },
      });

      // Add to room if meeting is active and has a room
      if (
        meeting.status === "ACTIVE" &&
        participant.meeting.roomId &&
        !meeting.requiresApproval
      ) {
        await roomManagementService.addUserToRoom({
          userId: data.userId,
          roomId: participant.meeting.roomId,
          meetingId: data.meetingId,
          isModerator: data.isModerator,
        });
      }

      this.emit("participantAdded", {
        participant,
        requiresApproval: meeting.requiresApproval,
      });

      console.log(
        `👤 Participant added to meeting: ${participant.user.displayName} -> ${participant.meeting.title}`,
      );
      return participant;
    } catch (error) {
      console.error("Error adding participant:", error);
      throw error;
    }
  }

  /**
   * Remove participant from meeting
   */
  async removeParticipant(
    userId: string,
    meetingId: string,
    removedBy?: string,
  ) {
    try {
      const participant = await prisma.meetingParticipant.findUnique({
        where: {
          userId_meetingId: { userId, meetingId },
        },
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
          meeting: {
            select: {
              title: true,
              roomId: true,
            },
          },
        },
      });

      if (!participant) {
        return false;
      }

      // Update participant status
      await prisma.meetingParticipant.update({
        where: {
          userId_meetingId: { userId, meetingId },
        },
        data: {
          isPresent: false,
          leftAt: new Date(),
        },
      });

      // Remove from room if meeting has one
      if (participant.meeting.roomId) {
        await roomManagementService.removeUserFromRoom(
          userId,
          participant.meeting.roomId,
        );
      }

      this.emit("participantRemoved", { participant, removedBy });

      console.log(
        `👤 Participant removed: ${participant.user.displayName} from ${participant.meeting.title}`,
      );
      return true;
    } catch (error) {
      console.error("Error removing participant:", error);
      throw error;
    }
  }

  /**
   * Approve participant (for meetings requiring approval)
   */
  async approveParticipant(
    userId: string,
    meetingId: string,
    approvedBy: string,
  ) {
    try {
      const participant = await prisma.meetingParticipant.update({
        where: {
          userId_meetingId: { userId, meetingId },
        },
        data: {
          isPresent: true,
          joinedAt: new Date(),
        },
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
          meeting: {
            select: {
              title: true,
              roomId: true,
              status: true,
            },
          },
        },
      });

      // Add to room if meeting is active
      if (
        participant.meeting.status === "ACTIVE" &&
        participant.meeting.roomId
      ) {
        await roomManagementService.addUserToRoom({
          userId,
          roomId: participant.meeting.roomId,
          meetingId,
          isModerator: participant.isModerator,
        });
      }

      this.emit("participantApproved", { participant, approvedBy });

      console.log(
        `✅ Participant approved: ${participant.user.displayName} for ${participant.meeting.title}`,
      );
      return participant;
    } catch (error) {
      console.error("Error approving participant:", error);
      throw error;
    }
  }

  /**
   * Get user's meetings
   */
  async getUserMeetings(
    userId: string,
    filters?: {
      status?: MeetingStatus;
      timeRange?: "upcoming" | "past" | "today";
      limit?: number;
      offset?: number;
    },
  ) {
    try {
      const { status, timeRange, limit = 20, offset = 0 } = filters || {};

      let dateFilter: any = {};
      const now = new Date();

      if (timeRange) {
        switch (timeRange) {
          case "upcoming":
            dateFilter = {
              OR: [{ scheduledStartTime: { gte: now } }, { status: "ACTIVE" }],
            };
            break;
          case "past":
            dateFilter = {
              AND: [
                { status: "ENDED" },
                {
                  OR: [
                    { actualEndTime: { lt: now } },
                    { scheduledEndTime: { lt: now } },
                  ],
                },
              ],
            };
            break;
          case "today":
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);

            dateFilter = {
              OR: [
                {
                  scheduledStartTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
                {
                  actualStartTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
              ],
            };
            break;
        }
      }

      const whereClause = {
        OR: [
          { createdBy: userId },
          {
            participants: {
              some: {
                userId,
                isPresent: true,
              },
            },
          },
        ],
        ...(status && { status }),
        ...dateFilter,
      };

      const [meetings, total] = await Promise.all([
        prisma.meeting.findMany({
          where: whereClause,
          include: {
            creator: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                participants: { where: { isPresent: true } },
              },
            },
          },
          orderBy: [
            { status: "desc" }, // Active first
            { scheduledStartTime: "desc" },
            { createdAt: "desc" },
          ],
          take: limit,
          skip: offset,
        }),
        prisma.meeting.count({ where: whereClause }),
      ]);

      return {
        meetings,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      console.error("Error getting user meetings:", error);
      throw error;
    }
  }

  /**
   * Check if user has access to meeting
   */
  async checkMeetingAccess(
    meetingId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
          isPublic: true,
          createdBy: true,
          participants: {
            where: { userId },
            select: { id: true },
          },
        },
      });

      if (!meeting) {
        return false;
      }

      // Public meetings are accessible to everyone
      if (meeting.isPublic) {
        return true;
      }

      // Creator has access
      if (meeting.createdBy === userId) {
        return true;
      }

      // Participants have access
      if (meeting.participants.length > 0) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking meeting access:", error);
      return false;
    }
  }

  /**
   * Calculate meeting analytics
   */
  async calculateMeetingAnalytics(
    meetingId: string,
  ): Promise<MeetingAnalytics> {
    try {
      const [meeting, participants, messages, recordings] = await Promise.all([
        prisma.meeting.findUnique({
          where: { id: meetingId },
          select: {
            actualStartTime: true,
            actualEndTime: true,
            scheduledStartTime: true,
            createdAt: true,
          },
        }),
        prisma.meetingParticipant.findMany({
          where: { meetingId },
          select: {
            joinedAt: true,
            leftAt: true,
            duration: true,
          },
        }),
        prisma.chatMessage.count({
          where: { meetingId },
        }),
        prisma.recording.findMany({
          where: { meetingId },
          select: { duration: true },
        }),
      ]);

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      // Calculate total duration
      const startTime =
        meeting.actualStartTime ||
        meeting.scheduledStartTime ||
        meeting.createdAt;
      const endTime = meeting.actualEndTime || new Date();
      const totalDuration = Math.round(
        (endTime.getTime() - startTime.getTime()) / 1000 / 60,
      ); // minutes

      // Calculate participant metrics
      const participantCount = participants.length;

      // Calculate average participation time
      const totalParticipationTime = participants.reduce((sum, p) => {
        if (p.duration) return sum + p.duration;
        if (p.joinedAt && p.leftAt) {
          return (
            sum +
            Math.round((p.leftAt.getTime() - p.joinedAt.getTime()) / 1000 / 60)
          );
        }
        return sum;
      }, 0);

      const averageParticipationTime =
        participantCount > 0
          ? Math.round(totalParticipationTime / participantCount)
          : 0;

      // Calculate max concurrent participants (simplified - would need real-time tracking)
      const maxConcurrentParticipants = participantCount;

      // Calculate total recording duration
      const recordingDuration = recordings.reduce(
        (sum, r) => sum + (r.duration || 0),
        0,
      );

      return {
        totalDuration,
        participantCount,
        maxConcurrentParticipants,
        messageCount: messages,
        recordingDuration:
          recordingDuration > 0
            ? Math.round(recordingDuration / 60)
            : undefined,
        averageParticipationTime,
      };
    } catch (error) {
      console.error("Error calculating meeting analytics:", error);
      throw error;
    }
  }

  /**
   * Generate meeting analytics and save to database
   */
  private async generateMeetingAnalytics(meetingId: string) {
    try {
      const analytics = await this.calculateMeetingAnalytics(meetingId);

      await prisma.meetingAnalytics.upsert({
        where: { meetingId },
        create: {
          meetingId,
          actualDuration: analytics.totalDuration,
          totalParticipants: analytics.participantCount,
          maxConcurrentUsers: analytics.maxConcurrentParticipants,
          totalMessages: analytics.messageCount,
          recordingDuration: analytics.recordingDuration,
          averageParticipationTime: analytics.averageParticipationTime,
        },
        update: {
          actualDuration: analytics.totalDuration,
          totalParticipants: analytics.participantCount,
          maxConcurrentUsers: analytics.maxConcurrentParticipants,
          totalMessages: analytics.messageCount,
          recordingDuration: analytics.recordingDuration,
          averageParticipationTime: analytics.averageParticipationTime,
        },
      });

      console.log(`📊 Analytics generated for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error generating meeting analytics:", error);
    }
  }

  /**
   * Validate meeting data
   */
  private validateMeetingData(data: Partial<CreateMeetingData>) {
    if (data.scheduledStartTime && data.scheduledEndTime) {
      if (data.scheduledEndTime <= data.scheduledStartTime) {
        throw new Error("End time must be after start time");
      }
    }

    if (data.scheduledStartTime && data.scheduledStartTime < new Date()) {
      throw new Error("Cannot schedule meeting in the past");
    }

    if (
      data.maxParticipants &&
      (data.maxParticipants < 1 || data.maxParticipants > 1000)
    ) {
      throw new Error("Max participants must be between 1 and 1000");
    }
  }

  /**
   * Schedule meeting start
   */
  private scheduleMeetingStart(meetingId: string, startTime: Date) {
    const now = new Date();
    const delay = startTime.getTime() - now.getTime();

    if (delay > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.startMeeting(meetingId, "system-scheduler");
        } catch (error) {
          console.error(`Error auto-starting meeting ${meetingId}:`, error);
        }
      }, delay);

      this.meetingTimers.set(`${meetingId}-start`, timer);
    }
  }

  /**
   * Schedule meeting end
   */
  private scheduleMeetingEnd(meetingId: string, endTime: Date) {
    const now = new Date();
    const delay = endTime.getTime() - now.getTime();

    if (delay > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.endMeeting(meetingId, "system-scheduler");
        } catch (error) {
          console.error(`Error auto-ending meeting ${meetingId}:`, error);
        }
      }, delay);

      this.meetingTimers.set(`${meetingId}-end`, timer);
    }
  }

  /**
   * Schedule meeting reminder
   */
  private scheduleReminder(meetingId: string, reminderTime: Date) {
    const now = new Date();
    const delay = reminderTime.getTime() - now.getTime();

    if (delay > 0) {
      const timer = setTimeout(() => {
        this.emit("meetingReminder", { meetingId, reminderTime });
      }, delay);

      this.reminderTimers.set(meetingId, timer);
    }
  }

  /**
   * Clear all timers for a meeting
   */
  private clearMeetingTimers(meetingId: string) {
    const startTimer = this.meetingTimers.get(`${meetingId}-start`);
    const endTimer = this.meetingTimers.get(`${meetingId}-end`);
    const reminderTimer = this.reminderTimers.get(meetingId);

    if (startTimer) {
      clearTimeout(startTimer);
      this.meetingTimers.delete(`${meetingId}-start`);
    }

    if (endTimer) {
      clearTimeout(endTimer);
      this.meetingTimers.delete(`${meetingId}-end`);
    }

    if (reminderTimer) {
      clearTimeout(reminderTimer);
      this.reminderTimers.delete(meetingId);
    }
  }

  /**
   * Generate recurring meetings
   */
  private async generateRecurringMeetings(
    parentId: string,
    data: CreateMeetingData,
  ) {
    // This is a simplified implementation - would need more sophisticated recurrence handling
    if (
      !data.recurrencePattern ||
      !data.scheduledStartTime ||
      !data.scheduledEndTime
    ) {
      return;
    }

    try {
      const { frequency, interval, count } = data.recurrencePattern;

      if (frequency === "daily" && count && count > 1) {
        for (let i = 1; i < count; i++) {
          const nextStart = new Date(data.scheduledStartTime);
          nextStart.setDate(nextStart.getDate() + i * interval);

          const nextEnd = new Date(data.scheduledEndTime);
          nextEnd.setDate(nextEnd.getDate() + i * interval);

          await prisma.meeting.create({
            data: {
              title: `${data.title} (${i + 1}/${count})`,
              description: data.description,
              meetingType: data.meetingType,
              status: "SCHEDULED",
              createdBy: data.createdBy,
              clientId: data.clientId,
              scheduledStartTime: nextStart,
              scheduledEndTime: nextEnd,
              maxParticipants: data.maxParticipants || 50,
              isRecordingEnabled: data.isRecordingEnabled || false,
              isWaitingRoomEnabled: data.isWaitingRoomEnabled || false,
              requiresApproval: data.requiresApproval || false,
              allowScreenShare: data.allowScreenShare !== false,
              allowChat: data.allowChat !== false,
              isPublic: data.isPublic || false,
              parentMeetingId: parentId,
            },
          });

          // Schedule this recurring meeting
          this.scheduleMeetingStart(parentId, nextStart);
          if (nextEnd) {
            this.scheduleMeetingEnd(parentId, nextEnd);
          }
        }
      }
    } catch (error) {
      console.error("Error generating recurring meetings:", error);
    }
  }

  /**
   * Initialize periodic tasks
   */
  private initializePeriodicTasks() {
    // Clean up old meetings and generate analytics every hour
    setInterval(
      async () => {
        try {
          await this.performPeriodicMaintenance();
        } catch (error) {
          console.error("Error in periodic maintenance:", error);
        }
      },
      60 * 60 * 1000,
    ); // 1 hour

    // Check for meetings that should be started every minute
    setInterval(async () => {
      try {
        await this.checkScheduledMeetings();
      } catch (error) {
        console.error("Error checking scheduled meetings:", error);
      }
    }, 60 * 1000); // 1 minute
  }

  /**
   * Periodic maintenance tasks
   */
  private async performPeriodicMaintenance() {
    console.log("🔧 Performing meeting maintenance...");

    // End meetings that are past their scheduled end time
    const overduesMeetings = await prisma.meeting.findMany({
      where: {
        status: "ACTIVE",
        scheduledEndTime: { lt: new Date() },
      },
      select: { id: true, title: true },
    });

    for (const meeting of overduesMeetings) {
      try {
        await this.endMeeting(meeting.id, "system-maintenance");
      } catch (error) {
        console.error(`Error ending overdue meeting ${meeting.id}:`, error);
      }
    }

    console.log(
      `🔧 Maintenance completed. Ended ${overduesMeetings.length} overdue meetings`,
    );
  }

  /**
   * Check for scheduled meetings that should start
   */
  private async checkScheduledMeetings() {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        status: "SCHEDULED",
        scheduledStartTime: {
          gte: now,
          lte: fiveMinutesFromNow,
        },
      },
      select: { id: true, scheduledStartTime: true },
    });

    for (const meeting of upcomingMeetings) {
      if (!this.meetingTimers.has(`${meeting.id}-start`)) {
        this.scheduleMeetingStart(meeting.id, meeting.scheduledStartTime!);
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear all timers
    for (const timer of this.meetingTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.reminderTimers.values()) {
      clearTimeout(timer);
    }

    this.meetingTimers.clear();
    this.reminderTimers.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const meetingManagementService = new MeetingManagementService();

export default meetingManagementService;
