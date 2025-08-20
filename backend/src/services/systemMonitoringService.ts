import { prisma } from "./prismaService";
import { ErrorLoggingService } from "./errorLoggingService";
import { getAnalyticsService } from "./analyticsService";
import os from "os";
import { Server as SocketIOServer } from "socket.io";

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
    };
  };
  database: {
    connections: number;
    activeConnections: number;
    queryCount: number;
    responseTime: number;
    status: string;
  };
  application: {
    uptime: number;
    activeUsers: number;
    activeMeetings: number;
    activeRooms: number;
    totalConnections: number;
  };
  errors: {
    errorRate: number;
    warningRate: number;
    totalErrors: number;
    recentErrors: any[];
  };
}

export interface HealthStatus {
  overall: "healthy" | "warning" | "critical";
  services: {
    database: "healthy" | "warning" | "critical";
    application: "healthy" | "warning" | "critical";
    memory: "healthy" | "warning" | "critical";
    cpu: "healthy" | "warning" | "critical";
  };
  alerts: string[];
  recommendations: string[];
}

/**
 * System Monitoring Service
 * Real-time system health monitoring and performance tracking
 */
export class SystemMonitoringService {
  private io?: SocketIOServer;
  private metricsInterval?: NodeJS.Timeout;
  private metricsHistory: SystemMetrics[] = [];
  private readonly MAX_HISTORY = 1440; // 24 hours of minute-by-minute data

  constructor(io?: SocketIOServer) {
    this.io = io;
    this.startMonitoring();
  }

