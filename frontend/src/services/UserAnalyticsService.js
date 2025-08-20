class UserAnalyticsService {
  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.cache = new Map();
    this.eventQueue = [];
    this.isOnline = navigator.onLine;
    this.batchSize = 50;
    this.flushInterval = 30000; // 30 seconds

    // Start batch processing
    this.startBatchProcessor();

    // Listen for online/offline events
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flushEventQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  // Get authenticated headers
  getAuthHeaders(accessToken = null) {
    const token = accessToken || this.getAccessTokenFromStore();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  getAccessTokenFromStore() {
    const { useAuthStore } = require("../stores/authStore");
    return useAuthStore.getState().accessToken;
  }

  // Cache management
  getCacheKey(endpoint, params = {}) {
    const paramString = new URLSearchParams(params).toString();
    return `${endpoint}${paramString ? `?${paramString}` : ""}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  // Event tracking and queuing
  trackEvent(eventType, eventData) {
    const event = {
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId(),
    };

    this.eventQueue.push(event);

    // Flush if queue is getting full or if it's a critical event
    if (
      this.eventQueue.length >= this.batchSize ||
      this.isCriticalEvent(eventType)
    ) {
      this.flushEventQueue();
    }
  }

  isCriticalEvent(eventType) {
    const criticalEvents = [
      "meeting_joined",
      "meeting_left",
      "meeting_created",
      "user_login",
      "user_logout",
    ];
    return criticalEvents.includes(eventType);
  }

  async flushEventQueue() {
    if (this.eventQueue.length === 0 || !this.isOnline) return;

    const eventsToFlush = this.eventQueue.splice(0, this.batchSize);

    try {
      await this.sendAnalyticsEvents(eventsToFlush);
    } catch (error) {
      console.error("Failed to flush analytics events:", error);
      // Re-queue events if they failed to send
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  async sendAnalyticsEvents(events) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics/events`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ events }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send analytics events");
      }

      return result;
    } catch (error) {
      console.error("UserAnalyticsService: Error sending events:", error);
      throw error;
    }
  }

  startBatchProcessor() {
    setInterval(() => {
      this.flushEventQueue();
    }, this.flushInterval);
  }

  // User analytics data fetching
  async getUserAnalytics(timeframe = "month", useCache = true) {
    const cacheKey = this.getCacheKey("user/analytics", { timeframe });

    if (useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics?timeframe=${timeframe}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        this.setCache(cacheKey, result.data);
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to fetch user analytics",
        };
      }
    } catch (error) {
      console.error("UserAnalyticsService: Error fetching analytics:", error);
      return {
        success: false,
        error: "Network error - unable to fetch analytics",
      };
    }
  }

  async getParticipationTrends(timeframe = "month", metric = "meetings") {
    const cacheKey = this.getCacheKey("user/participation-trends", {
      timeframe,
      metric,
    });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics/participation-trends?timeframe=${timeframe}&metric=${metric}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        this.setCache(cacheKey, result.data);
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to fetch participation trends",
        };
      }
    } catch (error) {
      console.error(
        "UserAnalyticsService: Error fetching participation trends:",
        error,
      );
      return {
        success: false,
        error: "Network error - unable to fetch participation trends",
      };
    }
  }

  async getMeetingStats(timeframe = "month") {
    const cacheKey = this.getCacheKey("user/meeting-stats", { timeframe });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics/meeting-stats?timeframe=${timeframe}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        this.setCache(cacheKey, result.data);
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to fetch meeting statistics",
        };
      }
    } catch (error) {
      console.error(
        "UserAnalyticsService: Error fetching meeting stats:",
        error,
      );
      return {
        success: false,
        error: "Network error - unable to fetch meeting statistics",
      };
    }
  }

  async getEngagementMetrics(timeframe = "month") {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics/engagement?timeframe=${timeframe}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to fetch engagement metrics",
        };
      }
    } catch (error) {
      console.error(
        "UserAnalyticsService: Error fetching engagement metrics:",
        error,
      );
      return {
        success: false,
        error: "Network error - unable to fetch engagement metrics",
      };
    }
  }

  // Preferences management
  async getUserPreferences() {
    const cacheKey = this.getCacheKey("user/preferences");
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/users/preferences`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.setCache(cacheKey, result.data);
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to fetch user preferences",
        };
      }
    } catch (error) {
      console.error("UserAnalyticsService: Error fetching preferences:", error);
      return {
        success: false,
        error: "Network error - unable to fetch preferences",
      };
    }
  }

  async updateUserPreferences(preferences) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users/preferences`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(preferences),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Clear cache for preferences
        this.cache.delete(this.getCacheKey("user/preferences"));

        // Track preference update event
        this.trackEvent("preferences_updated", {
          updated_fields: Object.keys(preferences),
          timestamp: Date.now(),
        });

        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to update user preferences",
        };
      }
    } catch (error) {
      console.error("UserAnalyticsService: Error updating preferences:", error);
      return {
        success: false,
        error: "Network error - unable to update preferences",
      };
    }
  }

  // Specific event tracking methods
  trackMeetingJoined(meetingId, meetingTitle, joinMethod = "browser") {
    this.trackEvent("meeting_joined", {
      meeting_id: meetingId,
      meeting_title: meetingTitle,
      join_method: joinMethod,
      device_type: this.getDeviceType(),
      browser: this.getBrowserInfo(),
      connection_type: this.getConnectionType(),
    });
  }

  trackMeetingLeft(meetingId, duration, reason = "user_action") {
    this.trackEvent("meeting_left", {
      meeting_id: meetingId,
      duration_seconds: Math.floor(duration / 1000),
      leave_reason: reason,
      device_type: this.getDeviceType(),
    });
  }

  trackFeatureUsage(feature, action, metadata = {}) {
    this.trackEvent("feature_usage", {
      feature_name: feature,
      action: action,
      metadata: metadata,
      device_type: this.getDeviceType(),
    });
  }

  trackUserEngagement(engagementType, data = {}) {
    this.trackEvent("user_engagement", {
      engagement_type: engagementType,
      engagement_data: data,
      page_url: window.location.pathname,
      device_type: this.getDeviceType(),
    });
  }

  trackPerformanceMetric(metric, value, context = {}) {
    this.trackEvent("performance_metric", {
      metric_name: metric,
      metric_value: value,
      context: context,
      timestamp: Date.now(),
    });
  }

  trackError(error, context = {}) {
    this.trackEvent("error_occurred", {
      error_message: error.message || error,
      error_stack: error.stack || null,
      context: context,
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    });
  }

  // Meeting participation tracking
  async trackMeetingParticipation(meetingId, participationData) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/analytics/meeting-participation`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            meeting_id: meetingId,
            ...participationData,
            timestamp: Date.now(),
          }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: result.error || "Failed to track meeting participation",
        };
      }
    } catch (error) {
      console.error(
        "UserAnalyticsService: Error tracking participation:",
        error,
      );
      return {
        success: false,
        error: "Network error - unable to track participation",
      };
    }
  }

  // Utility methods
  getSessionId() {
    let sessionId = sessionStorage.getItem("analytics_session_id");
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem("analytics_session_id", sessionId);
    }
    return sessionId;
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getCurrentUserId() {
    try {
      const { useAuthStore } = require("../stores/authStore");
      return useAuthStore.getState().user?.id || null;
    } catch {
      return null;
    }
  }

  getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
    if (
      /mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
        ua,
      )
    )
      return "mobile";
    return "desktop";
  }

  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = "unknown";

    if (ua.includes("Chrome")) browser = "chrome";
    else if (ua.includes("Firefox")) browser = "firefox";
    else if (ua.includes("Safari")) browser = "safari";
    else if (ua.includes("Edge")) browser = "edge";
    else if (ua.includes("Opera")) browser = "opera";

    return {
      name: browser,
      user_agent: ua,
    };
  }

  getConnectionType() {
    if (navigator.connection) {
      return {
        effective_type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
      };
    }
    return null;
  }

  // Engagement scoring
  calculateEngagementScore(analytics) {
    if (!analytics) return 0;

    const weights = {
      meetings_attended: 0.3,
      average_meeting_duration: 0.2,
      chat_messages_sent: 0.15,
      features_used: 0.15,
      speaking_time_percentage: 0.1,
      punctuality_score: 0.1,
    };

    let score = 0;
    let maxScore = 0;

    // Meetings attended (0-100 based on frequency)
    if (analytics.meetings_attended !== undefined) {
      const meetingScore = Math.min(
        100,
        (analytics.meetings_attended / 30) * 100,
      ); // Max 30 meetings per month
      score += meetingScore * weights.meetings_attended;
      maxScore += 100 * weights.meetings_attended;
    }

    // Average meeting duration (0-100 based on how long they stay)
    if (analytics.average_meeting_duration !== undefined) {
      const durationScore = Math.min(
        100,
        (analytics.average_meeting_duration / 3600) * 100,
      ); // Max 1 hour
      score += durationScore * weights.average_meeting_duration;
      maxScore += 100 * weights.average_meeting_duration;
    }

    // Chat messages (0-100 based on activity)
    if (analytics.chat_messages_sent !== undefined) {
      const chatScore = Math.min(
        100,
        (analytics.chat_messages_sent / 100) * 100,
      ); // Max 100 messages
      score += chatScore * weights.chat_messages_sent;
      maxScore += 100 * weights.chat_messages_sent;
    }

    // Features used (0-100 based on variety)
    if (analytics.features_used !== undefined) {
      const featureScore = Math.min(100, (analytics.features_used / 10) * 100); // Max 10 different features
      score += featureScore * weights.features_used;
      maxScore += 100 * weights.features_used;
    }

    // Speaking time percentage
    if (analytics.speaking_time_percentage !== undefined) {
      const speakingScore = Math.min(100, analytics.speaking_time_percentage);
      score += speakingScore * weights.speaking_time_percentage;
      maxScore += 100 * weights.speaking_time_percentage;
    }

    // Punctuality score
    if (analytics.punctuality_score !== undefined) {
      score += analytics.punctuality_score * weights.punctuality_score;
      maxScore += 100 * weights.punctuality_score;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  // Data aggregation methods
  aggregateWeeklyData(dailyData) {
    if (!Array.isArray(dailyData) || dailyData.length === 0) return [];

    const weeks = {};

    dailyData.forEach((day) => {
      const date = new Date(day.date);
      const weekStart = this.getWeekStart(date);
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          week_start: weekKey,
          meetings: 0,
          duration: 0,
          chat_messages: 0,
          days_active: 0,
        };
      }

      weeks[weekKey].meetings += day.meetings || 0;
      weeks[weekKey].duration += day.duration || 0;
      weeks[weekKey].chat_messages += day.chat_messages || 0;
      if (day.meetings > 0) weeks[weekKey].days_active += 1;
    });

    return Object.values(weeks).sort(
      (a, b) => new Date(a.week_start) - new Date(b.week_start),
    );
  }

  aggregateMonthlyData(weeklyData) {
    if (!Array.isArray(weeklyData) || weeklyData.length === 0) return [];

    const months = {};

    weeklyData.forEach((week) => {
      const date = new Date(week.week_start);
      const monthKey =
        date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");

      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthKey,
          meetings: 0,
          duration: 0,
          chat_messages: 0,
          weeks_active: 0,
        };
      }

      months[monthKey].meetings += week.meetings || 0;
      months[monthKey].duration += week.duration || 0;
      months[monthKey].chat_messages += week.chat_messages || 0;
      if (week.meetings > 0) months[monthKey].weeks_active += 1;
    });

    return Object.values(months).sort(
      (a, b) => new Date(a.month + "-01") - new Date(b.month + "-01"),
    );
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Export methods
  async exportAnalyticsData(format = "json", timeframe = "month") {
    try {
      const analytics = await this.getUserAnalytics(timeframe, false);
      const trends = await this.getParticipationTrends(timeframe, "meetings");
      const stats = await this.getMeetingStats(timeframe);

      const exportData = {
        analytics: analytics.success ? analytics.data : null,
        trends: trends.success ? trends.data : null,
        stats: stats.success ? stats.data : null,
        exported_at: new Date().toISOString(),
        timeframe: timeframe,
        user_id: this.getCurrentUserId(),
      };

      if (format === "csv") {
        return this.convertToCSV(exportData);
      }

      return exportData;
    } catch (error) {
      console.error("Error exporting analytics data:", error);
      throw error;
    }
  }

  convertToCSV(data) {
    // Simplified CSV conversion for analytics data
    const rows = [];
    const headers = [
      "Date",
      "Meetings",
      "Duration (min)",
      "Chat Messages",
      "Engagement Score",
    ];
    rows.push(headers.join(","));

    if (data.trends && data.trends.length > 0) {
      data.trends.forEach((trend) => {
        const row = [
          trend.date || trend.week_start || trend.month,
          trend.meetings || 0,
          Math.round((trend.duration || 0) / 60),
          trend.chat_messages || 0,
          trend.engagement_score || 0,
        ];
        rows.push(row.join(","));
      });
    }

    return rows.join("");
  }

  // Cleanup methods
  clearCache() {
    this.cache.clear();
  }

  flushAndStop() {
    this.flushEventQueue();
    // Clear any remaining events
    this.eventQueue = [];
  }
}

// Singleton instance
const userAnalyticsService = new UserAnalyticsService();

export default userAnalyticsService;
