import { prisma } from "./prismaService";

export interface ErrorLog {
  id: string;
  level: "error" | "warning" | "info";
  message: string;
  stack?: string;
  source: string;
  userId?: string;
  clientId?: string;
  meetingId?: string;
  metadata?: any;
  createdAt: Date;
}

export interface ErrorLogQuery {
  clientId?: string;
  level?: string;
  source?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Error Logging Service
 * Centralized error tracking and reporting for monitoring system health
 */
export class ErrorLoggingService {
  /**
   * Log an error event
   */
  static async logError(
    level: "error" | "warning" | "info",
    message: string,
    source: string,
    options: {
      stack?: string;
      userId?: string;
      clientId?: string;
      meetingId?: string;
      metadata?: any;
    } = {},
  ): Promise<void> {
    try {
      // For now, we'll store errors in memory and database
      // In production, this would integrate with proper logging services

      console.log(`🚨 [${level.toUpperCase()}] ${source}: ${message}`, options);

      // Store in database for dashboard reporting
      // Since we don't have an errors table in schema, we'll use a simple approach
      // In a real implementation, you'd add an ErrorLog model to the Prisma schema

      // For now, we'll cache recent errors in memory for dashboard display
      this.addToRecentErrors({
        id: Date.now().toString(),
        level,
        message,
        stack: options.stack,
        source,
        userId: options.userId,
        clientId: options.clientId,
        meetingId: options.meetingId,
        metadata: options.metadata,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to log error:", error);
    }
  }

  /**
   * Get recent errors for dashboard
   */
  static getRecentErrors(clientId?: string, limit: number = 10): ErrorLog[] {
    try {
      let errors = this.recentErrorsCache;

      if (clientId) {
        errors = errors.filter((error) => error.clientId === clientId);
      }

      return errors
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error("Failed to get recent errors:", error);
      return [];
    }
  }

  /**
   * Get error statistics
   */
  static getErrorStats(
    clientId?: string,
    hours: number = 24,
  ): {
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    trend: Array<{ hour: number; count: number }>;
  } {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      let errors = this.recentErrorsCache.filter(
        (error) => error.createdAt >= startTime,
      );

      if (clientId) {
        errors = errors.filter((error) => error.clientId === clientId);
      }

      const byLevel: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      errors.forEach((error) => {
        byLevel[error.level] = (byLevel[error.level] || 0) + 1;
        bySource[error.source] = (bySource[error.source] || 0) + 1;
      });

      // Generate hourly trend
      const trend = [];
      for (let i = hours - 1; i >= 0; i--) {
        const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
        hourStart.setMinutes(0, 0, 0);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const hourErrors = errors.filter(
          (error) => error.createdAt >= hourStart && error.createdAt < hourEnd,
        );

        trend.push({
          hour: hourStart.getHours(),
          count: hourErrors.length,
        });
      }

      return {
        total: errors.length,
        byLevel,
        bySource,
        trend,
      };
    } catch (error) {
      console.error("Failed to get error stats:", error);
      return { total: 0, byLevel: {}, bySource: {}, trend: [] };
    }
  }

  /**
   * Clear old errors from cache
   */
  static cleanupOldErrors(maxAge: number = 24 * 60 * 60 * 1000): void {
    try {
      const cutoff = new Date(Date.now() - maxAge);
      this.recentErrorsCache = this.recentErrorsCache.filter(
        (error) => error.createdAt >= cutoff,
      );
    } catch (error) {
      console.error("Failed to cleanup old errors:", error);
    }
  }

  /**
   * Log application error
   */
  static async logAppError(
    error: Error,
    source: string,
    userId?: string,
    clientId?: string,
  ): Promise<void> {
    await this.logError("error", error.message, source, {
      stack: error.stack,
      userId,
      clientId,
    });
  }

  /**
   * Log warning
   */
  static async logWarning(
    message: string,
    source: string,
    userId?: string,
    clientId?: string,
  ): Promise<void> {
    await this.logError("warning", message, source, { userId, clientId });
  }

  /**
   * Log info message
   */
  static async logInfo(
    message: string,
    source: string,
    userId?: string,
    clientId?: string,
  ): Promise<void> {
    await this.logError("info", message, source, { userId, clientId });
  }

  // Private cache for recent errors
  private static recentErrorsCache: ErrorLog[] = [];
  private static readonly MAX_CACHE_SIZE = 1000;

  private static addToRecentErrors(error: ErrorLog): void {
    this.recentErrorsCache.push(error);

    // Keep cache size manageable
    if (this.recentErrorsCache.length > this.MAX_CACHE_SIZE) {
      this.recentErrorsCache = this.recentErrorsCache.slice(
        -this.MAX_CACHE_SIZE,
      );
    }
  }
}

// Auto-cleanup every hour
setInterval(
  () => {
    ErrorLoggingService.cleanupOldErrors();
  },
  60 * 60 * 1000,
);

export default ErrorLoggingService;