  /**
   * Start system monitoring
   */
  startMonitoring(): void {
    // Collect metrics every minute
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.addMetricsToHistory(metrics);

        // Broadcast to connected admin clients
        if (this.io) {
          this.io.to("admin-dashboard").emit("system-metrics", metrics);
        }

        // Check for alerts
        const healthStatus = this.evaluateSystemHealth(metrics);
        if (healthStatus.overall !== "healthy") {
          this.handleHealthAlert(healthStatus);
        }
      } catch (error) {
        console.error("Error collecting system metrics:", error);
        ErrorLoggingService.logError(
          "error",
          "Failed to collect system metrics",
          "SystemMonitoringService",
          {
            stack: error instanceof Error ? error.stack : undefined,
          },
        );
      }
    }, 60 * 1000); // Every minute

    console.log("📊 System monitoring service started");
  }

  /**
   * Stop system monitoring
   */
  stopMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    console.log("📊 System monitoring service stopped");
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();

    // CPU metrics
    const cpuUsage = this.calculateCpuUsage();
    const loadAverage = os.loadavg();
    const cores = os.cpus().length;

    // Memory metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Database metrics
    const dbMetrics = await this.getDatabaseMetrics();

    // Application metrics
    const appMetrics = await this.getApplicationMetrics();

    // Error metrics
    const errorMetrics = this.getErrorMetrics();

    return {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAverage,
        cores,
      },
      memory: {
        used: Math.round(usedMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        total: Math.round(totalMemory / 1024 / 1024),
        percentage: Math.round((usedMemory / totalMemory) * 100),
        heap: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      },
      database: dbMetrics,
      application: appMetrics,
      errors: errorMetrics,
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): HealthStatus {
    if (this.metricsHistory.length === 0) {
      return {
        overall: "warning",
        services: {
          database: "warning",
          application: "warning",
          memory: "warning",
          cpu: "warning",
        },
        alerts: ["No metrics data available"],
        recommendations: ["Wait for metrics collection to start"],
      };
    }

    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    return this.evaluateSystemHealth(latestMetrics);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter((m) => m.timestamp >= cutoff);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): {
    cpu: Array<{ time: string; usage: number }>;
    memory: Array<{ time: string; usage: number }>;
    database: Array<{
      time: string;
      responseTime: number;
      connections: number;
    }>;
    errors: Array<{ time: string; count: number }>;
  } {
    const history = this.getMetricsHistory(hours);

    return {
      cpu: history.map((m) => ({
        time: m.timestamp.toISOString(),
        usage: m.cpu.usage,
      })),
      memory: history.map((m) => ({
        time: m.timestamp.toISOString(),
        usage: m.memory.percentage,
      })),
      database: history.map((m) => ({
        time: m.timestamp.toISOString(),
        responseTime: m.database.responseTime,
        connections: m.database.connections,
      })),
      errors: history.map((m) => ({
        time: m.timestamp.toISOString(),
        count: m.errors.totalErrors,
      })),
    };
  }

  /**
   * Private helper methods
   */

  private calculateCpuUsage(): number {
    try {
      const cpus = os.cpus();

      if (!cpus || cpus.length === 0) return 0;

      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - Math.floor((100 * idle) / total);

      return Math.max(0, Math.min(100, usage));
    } catch (error) {
      return 0;
    }
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics["database"]> {
    let connections = 0;
    let activeConnections = 0;
    let queryCount = 0;
    let responseTime = 0;
    let status = "healthy";

    try {
      const start = Date.now();

      // Test database connectivity
      await prisma.$queryRaw`SELECT 1`;
      responseTime = Date.now() - start;

      // Get connection count
      try {
        const connectionResult = (await prisma.$queryRaw`
          SELECT count(*) as count 
          FROM pg_stat_activity
        `) as Array<{ count: bigint }>;

        connections = Number(connectionResult[0]?.count || 0);

        const activeResult = (await prisma.$queryRaw`
          SELECT count(*) as count 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `) as Array<{ count: bigint }>;

        activeConnections = Number(activeResult[0]?.count || 0);
      } catch (error) {
        // Fallback if pg_stat_activity is not accessible
        connections = 1;
        activeConnections = 1;
      }

      // Response time threshold check
      if (responseTime > 1000) {
        status = "warning";
      } else if (responseTime > 5000) {
        status = "critical";
      }
    } catch (error) {
      status = "critical";
      responseTime = -1;
      console.error("Database health check failed:", error);
    }

    return {
      connections,
      activeConnections,
      queryCount,
      responseTime,
      status,
    };
  }

  private async getApplicationMetrics(): Promise<SystemMetrics["application"]> {
    const uptime = Math.floor(process.uptime());

    try {
      const [activeUsers, activeMeetings, activeRooms, totalConnections] =
        await Promise.all([
          prisma.user.count({
            where: {
              isActive: true,
              lastLoginAt: {
                gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
              },
            },
          }),
          prisma.meeting.count({
            where: { status: "ACTIVE" },
          }),
          prisma.room.count({
            where: { isActive: true },
          }),
          prisma.meetingParticipant.count({
            where: {
              isPresent: true,
              lastPingAt: {
                gte: new Date(Date.now() - 60 * 1000), // Last minute
              },
            },
          }),
        ]);

      return {
        uptime,
        activeUsers,
        activeMeetings,
        activeRooms,
        totalConnections,
      };
    } catch (error) {
      console.error("Error getting application metrics:", error);
      return {
        uptime,
        activeUsers: 0,
        activeMeetings: 0,
        activeRooms: 0,
        totalConnections: 0,
      };
    }
  }

  private getErrorMetrics(): SystemMetrics["errors"] {
    const errors = ErrorLoggingService.getRecentErrors(undefined, 100);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentErrors = errors.filter((e) => e.createdAt >= oneHourAgo);
    const errorCount = recentErrors.filter((e) => e.level === "error").length;
    const warningCount = recentErrors.filter(
      (e) => e.level === "warning",
    ).length;

    return {
      errorRate: errorCount,
      warningRate: warningCount,
      totalErrors: recentErrors.length,
      recentErrors: errors.slice(0, 5), // Last 5 errors for dashboard
    };
  }

  private evaluateSystemHealth(metrics: SystemMetrics): HealthStatus {
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Evaluate each service
    const dbStatus = this.evaluateServiceHealth(
      "database",
      metrics,
      alerts,
      recommendations,
    );
    const appStatus = this.evaluateServiceHealth(
      "application",
      metrics,
      alerts,
      recommendations,
    );
    const memoryStatus = this.evaluateServiceHealth(
      "memory",
      metrics,
      alerts,
      recommendations,
    );
    const cpuStatus = this.evaluateServiceHealth(
      "cpu",
      metrics,
      alerts,
      recommendations,
    );

    // Determine overall status
    const statuses = [dbStatus, appStatus, memoryStatus, cpuStatus];
    const overall = statuses.includes("critical")
      ? "critical"
      : statuses.includes("warning")
        ? "warning"
        : "healthy";

    return {
      overall,
      services: {
        database: dbStatus,
        application: appStatus,
        memory: memoryStatus,
        cpu: cpuStatus,
      },
      alerts,
      recommendations,
    };
  }

  private evaluateServiceHealth(
    service: string,
    metrics: SystemMetrics,
    alerts: string[],
    recommendations: string[],
  ): "healthy" | "warning" | "critical" {
    switch (service) {
      case "database":
        if (metrics.database.status === "critical") {
          alerts.push("Database connection failed");
          recommendations.push("Check database server status");
          return "critical";
        }
        if (metrics.database.responseTime > 1000) {
          alerts.push(
            `Database response time high: ${metrics.database.responseTime}ms`,
          );
          recommendations.push(
            "Optimize database queries or increase resources",
          );
          return "warning";
        }
        return "healthy";

      case "memory":
        if (metrics.memory.percentage > 90) {
          alerts.push(`Memory usage critical: ${metrics.memory.percentage}%`);
          recommendations.push(
            "Restart application or increase memory allocation",
          );
          return "critical";
        }
        if (metrics.memory.percentage > 80) {
          alerts.push(`Memory usage high: ${metrics.memory.percentage}%`);
          recommendations.push("Monitor memory usage and consider scaling");
          return "warning";
        }
        return "healthy";

      case "cpu":
        if (metrics.cpu.usage > 90) {
          alerts.push(`CPU usage critical: ${metrics.cpu.usage}%`);
          recommendations.push("Scale application or optimize performance");
          return "critical";
        }
        if (metrics.cpu.usage > 80) {
          alerts.push(`CPU usage high: ${metrics.cpu.usage}%`);
          recommendations.push("Monitor CPU usage trends");
          return "warning";
        }
        return "healthy";

      case "application":
        if (metrics.errors.errorRate > 10) {
          alerts.push(
            `High error rate: ${metrics.errors.errorRate} errors/hour`,
          );
          recommendations.push("Check application logs and fix errors");
          return "warning";
        }
        return "healthy";

      default:
        return "healthy";
    }
  }

  private addMetricsToHistory(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);

    // Keep only the latest metrics within the limit
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory = this.metricsHistory.slice(-this.MAX_HISTORY);
    }
  }

  private handleHealthAlert(healthStatus: HealthStatus): void {
    const alertLevel =
      healthStatus.overall === "critical" ? "error" : "warning";
    const message = `System health ${healthStatus.overall}: ${healthStatus.alerts.join(", ")}`;

    ErrorLoggingService.logError(
      alertLevel,
      message,
      "SystemMonitoringService",
      { metadata: { healthStatus } },
    );

    // Broadcast alert to admin clients
    if (this.io) {
      this.io.to("admin-dashboard").emit("health-alert", {
        level: alertLevel,
        message,
        status: healthStatus,
      });
    }
  }
}

// Singleton instance
let monitoringServiceInstance: SystemMonitoringService | null = null;

export const initializeSystemMonitoring = (
  io?: SocketIOServer,
): SystemMonitoringService => {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new SystemMonitoringService(io);
  }
  return monitoringServiceInstance;
};

export const getSystemMonitoring = (): SystemMonitoringService | null => {
  return monitoringServiceInstance;
};

export default SystemMonitoringService;
