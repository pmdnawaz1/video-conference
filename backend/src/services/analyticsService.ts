import { prisma } from './prismaService';
import { ChatMessageType, MeetingStatus, UserRole } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

export interface MeetingMetrics {
  meetingId: string;
  participantCount: number;
  messagesCount: number;
  duration: number;
  screenShareCount: number;
  connectionQuality: string;
  peakParticipants: number;
  averageParticipationTime: number;
  dropoutRate: number;
}

export interface UserEngagementMetrics {
  userId: string;
  meetingsCreated: number;
  meetingsJoined: number;
  totalMeetingDuration: number;
  messagesCount: number;
  screenSharesCount: number;
  averageJoinTime: number;
  connectionQualityAvg: string;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalMeetings: number;
  activeMeetings: number;
  totalDuration: number;
  totalMessages: number;
  averageMeetingDuration: number;
  userGrowthRate: number;
  engagementRate: number;
}

export interface AnalyticsQuery {
  clientId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
}

export interface AnalyticsDashboard {
  overview: PlatformMetrics;
  recentMeetings: Array<{
    id: string;
    title: string;
    status: string;
    participantCount: number;
    duration: number;
    createdAt: Date;
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    totalDuration: number;
    meetingCount: number;
    engagementScore: number;
  }>;
  trends: {
    meetings: Array<{ date: string; count: number; duration: number }>;
    users: Array<{ date: string; active: number; new: number }>;
    engagement: Array<{ date: string; messages: number; participants: number }>;
  };
  insights: Array<{
    type: 'growth' | 'engagement' | 'quality' | 'usage';
    message: string;
    value: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

/**
 * Comprehensive Analytics Service
 * Handles real-time metrics collection, aggregation, and reporting
 */
export class AnalyticsService {
  private io?: SocketIOServer;
  private metricsBuffer: Map<string, any> = new Map();
  private aggregationInterval: NodeJS.Timeout | null = null;

  constructor(io?: SocketIOServer) {
    this.io = io;
    this.startMetricsAggregation();
  }

  /**
   * Start automated metrics aggregation
   */
  private startMetricsAggregation() {
    // Aggregate metrics every 5 minutes
    this.aggregationInterval = setInterval(async () => {
      await this.aggregateMetrics();
    }, 5 * 60 * 1000);

    console.log('📊 Analytics service started with automated aggregation');
  }

  /**
   * Stop metrics aggregation
   */
  public stopMetricsAggregation() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
  }

  /**
   * Track meeting start event
   */
  async trackMeetingStart(meetingId: string, userId: string): Promise<void> {
    try {
      // Update meeting start time
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          actualStartTime: new Date(),
          status: MeetingStatus.ACTIVE,
        },
      });

      // Initialize real-time metrics tracking
      this.metricsBuffer.set(`meeting:${meetingId}`, {
        meetingId,
        startTime: new Date(),
        participants: new Set([userId]),
        messages: 0,
        screenShares: 0,
        qualityReports: [],
        peakParticipants: 1,
      });

