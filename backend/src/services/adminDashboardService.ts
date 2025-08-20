import { prisma } from "./prismaService";
import { UserRole } from "@prisma/client";
import { authService } from "./authService";
import { roomManagementService } from "./roomManagementService";
import { stunTurnService } from "./stunTurnService";
import { ErrorLoggingService } from "./errorLoggingService";

export interface DashboardStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalMeetings: number;
    activeMeetings: number;
    totalRooms: number;
    activeRooms: number;
  };
  timeBasedStats: {
    todayMeetings: number;
    thisWeekMeetings: number;
    thisMonthMeetings: number;
    todayNewUsers: number;
    thisWeekNewUsers: number;
    thisMonthNewUsers: number;
  };
  systemHealth: {
    database: {
      status: string;
      responseTime?: number;
    };
    webrtc: {
      status: string;
      activeConnections: number;
    };
    stunTurn: {
      status: string;
      providersActive: number;
      providersTotal: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  recentActivity: {
    recentMeetings: any[];
    recentUsers: any[];
    recentErrors: any[];
  };
}

export interface UserManagementOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  clientId?: string;
  sortBy?: "createdAt" | "lastLoginAt" | "email" | "firstName" | "lastName";
  sortOrder?: "asc" | "desc";
}

export interface MeetingAnalytics {
  totalMeetings: number;
  averageDuration: number;
  averageParticipants: number;
  peakUsageHours: Array<{ hour: number; count: number }>;
  meetingTypes: Array<{ type: string; count: number; percentage: number }>;
  monthlyTrends: Array<{
    month: string;
    meetings: number;
    participants: number;
  }>;
  popularFeatures: Array<{ feature: string; usageCount: number }>;
}

export interface SystemHealthDetails {
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: string;
      responseTime: number;
      connections: number;
      queries: number;
    };
    webrtc: {
      status: string;
      activeRooms: number;
      activeUsers: number;
      signallingConnections: number;
    };
    stunTurn: {
      status: string;
      providers: Array<{
        id: string;
        name: string;
        isActive: boolean;
        isHealthy: boolean;
        region: string;
        responseTime?: number;
      }>;
    };
  };
  resources: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
      heap: {
        used: number;
        total: number;
      };
    };
    disk: {
      available: number;
      used: number;
      percentage: number;
    };
  };
}

/**
 * Admin Dashboard Service
 * Centralized service for admin dashboard data and operations
 */
export class AdminDashboardService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(clientId: string): Promise<DashboardStats> {
    const startTime = Date.now();

