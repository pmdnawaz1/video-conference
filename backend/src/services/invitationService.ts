import crypto from "crypto";
import { prisma } from "./prismaService";
import { emailService } from "./emailService";
import { notificationService } from "./notificationService";
import { authService } from "./authService";
import { InvitationType, InvitationStatus, UserRole } from "@prisma/client";

export interface CreateInvitationOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  invitationType: InvitationType;
  role?: UserRole;
  customMessage?: string;
  senderId: string;
  clientId: string;

  // Meeting-specific options
  meetingId?: string;
  meetingRole?: "participant" | "moderator";

  // Group-specific options
  groupId?: string;
  groupRole?: "member" | "admin";

  // Bulk invitation options
  batchId?: string;
  expirationHours?: number;
}

export interface BulkInvitationOptions {
  invitations: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    customMessage?: string;
  }>;
  invitationType: InvitationType;
  senderId: string;
  clientId: string;
  groupId?: string;
  meetingId?: string;
  expirationHours?: number;
}

export interface AcceptInvitationOptions {
  token: string;
  userData: {
    firstName: string;
    lastName: string;
    password: string;
    displayName?: string;
    timezone?: string;
    locale?: string;
  };
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  acceptanceRate: number;
  recentInvitations: any[];
  popularInvitationTypes: Array<{
    type: InvitationType;
    count: number;
    percentage: number;
  }>;
}

/**
 * Invitation Service
 * Handles user invitations, onboarding, and invitation lifecycle management
 */