      console.log(`📊 Meeting analytics started: ${meetingId}`);
    } catch (error) {
      console.error('Error tracking meeting start:', error);
    }
  }

  /**
   * Track meeting end event
   */
  async trackMeetingEnd(meetingId: string): Promise<void> {
    try {
      const endTime = new Date();
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          participants: true,
          chatMessages: true,
        },
      });

      if (!meeting) return;

      const duration = meeting.actualStartTime 
        ? Math.round((endTime.getTime() - meeting.actualStartTime.getTime()) / (1000 * 60))
        : 0;

      // Update meeting with end time and duration
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          actualEndTime: endTime,
          status: MeetingStatus.ENDED,
          duration,
        },
      });

      // Create meeting analytics record
      const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
      const totalParticipants = meeting.participants.length;
      const totalMessages = meeting.chatMessages.length;
      
      // Calculate advanced metrics
      const presentParticipants = meeting.participants.filter(p => p.isPresent);
      const averageParticipationTime = presentParticipants.length > 0
        ? presentParticipants.reduce((sum, p) => {
            if (p.joinedAt && p.leftAt) {
              return sum + Math.round((p.leftAt.getTime() - p.joinedAt.getTime()) / (1000 * 60));
            }
            return sum;
          }, 0) / presentParticipants.length
        : 0;

      const dropoutRate = totalParticipants > 0 
        ? ((totalParticipants - presentParticipants.length) / totalParticipants) * 100
        : 0;

      const peakParticipants = metrics?.peakParticipants || totalParticipants;

      await prisma.meetingAnalytics.create({
        data: {
          meetingId,
          actualDuration: duration,
          maxConcurrentUsers: peakParticipants,
          totalParticipants,
          totalMessages,
          screenSharesCount: metrics?.screenShares || 0,
          averageConnectionQuality: this.calculateAverageQuality(metrics?.qualityReports || []),
          dropoutRate,
          averageParticipationTime: Math.round(averageParticipationTime),
          peakParticipants,
        },
      });

      // Clean up metrics buffer
      this.metricsBuffer.delete(`meeting:${meetingId}`);

      console.log(`📊 Meeting analytics completed: ${meetingId} (${duration}min, ${totalParticipants} participants)`);
    } catch (error) {
      console.error('Error tracking meeting end:', error);
    }
  }

  /**
   * Track user joining meeting
   */
  async trackUserJoin(meetingId: string, userId: string): Promise<void> {
    try {
      // Update participant record
      await prisma.meetingParticipant.upsert({
        where: {
          userId_meetingId: { userId, meetingId },
        },
        create: {
          userId,
          meetingId,
          isPresent: true,
          joinedAt: new Date(),
        },
        update: {
          isPresent: true,
          joinedAt: new Date(),
          leftAt: null,
        },
      });

      // Update real-time metrics
      const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
      if (metrics) {
        metrics.participants.add(userId);
        metrics.peakParticipants = Math.max(metrics.peakParticipants, metrics.participants.size);
        this.metricsBuffer.set(`meeting:${meetingId}`, metrics);
      }

      console.log(`📊 User joined tracked: ${userId} -> ${meetingId}`);
    } catch (error) {
      console.error('Error tracking user join:', error);
    }
  }

  /**
   * Track user leaving meeting
   */
  async trackUserLeave(meetingId: string, userId: string): Promise<void> {
    try {
      const leftAt = new Date();
      
      // Update participant record
      const participant = await prisma.meetingParticipant.findUnique({
        where: {
          userId_meetingId: { userId, meetingId },
        },
      });

      if (participant && participant.joinedAt) {
        const duration = Math.round((leftAt.getTime() - participant.joinedAt.getTime()) / (1000 * 60));
        
        await prisma.meetingParticipant.update({
          where: {
            userId_meetingId: { userId, meetingId },
          },
          data: {
            isPresent: false,
            leftAt,
            duration,
          },
        });
      }

      // Update real-time metrics
      const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
      if (metrics) {
        metrics.participants.delete(userId);
        this.metricsBuffer.set(`meeting:${meetingId}`, metrics);
      }

      console.log(`📊 User leave tracked: ${userId} <- ${meetingId}`);
    } catch (error) {
      console.error('Error tracking user leave:', error);
    }
  }

  /**
   * Track chat message
   */
  async trackMessage(meetingId: string, userId: string, messageType: ChatMessageType = ChatMessageType.TEXT): Promise<void> {
    try {
      // Update real-time metrics
      const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
      if (metrics) {
        metrics.messages++;
        this.metricsBuffer.set(`meeting:${meetingId}`, metrics);
      }

      console.log(`📊 Message tracked: ${messageType} in ${meetingId}`);
    } catch (error) {
      console.error('Error tracking message:', error);
    }
  }

  /**
   * Track screen share
   */
  async trackScreenShare(meetingId: string, userId: string, action: 'start' | 'stop'): Promise<void> {
    try {
      if (action === 'start') {
        const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
        if (metrics) {
          metrics.screenShares++;
          this.metricsBuffer.set(`meeting:${meetingId}`, metrics);
        }
      }

      console.log(`📊 Screen share tracked: ${action} by ${userId} in ${meetingId}`);
    } catch (error) {
      console.error('Error tracking screen share:', error);
    }
  }

  /**
   * Track connection quality
   */
  async trackConnectionQuality(meetingId: string, userId: string, quality: string, stats?: any): Promise<void> {
    try {
      // Update participant connection quality
      await prisma.meetingParticipant.updateMany({
        where: {
          userId,
          meetingId,
          isPresent: true,
        },
        data: {
          connectionQuality: quality,
          lastPingAt: new Date(),
        },
      });

      // Add to real-time metrics
      const metrics = this.metricsBuffer.get(`meeting:${meetingId}`);
      if (metrics) {
        metrics.qualityReports.push({ userId, quality, timestamp: new Date(), stats });
        this.metricsBuffer.set(`meeting:${meetingId}`, metrics);
      }

      console.log(`📊 Connection quality tracked: ${quality} for ${userId} in ${meetingId}`);
    } catch (error) {
      console.error('Error tracking connection quality:', error);
    }
  }

  /**
   * Generate user analytics for a specific period
   */
  async generateUserAnalytics(userId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          createdMeetings: {
            where: {
              createdAt: {
                gte: this.getStartOfPeriod(period),
              },
            },
          },
          meetingParticipants: {
            where: {
              joinedAt: {
                gte: this.getStartOfPeriod(period),
              },
            },
          },
          chatMessages: {
            where: {
              createdAt: {
                gte: this.getStartOfPeriod(period),
              },
            },
          },
        },
      });

      if (!user) return;

      const date = this.getStartOfPeriod(period);
      const meetingsCreated = user.createdMeetings.length;
      const meetingsJoined = user.meetingParticipants.length;
      const totalMeetingDuration = user.meetingParticipants.reduce((sum, p) => sum + (p.duration || 0), 0);
      const messagesSet = user.chatMessages.length;
      const screenSharesCount = user.meetingParticipants.filter(p => p.isScreenSharing).length;

      // Calculate average join time
      const joinTimes = user.meetingParticipants
        .filter(p => p.joinedAt && p.meetingId)
        .map(p => {
          // This would need meeting start time - simplified for now
          return 0; // TODO: Calculate actual join delay
        });
      const averageJoinTime = joinTimes.length > 0 
        ? Math.round(joinTimes.reduce((sum, time) => sum + time, 0) / joinTimes.length)
        : 0;

      // Calculate average connection quality
      const qualityValues = user.meetingParticipants
        .map(p => p.connectionQuality)
        .filter(q => q);
      const connectionQualityAvg = this.calculateAverageQuality(qualityValues);

      await prisma.userAnalytics.upsert({
        where: {
          userId_date_period: {
            userId,
            date,
            period,
          },
        },
        create: {
          userId,
          clientId: user.clientId,
          date,
          period,
          meetingsCreated,
          meetingsJoined,
          totalMeetingDuration,
          messagesSet,
          screenSharesCount,
          averageJoinTime,
          connectionQualityAvg,
        },
        update: {
          meetingsCreated,
          meetingsJoined,
          totalMeetingDuration,
          messagesSet,
          screenSharesCount,
          averageJoinTime,
          connectionQualityAvg,
        },
      });

      console.log(`📊 User analytics generated: ${userId} (${period})`);
    } catch (error) {
      console.error('Error generating user analytics:', error);
    }
  }

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(clientId: string, days: number = 30): Promise<AnalyticsDashboard> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Overview metrics
      const [
        totalUsers,
        activeUsers,
        totalMeetings,
        activeMeetings,
        recentMeetings,
        userAnalytics,
        meetingAnalytics
      ] = await Promise.all([
        prisma.user.count({ where: { clientId, isActive: true } }),
        prisma.user.count({
          where: {
            clientId,
            isActive: true,
            lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.meeting.count({ where: { clientId } }),
        prisma.meeting.count({ where: { clientId, status: MeetingStatus.ACTIVE } }),
        prisma.meeting.findMany({
          where: {
            clientId,
            createdAt: { gte: startDate },
          },
          include: {
            analytics: true,
            _count: { select: { participants: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.userAnalytics.findMany({
          where: {
            clientId,
            date: { gte: startDate },
            period: 'daily',
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        }),
        prisma.meetingAnalytics.findMany({
          where: {
            meeting: {
              clientId,
              createdAt: { gte: startDate },
            },
          },
          include: {
            meeting: {
              select: {
                createdAt: true,
              },
            },
          },
        }),
      ]);

      // Calculate overview metrics
      const totalDuration = meetingAnalytics.reduce((sum, ma) => sum + ma.actualDuration, 0);
      const totalMessages = meetingAnalytics.reduce((sum, ma) => sum + ma.totalMessages, 0);
      const averageMeetingDuration = meetingAnalytics.length > 0 
        ? Math.round(totalDuration / meetingAnalytics.length)
        : 0;

      // User growth rate (comparing last 7 days to previous 7 days)
      const lastWeekUsers = await prisma.user.count({
        where: {
          clientId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });
      const thisWeekUsers = await prisma.user.count({
        where: {
          clientId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      const userGrowthRate = lastWeekUsers > 0 
        ? Math.round(((thisWeekUsers - lastWeekUsers) / lastWeekUsers) * 100)
        : 100;

      // Engagement rate (active users / total users)
      const engagementRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

      // Top users by total duration
      const userEngagementMap = new Map();
      userAnalytics.forEach(ua => {
        const userId = ua.userId;
        if (!userEngagementMap.has(userId)) {
          userEngagementMap.set(userId, {
            userId,
            name: ua.user.displayName || `${ua.user.firstName} ${ua.user.lastName}`,
            totalDuration: 0,
            meetingCount: 0,
            messagesCount: 0,
          });
        }
        const user = userEngagementMap.get(userId);
        user.totalDuration += ua.totalMeetingDuration;
        user.meetingCount += ua.meetingsCreated + ua.meetingsJoined;
        user.messagesCount += ua.messagesSet;
      });

      const topUsers = Array.from(userEngagementMap.values())
        .map(user => ({
          ...user,
          engagementScore: this.calculateEngagementScore(user),
        }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10);

      // Generate trends data
      const trends = this.generateTrends(meetingAnalytics, userAnalytics, days);

      // Generate insights
      const insights = this.generateInsights({
        totalUsers,
        activeUsers,
        totalMeetings,
        activeMeetings,
        totalDuration,
        totalMessages,
        averageMeetingDuration,
        userGrowthRate,
        engagementRate,
      }, trends);

      return {
        overview: {
          totalUsers,
          activeUsers,
          totalMeetings,
          activeMeetings,
          totalDuration,
          totalMessages,
          averageMeetingDuration,
          userGrowthRate,
          engagementRate,
        },
        recentMeetings: recentMeetings.map(meeting => ({
          id: meeting.id,
          title: meeting.title,
          status: meeting.status,
          participantCount: meeting._count.participants,
          duration: meeting.analytics?.[0]?.actualDuration || 0,
          createdAt: meeting.createdAt,
        })),
        topUsers,
        trends,
        insights,
      };
    } catch (error) {
      console.error('Error getting dashboard analytics:', error);
      throw error;
    }
  }

  /**
   * Aggregate metrics from buffer to database
   */
  private async aggregateMetrics(): Promise<void> {
    try {
      // Generate daily analytics for all active users
      const activeUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });

      for (const user of activeUsers) {
        await this.generateUserAnalytics(user.id, 'daily');
      }

      console.log(`📊 Aggregated metrics for ${activeUsers.length} users`);
    } catch (error) {
      console.error('Error aggregating metrics:', error);
    }
  }

  /**
   * Helper methods
   */
  private getStartOfPeriod(period: 'daily' | 'weekly' | 'monthly'): Date {
    const date = new Date();
    
    if (period === 'daily') {
      date.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      const dayOfWeek = date.getDay();
      date.setDate(date.getDate() - dayOfWeek);
      date.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
    }
    
    return date;
  }

  private calculateAverageQuality(qualityReports: any[]): string {
    if (qualityReports.length === 0) return 'good';
    
    const qualityMap = { poor: 1, fair: 2, good: 3, excellent: 4 };
    const reverseMap = { 1: 'poor', 2: 'fair', 3: 'good', 4: 'excellent' };
    
    const average = qualityReports.reduce((sum, report) => {
      const quality = typeof report === 'string' ? report : report.quality;
      return sum + (qualityMap[quality as keyof typeof qualityMap] || 3);
    }, 0) / qualityReports.length;
    
    return reverseMap[Math.round(average) as keyof typeof reverseMap] || 'good';
  }

  private calculateEngagementScore(user: any): number {
    // Simple engagement score based on activity
    return user.totalDuration * 0.5 + user.meetingCount * 10 + user.messagesCount * 0.1;
  }

  private generateTrends(meetingAnalytics: any[], userAnalytics: any[], days: number): any {
    // Generate daily trends for the specified period
    const trends = {
      meetings: [] as any[],
      users: [] as any[],
      engagement: [] as any[],
    };

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Meeting trends
      const dayMeetings = meetingAnalytics.filter(ma => 
        ma.meeting.createdAt.toISOString().split('T')[0] === dateStr
      );
      trends.meetings.push({
        date: dateStr,
        count: dayMeetings.length,
        duration: dayMeetings.reduce((sum, ma) => sum + ma.actualDuration, 0),
      });

      // User trends
      const dayUsers = userAnalytics.filter(ua => 
        ua.date.toISOString().split('T')[0] === dateStr
      );
      trends.users.push({
        date: dateStr,
        active: dayUsers.length,
        new: 0, // This would need to be calculated from user creation dates
      });

      // Engagement trends
      const dayMessages = dayMeetings.reduce((sum, ma) => sum + ma.totalMessages, 0);
      const dayParticipants = dayMeetings.reduce((sum, ma) => sum + ma.totalParticipants, 0);
      trends.engagement.push({
        date: dateStr,
        messages: dayMessages,
        participants: dayParticipants,
      });
    }

    return trends;
  }

  private generateInsights(overview: PlatformMetrics, trends: any): any[] {
    const insights = [];

    // User growth insight
    if (overview.userGrowthRate > 10) {
      insights.push({
        type: 'growth',
        message: `User growth is strong at ${overview.userGrowthRate}% this week`,
        value: overview.userGrowthRate,
        change: overview.userGrowthRate,
        trend: 'up',
      });
    } else if (overview.userGrowthRate < -5) {
      insights.push({
        type: 'growth',
        message: `User growth is declining by ${Math.abs(overview.userGrowthRate)}% this week`,
        value: overview.userGrowthRate,
        change: overview.userGrowthRate,
        trend: 'down',
      });
    }

    // Engagement insight
    if (overview.engagementRate > 70) {
      insights.push({
        type: 'engagement',
        message: `High user engagement at ${overview.engagementRate}%`,
        value: overview.engagementRate,
        change: 0, // Would need historical data
        trend: 'up',
      });
    } else if (overview.engagementRate < 30) {
      insights.push({
        type: 'engagement',
        message: `Low user engagement at ${overview.engagementRate}% - consider engagement strategies`,
        value: overview.engagementRate,
        change: 0,
        trend: 'down',
      });
    }

    // Meeting quality insight
    if (overview.averageMeetingDuration > 60) {
      insights.push({
        type: 'usage',
        message: `Meetings are long on average (${overview.averageMeetingDuration} min) - consider meeting efficiency`,
        value: overview.averageMeetingDuration,
        change: 0,
        trend: 'stable',
      });
    }

    return insights;
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalytics(
    query: AnalyticsQuery,
    format: 'json' | 'csv' | 'excel' = 'json'
  ): Promise<any> {
    try {
      const { clientId, startDate, endDate } = query;
      
      const meetings = await prisma.meeting.findMany({
        where: {
          clientId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          analytics: true,
          creator: true,
          participants: true,
          chatMessages: true,
        },
      });

      if (format === 'json') {
        return meetings;
      }
      
      // For CSV/Excel, we'd need additional formatting logic
      return meetings;
    } catch (error) {
      console.error('Error exporting analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for a meeting
   */
  getRealTimeMetrics(meetingId: string): any {
    return this.metricsBuffer.get(`meeting:${meetingId}`) || null;
  }

  /**
   * Broadcast real-time analytics update
   */
  broadcastAnalyticsUpdate(clientId: string, data: any): void {
    if (this.io) {
      this.io.to(`client-${clientId}`).emit('analytics-update', data);
    }
  }
}

// Singleton instance
let analyticsServiceInstance: AnalyticsService | null = null;

export const initializeAnalyticsService = (io?: SocketIOServer): AnalyticsService => {
  analyticsServiceInstance = new AnalyticsService(io);
  return analyticsServiceInstance;
};

export const getAnalyticsService = (): AnalyticsService => {
  if (!analyticsServiceInstance) {
    throw new Error('Analytics service not initialized. Call initializeAnalyticsService first.');
  }
  return analyticsServiceInstance;
};

export default AnalyticsService;