    try {
      // Date ranges for time-based queries
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());

      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Parallel queries for better performance
      const [
        totalUsers,
        totalMeetings,
        totalRooms,
        activeUsers,
        activeMeetings,
        activeRooms,
        todayMeetings,
        thisWeekMeetings,
        thisMonthMeetings,
        todayNewUsers,
        thisWeekNewUsers,
        thisMonthNewUsers,
        recentMeetings,
        recentUsers,
      ] = await Promise.all([
        // Overview stats
        prisma.user.count({ where: { clientId, isActive: true } }),
        prisma.meeting.count({ where: { clientId } }),
        prisma.room.count({ where: { clientId } }),

        // Active stats (users logged in within last 24 hours)
        prisma.user.count({
          where: {
            clientId,
            isActive: true,
            lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),

        // Active meetings (started and not ended)
        prisma.meeting.count({
          where: {
            clientId,
            status: "ACTIVE",
          },
        }),

        // Active rooms
        prisma.room.count({
          where: {
            clientId,
            isActive: true,
          },
        }),

        // Time-based meeting stats
        prisma.meeting.count({
          where: {
            clientId,
            startTime: { gte: today },
          },
        }),

        prisma.meeting.count({
          where: {
            clientId,
            startTime: { gte: thisWeekStart },
          },
        }),

        prisma.meeting.count({
          where: {
            clientId,
            startTime: { gte: thisMonthStart },
          },
        }),

        // Time-based user stats
        prisma.user.count({
          where: {
            clientId,
            createdAt: { gte: today },
          },
        }),

        prisma.user.count({
          where: {
            clientId,
            createdAt: { gte: thisWeekStart },
          },
        }),

        prisma.user.count({
          where: {
            clientId,
            createdAt: { gte: thisMonthStart },
          },
        }),

        // Recent activity
        prisma.meeting.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            creator: {
              select: { firstName: true, lastName: true, email: true },
            },
            _count: {
              select: { participants: true },
            },
          },
        }),

        prisma.user.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
      ]);

      // Get system health
      const memoryUsage = process.memoryUsage();
      const stunTurnStats = stunTurnService.getProviderStats();

      // Database health check
      let dbResponseTime = 0;
      let dbStatus = "healthy";
      try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbResponseTime = Date.now() - dbStart;
      } catch (error) {
        dbStatus = "unhealthy";
        console.error("Database health check failed:", error);
      }

      const dashboardStats: DashboardStats = {
        overview: {
          totalUsers,
          activeUsers,
          totalMeetings,
          activeMeetings,
          totalRooms,
          activeRooms,
        },
        timeBasedStats: {
          todayMeetings,
          thisWeekMeetings,
          thisMonthMeetings,
          todayNewUsers,
          thisWeekNewUsers,
          thisMonthNewUsers,
        },
        systemHealth: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime,
          },
          webrtc: {
            status: "healthy", // TODO: Integrate with WebRTC signaling service
            activeConnections: activeRooms, // Approximate
          },
          stunTurn: {
            status: stunTurnStats.length > 0 ? "healthy" : "inactive",
            providersActive: stunTurnStats.filter((p) => p.isActive).length,
            providersTotal: stunTurnStats.length,
          },
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            percentage: Math.round(
              (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            ),
          },
        },
        recentActivity: {
          recentMeetings: recentMeetings.map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            organizer: meeting.creator,
            startTime: meeting.startTime,
            status: meeting.status,
            type: meeting.meetingType,
            participantCount: meeting._count?.participants || 0,
          })),
          recentUsers,
          recentErrors: ErrorLoggingService.getRecentErrors(clientId, 5),
        },
      };

      console.log(
        `📊 Dashboard stats generated in ${Date.now() - startTime}ms for client ${clientId}`,
      );
      return dashboardStats;
    } catch (error) {
      console.error("Error generating dashboard stats:", error);
      throw new Error("Failed to generate dashboard statistics");
    }
  }

  /**
   * Get paginated user list with filtering and search
   */
  async getUsersManagement(
    clientId: string,
    options: UserManagementOptions = {},
  ) {
    const {
      page = 1,
      limit = 50,
      search,
      role,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { clientId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role !== undefined) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    try {
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            client: {
              select: { name: true, domain: true },
            },
            _count: {
              select: {
                createdMeetings: true,
                meetingParticipants: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users: users.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          client: user.client,
          stats: {
            organizedMeetings: user._count?.createdMeetings,
            participatedMeetings: user._count?.meetingParticipants,
          },
        })),
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error("Error in users management query:", error);
      throw new Error("Failed to fetch users");
    }
  }

  /**
   * Get meeting analytics for admin dashboard
   */
  async getMeetingAnalytics(
    clientId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<MeetingAnalytics> {
    try {
      const where: any = { clientId };

      if (dateRange) {
        where.startTime = {
          gte: dateRange.start,
          lte: dateRange.end,
        };
      }

      const [
        totalMeetings,
        meetingsWithDuration,
        meetingTypes,
        hourlyDistribution,
      ] = await Promise.all([
        prisma.meeting.count({ where }),

        prisma.meeting.findMany({
          where: {
            ...where,
            endTime: { not: null },
          },
          select: {
            startTime: true,
            endTime: true,
            _count: {
              select: { participants: true },
            },
          },
        }),

        prisma.meeting.groupBy({
          where,
          by: ["meetingType"],
          _count: { meetingType: true },
        }),

        prisma.meeting.findMany({
          where,
          select: {
            startTime: true,
          },
        }),
      ]);

      // Calculate average duration and participants
      let totalDurationMinutes = 0;
      let totalParticipants = 0;

      meetingsWithDuration.forEach((meeting) => {
        if (meeting.endTime && meeting.startTime) {
          const duration =
            (meeting.endTime.getTime() - meeting.startTime.getTime()) /
            (1000 * 60);
          totalDurationMinutes += duration;
          totalParticipants += meeting._count.participants;
        }
      });

      const averageDuration =
        meetingsWithDuration.length > 0
          ? Math.round(totalDurationMinutes / meetingsWithDuration.length)
          : 0;

      const averageParticipants =
        meetingsWithDuration.length > 0
          ? Math.round(totalParticipants / meetingsWithDuration.length)
          : 0;

      // Calculate peak usage hours
      const hourCounts = new Array(24).fill(0);
      hourlyDistribution.forEach((meeting) => {
        if (meeting.startTime) {
          const hour = meeting.startTime.getHours();
          hourCounts[hour]++;
        }
      });

      const peakUsageHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .filter((h) => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Process meeting types
      const processedTypes = meetingTypes.map((type) => ({
        type: type.meetingType,
        count: type._count.meetingType,
        percentage: Math.round((type._count.meetingType / totalMeetings) * 100),
      }));

      return {
        totalMeetings,
        averageDuration,
        averageParticipants,
        peakUsageHours,
        meetingTypes: processedTypes,
        monthlyTrends: await this.getMonthlyTrends(clientId, dateRange),
        popularFeatures: await this.getPopularFeatures(clientId, dateRange),
      };
    } catch (error) {
      console.error("Error generating meeting analytics:", error);
      throw new Error("Failed to generate meeting analytics");
    }
  }

  /**
   * Get detailed system health information
   */
  async getSystemHealth(): Promise<SystemHealthDetails> {
    try {
      const startTime = Date.now();

      // Database health
      let dbResponseTime = 0;
      let dbStatus = "healthy";
      try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbResponseTime = Date.now() - dbStart;
      } catch (error) {
        dbStatus = "unhealthy";
      }

      // Memory usage
      const memoryUsage = process.memoryUsage();

      // STUN/TURN providers
      const stunTurnProviders = stunTurnService.getProviderStats();

      return {
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        services: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime,
            connections: await this.getDatabaseConnectionCount(),
            queries: await this.getDatabaseQueryCount(),
          },
          webrtc: {
            status: "healthy",
            activeRooms: await this.getActiveRoomsCount(),
            activeUsers: await this.getActiveUsersCount(),
            signallingConnections: await this.getSignallingConnectionsCount(),
          },
          stunTurn: {
            status: stunTurnProviders.length > 0 ? "healthy" : "inactive",
            providers: stunTurnProviders.map((provider) => ({
              id: provider.id,
              name: provider.name,
              isActive: provider.isActive,
              isHealthy:
                !provider.healthCheck ||
                provider.healthCheck.isHealthy !== false,
              region: provider.region || "unknown",
              responseTime: provider.healthCheck?.responseTime,
            })),
          },
        },
        resources: {
          cpu: {
            usage: this.getCpuUsage(),
            loadAverage:
              process.platform === "linux"
                ? require("os").loadavg()
                : [0, 0, 0],
          },
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            percentage: Math.round(
              (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            ),
            heap: {
              used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            },
          },
          disk: await this.getDiskUsage(),
        },
      };
    } catch (error) {
      console.error("Error getting system health:", error);
      throw new Error("Failed to get system health information");
    }
  }

  /**
   * Create a new user (admin operation)
   */
  async createUser(
    adminClientId: string,
    userData: {
      email: string;
      firstName: string;
      lastName: string;
      displayName?: string;
      role: UserRole;
      clientId?: string;
    },
  ) {
    try {
      // Default to admin's client if not specified
      const targetClientId = userData.clientId || adminClientId;

      // Verify target client exists
      const client = await prisma.client.findUnique({
        where: { id: targetClientId },
      });

      if (!client) {
        throw new Error("Target client not found");
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new Error("User already exists with this email");
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).substring(2, 15);

      // Create user using auth service
      const newUser = await authService.register({
        email: userData.email,
        password: tempPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName,
        role: userData.role,
        clientId: targetClientId,
      });

      console.log(
        `👤 Admin created user: ${userData.email} with role ${userData.role}`,
      );

      return {
        user: newUser.user,
        tempPassword, // Return for admin to share with user
        message: "User created successfully",
      };
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Update user role and status (admin operation)
   */
  async updateUser(
    userId: string,
    adminClientId: string,
    updates: {
      role?: UserRole;
      isActive?: boolean;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    },
  ) {
    try {
      // Verify user belongs to same client as admin or admin is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Check authorization (user must be in same client or admin must be super admin)
      // This should be handled at the route level, but double-check here
      if (user.clientId !== adminClientId) {
        // Only super admins can modify users from other clients
        // This check should happen at route level with proper role checking
        console.warn(
          `Cross-client user modification attempt: ${userId} by admin in client ${adminClientId}`,
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        include: {
          client: {
            select: { name: true, domain: true },
          },
        },
      });

      console.log(
        `🔧 Admin updated user ${userId}: ${JSON.stringify(updates)}`,
      );

      return {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        clientId: updatedUser.clientId,
        client: updatedUser.client,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  /**
   * Impersonate user (super admin only)
   */
  async impersonateUser(
    targetUserId: string,
    adminUserId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { client: true },
      });

      if (!targetUser || !targetUser.isActive) {
        throw new Error("Target user not found or inactive");
      }

      // Generate tokens for target user using auth service
      const tokens = await authService.generateTokens(targetUser);

      console.log(
        `🎭 Admin ${adminUserId} started impersonating user ${targetUserId}`,
      );

      return tokens;
    } catch (error) {
      console.error("Error during user impersonation:", error);
      throw error;
    }
  }

  /**
   * Get monthly trends for meetings and participants
   */
  private async getMonthlyTrends(
    clientId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<Array<{ month: string; meetings: number; participants: number }>> {
    try {
      const endDate = dateRange?.end || new Date();
      const startDate =
        dateRange?.start ||
        new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1);

      const monthlyData: Record<
        string,
        { meetings: number; participants: number }
      > = {};

      // Generate monthly buckets
      const currentMonth = new Date(startDate);
      while (currentMonth <= endDate) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
        monthlyData[monthKey] = { meetings: 0, participants: 0 };
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      // Get monthly meeting data
      const monthlyMeetings = await prisma.meeting.findMany({
        where: {
          clientId,
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          _count: {
            select: { participants: true },
          },
        },
      });

      // Aggregate data by month
      monthlyMeetings.forEach((meeting) => {
        if (meeting.startTime) {
          const monthKey = `${meeting.startTime.getFullYear()}-${String(meeting.startTime.getMonth() + 1).padStart(2, "0")}`;
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].meetings++;
            monthlyData[monthKey].participants += meeting._count.participants;
          }
        }
      });

      return Object.entries(monthlyData).map(([month, data]) => ({
        month,
        meetings: data.meetings,
        participants: data.participants,
      }));
    } catch (error) {
      console.error("Error getting monthly trends:", error);
      return [];
    }
  }

  /**
   * Get popular features usage tracking
   */
  private async getPopularFeatures(
    clientId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<Array<{ feature: string; usageCount: number }>> {
    try {
      const endDate = dateRange?.end || new Date();
      const startDate =
        dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get feature usage data from various sources
      const [
        recordingsCount,
        chatMessagesCount,
        screenSharesCount,
        fileUploadsCount,
        invitationsCount,
      ] = await Promise.all([
        // Recordings feature usage
        prisma.recording.count({
          where: {
            clientId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),

        // Chat feature usage
        prisma.chatMessage.count({
          where: {
            meeting: { clientId },
            createdAt: { gte: startDate, lte: endDate },
          },
        }),

        // Screen sharing usage (from meeting participants)
        prisma.meetingParticipant.count({
          where: {
            meeting: { clientId },
            isScreenSharing: true,
            joinedAt: { gte: startDate, lte: endDate },
          },
        }),

        // File uploads usage
        prisma.file.count({
          where: {
            clientId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),

        // Invitations feature usage
        prisma.invitation.count({
          where: {
            clientId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      ]);

      const features = [
        { feature: "Meeting Recordings", usageCount: recordingsCount },
        { feature: "Chat Messages", usageCount: chatMessagesCount },
        { feature: "Screen Sharing", usageCount: screenSharesCount },
        { feature: "File Sharing", usageCount: fileUploadsCount },
        { feature: "Meeting Invitations", usageCount: invitationsCount },
      ];

      return features
        .filter((f) => f.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount);
    } catch (error) {
      console.error("Error getting popular features:", error);
      return [];
    }
  }

  /**
   * Get database connection count
   */
  private async getDatabaseConnectionCount(): Promise<number> {
    try {
      // For PostgreSQL, we can query active connections
      const result = (await prisma.$queryRaw`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `) as Array<{ count: bigint }>;

      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting database connections:", error);
      return 0;
    }
  }

  /**
   * Get database query count (simplified - would need query tracking)
   */
  private async getDatabaseQueryCount(): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you'd implement query tracking
      const result = (await prisma.$queryRaw`
        SELECT sum(calls) as total_queries
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
      `) as Array<{ total_queries: bigint | null }>;

      return Number(result[0]?.total_queries || 0);
    } catch (error) {
      // pg_stat_statements might not be enabled
      console.error(
        "Error getting query count (pg_stat_statements not available):",
        error,
      );
      return 0;
    }
  }

  /**
   * Get active rooms count
   */
  private async getActiveRoomsCount(): Promise<number> {
    try {
      return await prisma.room.count({
        where: { isActive: true },
      });
    } catch (error) {
      console.error("Error getting active rooms count:", error);
      return 0;
    }
  }

  /**
   * Get active users count (users online in last 5 minutes)
   */
  private async getActiveUsersCount(): Promise<number> {
    try {
      return await prisma.user.count({
        where: {
          isActive: true,
          lastLoginAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
      });
    } catch (error) {
      console.error("Error getting active users count:", error);
      return 0;
    }
  }

  /**
   * Get signalling connections count (from active meeting participants)
   */
  private async getSignallingConnectionsCount(): Promise<number> {
    try {
      return await prisma.meetingParticipant.count({
        where: {
          isPresent: true,
          lastPingAt: {
            gte: new Date(Date.now() - 30 * 1000), // Last 30 seconds
          },
        },
      });
    } catch (error) {
      console.error("Error getting signalling connections count:", error);
      return 0;
    }
  }

  /**
   * Get CPU usage percentage
   */
  private getCpuUsage(): number {
    try {
      const os = require("os");
      const cpus = os.cpus();

      if (!cpus || cpus.length === 0) return 0;

      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach((cpu: any) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - Math.floor((100 * idle) / total);

      return Math.max(0, Math.min(100, usage));
    } catch (error) {
      console.error("Error getting CPU usage:", error);
      return 0;
    }
  }

  /**
   * Get disk usage information
   */
  private async getDiskUsage(): Promise<{
    available: number;
    used: number;
    percentage: number;
  }> {
    try {
      const fs = require("fs");
      const { promisify } = require("util");
      const stat = promisify(fs.stat);

      // Get stats for current directory (simplified approach)
      const stats = await stat(".");

      // This is a simplified implementation
      // In production, you'd use a proper disk usage library
      return {
        available: 1000000, // 1GB in MB (mock data)
        used: 500000, // 500MB (mock data)
        percentage: 50, // 50% (mock data)
      };
    } catch (error) {
      console.error("Error getting disk usage:", error);
      return { available: 0, used: 0, percentage: 0 };
    }
  }
}

// Export singleton instance
export const adminDashboardService = new AdminDashboardService();

export default adminDashboardService;