export class InvitationService {
  /**
   * Create a single invitation
   */
  async createInvitation(options: CreateInvitationOptions): Promise<any> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: options.email },
      });

      if (existingUser) {
        // If user exists and is active, don't create invitation
        if (existingUser.isActive) {
          throw new Error("User already exists and is active");
        }
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email: options.email,
          status: InvitationStatus.PENDING,
          clientId: options.clientId,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        throw new Error("Pending invitation already exists for this email");
      }

      // Generate secure invitation token
      const token = this.generateInvitationToken();
      const expirationHours = options.expirationHours || 168; // 7 days default
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      // Create invitation record
      const invitation = await prisma.invitation.create({
        data: {
          email: options.email,
          firstName: options.firstName,
          lastName: options.lastName,
          invitationType: options.invitationType,
          token,
          expiresAt,
          customMessage: options.customMessage,
          meetingId: options.meetingId,
          meetingRole: options.meetingRole,
          groupId: options.groupId,
          groupRole: options.groupRole,
          batchId: options.batchId,
          senderId: options.senderId,
          receiverId: existingUser?.id,
          clientId: options.clientId,
        },
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          client: {
            select: {
              name: true,
            },
          },
          meeting: {
            select: {
              title: true,
              startTime: true,
              scheduledStartTime: true,
            },
          },
          group: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      });

      console.log(
        `📨 Invitation created: ${options.email} by ${options.senderId}`,
      );

      return invitation;
    } catch (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }
  }

  /**
   * Create bulk invitations
   */
  async createBulkInvitations(options: BulkInvitationOptions): Promise<{
    created: number;
    failed: number;
    batchId: string;
    invitations: any[];
    errors: Array<{ email: string; error: string }>;
  }> {
    const batchId = `batch-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
    const invitations: any[] = [];
    const errors: Array<{ email: string; error: string }> = [];
    let created = 0;
    let failed = 0;

    console.log(
      `📨 Creating bulk invitations: ${options.invitations.length} recipients`,
    );

    for (const invitationData of options.invitations) {
      try {
        const invitation = await this.createInvitation({
          ...invitationData,
          invitationType: options.invitationType,
          senderId: options.senderId,
          clientId: options.clientId,
          groupId: options.groupId,
          meetingId: options.meetingId,
          batchId,
          expirationHours: options.expirationHours,
        });

        invitations.push(invitation);
        created++;
      } catch (error) {
        errors.push({
          email: invitationData.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failed++;
      }
    }

    console.log(
      `📨 Bulk invitations completed: ${created} created, ${failed} failed`,
    );

    return {
      created,
      failed,
      batchId,
      invitations,
      errors,
    };
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(invitationId: string): Promise<boolean> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
          sender: true,
          client: true,
          meeting: true,
          group: true,
        },
      });

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Invitation is not in pending status");
      }

      if (invitation.expiresAt < new Date()) {
        throw new Error("Invitation has expired");
      }

      // Prepare template data based on invitation type
      const baseTemplateData = {
        firstName: invitation.firstName || invitation.email.split("@")[0],
        lastName: invitation.lastName || "",
        inviterName: `${invitation.sender.firstName} ${invitation.sender.lastName}`,
        inviterEmail: invitation.sender.email,
        clientName: invitation.client.name,
        invitationUrl: `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.token}`,
        customMessage: invitation.customMessage,
        expiresAt: invitation.expiresAt.toLocaleDateString(),
        expirationDays: Math.ceil(
          (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      };

      let templateName = "invitation";
      let subject = `You're invited to join ${invitation.client.name}`;
      let templateData: any = baseTemplateData;

      // Customize based on invitation type
      switch (invitation.invitationType) {
        case InvitationType.USER:
          templateName = "user-invitation";
          subject = `${invitation.sender.firstName} invited you to ${invitation.client.name}`;
          break;

        case InvitationType.GROUP:
          templateName = "group-invitation";
          subject = `Join the ${invitation.group?.name} group in ${invitation.client.name}`;
          templateData = {
            ...baseTemplateData,
            groupName: invitation.group?.name || "",
            groupDescription: invitation.group?.description || "",
            groupRole: invitation.groupRole || "member",
          };
          break;

        case InvitationType.BULK:
          templateName = "bulk-invitation";
          subject = `Welcome to ${invitation.client.name}!`;
          break;
      }

      // Send invitation email
      const emailLog = await emailService.sendEmail(
        {
          to: invitation.email,
          subject,
          template: {
            name: templateName,
            data: templateData,
          },
          priority: "normal",
          tags: ["invitation", invitation.invitationType.toLowerCase()],
          metadata: {
            invitationId: invitation.id,
            invitationType: invitation.invitationType,
            senderId: invitation.senderId,
          },
        },
        invitation.clientId,
        invitation.senderId,
      );

      console.log(
        `📨 Invitation email sent to ${invitation.email}: ${emailLog.status}`,
      );

      return emailLog.status === "SENT";
    } catch (error) {
      console.error("Error sending invitation email:", error);
      throw error;
    }
  }

  /**
   * Accept invitation and create user account
   */
  async acceptInvitation(options: AcceptInvitationOptions): Promise<{
    user: any;
    tokens: any;
    invitation: any;
  }> {
    try {
      // Find and validate invitation
      const invitation = await prisma.invitation.findUnique({
        where: { token: options.token },
        include: {
          client: true,
          meeting: true,
          group: true,
        },
      });

      if (!invitation) {
        throw new Error("Invalid invitation token");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Invitation has already been processed");
      }

      if (invitation.expiresAt < new Date()) {
        // Mark as expired
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new Error("Invitation has expired");
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (existingUser && existingUser.isActive) {
        throw new Error("User already exists and is active");
      }

      // Determine user role
      let userRole: UserRole = UserRole.USER;
      if (invitation.groupRole === "admin") {
        userRole = UserRole.ADMIN;
      }

      // Create or reactivate user account
      let user;
      if (existingUser) {
        // Reactivate existing user
        user = await authService.updateProfile(existingUser.id, {
          firstName: options.userData.firstName,
          lastName: options.userData.lastName,
          displayName: options.userData.displayName,
          timezone: options.userData.timezone,
          locale: options.userData.locale,
        });

        // Update password if provided
        if (options.userData.password) {
          // This would need to be implemented in authService
          // For now, we'll assume it's handled separately
        }
      } else {
        // Create new user
        const authResult = await authService.register({
          email: invitation.email,
          password: options.userData.password,
          firstName: options.userData.firstName,
          lastName: options.userData.lastName,
          displayName: options.userData.displayName,
          role: userRole,
          clientId: invitation.clientId,
        });

        user = authResult.user;
      }

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          receiverId: user.id,
        },
      });

      // Handle specific invitation types
      if (invitation.groupId && invitation.group) {
        // Add user to group
        await prisma.groupMember.create({
          data: {
            userId: user.id,
            groupId: invitation.groupId,
            role: invitation.groupRole || "member",
            joinedAt: new Date(),
          },
        });
      }

      if (invitation.meetingId && invitation.meeting) {
        // Add user as meeting participant
        await prisma.meetingParticipant.create({
          data: {
            userId: user.id,
            meetingId: invitation.meetingId,
            isModerator: invitation.meetingRole === "moderator",
          },
        });
      }

      // Generate authentication tokens
      const tokens = await authService.generateTokens(user);

      console.log(`✅ Invitation accepted: ${invitation.email} -> ${user.id}`);

      return {
        user,
        tokens,
        invitation: {
          id: invitation.id,
          type: invitation.invitationType,
          acceptedAt: new Date(),
        },
      };
    } catch (error) {
      console.error("Error accepting invitation:", error);
      throw error;
    }
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string, reason?: string): Promise<boolean> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
      });

      if (!invitation) {
        throw new Error("Invalid invitation token");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Invitation has already been processed");
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.DECLINED,
          declinedAt: new Date(),
          customMessage: reason, // Store decline reason in customMessage
        },
      });

      console.log(`❌ Invitation declined: ${invitation.email}`);

      return true;
    } catch (error) {
      console.error("Error declining invitation:", error);
      throw error;
    }
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(invitationId: string): Promise<boolean> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Can only resend pending invitations");
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        // Extend expiration by 7 days
        await prisma.invitation.update({
          where: { id: invitationId },
          data: {
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Send the invitation email
      const success = await this.sendInvitationEmail(invitationId);

      console.log(`🔄 Invitation resent: ${invitation.email}`);

      return success;
    } catch (error) {
      console.error("Error resending invitation:", error);
      throw error;
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<boolean> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error("Can only cancel pending invitations");
      }

      await prisma.invitation.delete({
        where: { id: invitationId },
      });

      console.log(`🗑️ Invitation cancelled: ${invitation.email}`);

      return true;
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      throw error;
    }
  }

  /**
   * Get invitation by token (for display purposes)
   */
  async getInvitationByToken(token: string): Promise<any | null> {
    try {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          client: {
            select: {
              name: true,
              logo: true,
            },
          },
          meeting: {
            select: {
              title: true,
              startTime: true,
              scheduledStartTime: true,
              description: true,
            },
          },
          group: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      });

      if (!invitation) {
        return null;
      }

      // Don't return expired or processed invitations for acceptance
      if (invitation.status !== InvitationStatus.PENDING) {
        return {
          ...invitation,
          isExpired: false,
          isProcessed: true,
        };
      }

      const isExpired = invitation.expiresAt < new Date();
      if (isExpired) {
        // Mark as expired
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
      }

      return {
        ...invitation,
        isExpired,
        isProcessed: false,
        daysUntilExpiration: isExpired
          ? 0
          : Math.ceil(
              (invitation.expiresAt.getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
      };
    } catch (error) {
      console.error("Error getting invitation by token:", error);
      return null;
    }
  }

  /**
   * Get invitations with pagination and filtering
   */
  async getInvitations(
    clientId: string,
    options: {
      page?: number;
      limit?: number;
      status?: InvitationStatus;
      invitationType?: InvitationType;
      senderId?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const {
      page = 1,
      limit = 50,
      status,
      invitationType,
      senderId,
      search,
      startDate,
      endDate,
    } = options;

    const skip = (page - 1) * limit;
    const where: any = { clientId };

    if (status) where.status = status;
    if (invitationType) where.invitationType = invitationType;
    if (senderId) where.senderId = senderId;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [invitations, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          meeting: {
            select: {
              title: true,
            },
          },
          group: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.invitation.count({ where }),
    ]);

    return {
      invitations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(
    clientId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<InvitationStats> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const whereClause: any = { clientId };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter;
    }

    const [
      total,
      pending,
      accepted,
      declined,
      expired,
      recentInvitations,
      invitationTypes,
    ] = await Promise.all([
      prisma.invitation.count({ where: whereClause }),
      prisma.invitation.count({
        where: { ...whereClause, status: InvitationStatus.PENDING },
      }),
      prisma.invitation.count({
        where: { ...whereClause, status: InvitationStatus.ACCEPTED },
      }),
      prisma.invitation.count({
        where: { ...whereClause, status: InvitationStatus.DECLINED },
      }),
      prisma.invitation.count({
        where: { ...whereClause, status: InvitationStatus.EXPIRED },
      }),

      prisma.invitation.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          invitationType: true,
          createdAt: true,
          acceptedAt: true,
        },
      }),

      prisma.invitation.groupBy({
        where: whereClause,
        by: ["invitationType"],
        _count: { invitationType: true },
      }),
    ]);

    const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    return {
      total,
      pending,
      accepted,
      declined,
      expired,
      acceptanceRate,
      recentInvitations,
      popularInvitationTypes: invitationTypes.map((type) => ({
        type: type.invitationType,
        count: type._count.invitationType,
        percentage: Math.round((type._count.invitationType / total) * 100),
      })),
    };
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await prisma.invitation.updateMany({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: { lt: new Date() },
        },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      console.log(`🧹 Cleaned up ${result.count} expired invitations`);

      return result.count;
    } catch (error) {
      console.error("Error cleaning up expired invitations:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}

// Export singleton instance
export const invitationService = new InvitationService();

export default invitationService;
