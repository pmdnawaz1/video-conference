/**
 * Analytics Service
 * Handles real-time analytics data fetching, caching, and transformation
 * Connects with backend analytics APIs and provides optimized data queries
 */

class AnalyticsService {
  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.cache = new Map();
    this.realTimeSubscriptions = new Map();
    this.isOnline = navigator.onLine;
    
    // WebSocket for real-time analytics updates
    this.wsConnection = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Setup online/offline listeners
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.initializeWebSocket();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.disconnectWebSocket();
    });
    
    // Initialize WebSocket connection for real-time updates
    this.initializeWebSocket();
  }

  // ===========================================
  // Authentication and Headers
  // ===========================================
  
  getAuthHeaders(accessToken = null) {
    const token = accessToken || this.getAccessTokenFromStore();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  getAccessTokenFromStore() {
    try {
      const { useAuthStore } = require('../stores/authStore');
      return useAuthStore.getState().accessToken;
    } catch {
      return null;
    }
  }

  // ===========================================
  // Cache Management
  // ===========================================
  
  getCacheKey(endpoint, params = {}) {
    const paramString = new URLSearchParams(params).toString();
    return `${endpoint}${paramString ? `?${paramString}` : ''}`;
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
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // ===========================================
  // WebSocket Real-time Updates
  // ===========================================
  
  initializeWebSocket() {
    if (!this.isOnline || this.wsConnection) return;

    try {
      const wsUrl = `${import.meta.env.VITE_WS_URL}/analytics`;
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('Analytics WebSocket connected');
        this.wsReconnectAttempts = 0;
        
        // Authenticate WebSocket connection
        const token = this.getAccessTokenFromStore();
        if (token) {
          this.wsConnection.send(JSON.stringify({
            type: 'authenticate',
            token: token
          }));
        }
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleRealtimeUpdate(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.wsConnection.onclose = () => {
        console.log('Analytics WebSocket disconnected');
        this.wsConnection = null;
        this.attemptReconnect();
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('Analytics WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize analytics WebSocket:', error);
    }
  }

  disconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  attemptReconnect() {
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts || !this.isOnline) {
      return;
    }
    
    this.wsReconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
    
    setTimeout(() => {
      this.initializeWebSocket();
    }, delay);
  }

  handleRealtimeUpdate(message) {
    const { type, data, timestamp } = message;
    
    // Invalidate related cache entries
    this.invalidateCache(type);
    
    // Notify subscribers
    if (this.realTimeSubscriptions.has(type)) {
      const subscribers = this.realTimeSubscriptions.get(type);
      subscribers.forEach(callback => callback(data, timestamp));
    }
  }

  subscribeToUpdates(type, callback) {
    if (!this.realTimeSubscriptions.has(type)) {
      this.realTimeSubscriptions.set(type, new Set());
    }
    this.realTimeSubscriptions.get(type).add(callback);
    
    // Send subscription message to WebSocket
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'subscribe',
        analytics_type: type
      }));
    }
    
    return () => {
      this.unsubscribeFromUpdates(type, callback);
    };
  }

  unsubscribeFromUpdates(type, callback) {
    if (this.realTimeSubscriptions.has(type)) {
      this.realTimeSubscriptions.get(type).delete(callback);
      
      if (this.realTimeSubscriptions.get(type).size === 0) {
        this.realTimeSubscriptions.delete(type);
        
        // Send unsubscription message to WebSocket
        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
          this.wsConnection.send(JSON.stringify({
            type: 'unsubscribe',
            analytics_type: type
          }));
        }
      }
    }
  }

  invalidateCache(type) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(type.replace('_', '-'))) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // ===========================================
  // User Analytics APIs
  // ===========================================
  
  async getUserAnalytics(timeframe = 'month', useCache = true) {
    const cacheKey = this.getCacheKey('user/analytics', { timeframe });
    
    if (useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/users/analytics?timeframe=${timeframe}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformUserAnalytics(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch user analytics'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching user analytics:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch analytics'
      };
    }
  }

  async getParticipationTrends(timeframe = 'month', metric = 'meetings') {
    const cacheKey = this.getCacheKey('user/participation-trends', { timeframe, metric });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/users/analytics/participation-trends?timeframe=${timeframe}&metric=${metric}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformTrendsData(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch participation trends'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching participation trends:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch participation trends'
      };
    }
  }

  async getMeetingStats(timeframe = 'month', breakdown = 'daily') {
    const cacheKey = this.getCacheKey('user/meeting-stats', { timeframe, breakdown });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/users/analytics/meeting-stats?timeframe=${timeframe}&breakdown=${breakdown}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformMeetingStats(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch meeting statistics'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching meeting stats:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch meeting statistics'
      };
    }
  }

  async getEngagementMetrics(timeframe = 'month') {
    const cacheKey = this.getCacheKey('user/engagement-metrics', { timeframe });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/users/analytics/engagement?timeframe=${timeframe}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformEngagementMetrics(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch engagement metrics'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching engagement metrics:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch engagement metrics'
      };
    }
  }

  // ===========================================
  // Admin Analytics APIs
  // ===========================================
  
  async getSystemAnalytics(timeframe = 'month', useCache = true) {
    const cacheKey = this.getCacheKey('admin/system-analytics', { timeframe });
    
    if (useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/analytics/system?timeframe=${timeframe}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformSystemAnalytics(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch system analytics'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching system analytics:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch system analytics'
      };
    }
  }

  async getUserEngagementReport(timeframe = 'month', groupBy = 'department') {
    const cacheKey = this.getCacheKey('admin/user-engagement', { timeframe, groupBy });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/analytics/user-engagement?timeframe=${timeframe}&group_by=${groupBy}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformUserEngagementReport(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch user engagement report'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching user engagement report:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch user engagement report'
      };
    }
  }

  async getMeetingUtilizationStats(timeframe = 'month') {
    const cacheKey = this.getCacheKey('admin/meeting-utilization', { timeframe });
    const cached = this.getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/analytics/meeting-utilization?timeframe=${timeframe}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const transformedData = this.transformMeetingUtilization(result.data);
        this.setCache(cacheKey, transformedData);
        return { success: true, data: transformedData };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch meeting utilization stats'
        };
      }

    } catch (error) {
      console.error('AnalyticsService: Error fetching meeting utilization:', error);
      return {
        success: false,
        error: 'Network error - unable to fetch meeting utilization'
      };
    }
  }

  // ===========================================
  // Data Transformation Methods
  // ===========================================
  
  transformUserAnalytics(data) {
    return {
      ...data,
      // Add computed fields
      averageSessionDuration: this.calculateAverageSessionDuration(data),
      engagementTrend: this.calculateEngagementTrend(data.weekly_stats || []),
      peakActivityHours: this.identifyPeakHours(data.hourly_activity || []),
      // Format numbers for display
      totalMeetings: this.formatNumber(data.total_meetings),
      totalDuration: this.formatDuration(data.total_duration_minutes),
      // Chart-ready data
      chartData: this.prepareChartData(data)
    };
  }

  transformTrendsData(data) {
    if (!Array.isArray(data)) return data;
    
    return data.map(trend => ({
      ...trend,
      // Format dates consistently
      date: this.formatDate(trend.date),
      // Add percentage changes
      changePercent: this.calculatePercentageChange(trend),
      // Prepare for visualization
      displayValue: this.formatNumber(trend.value),
      trend: this.identifyTrend(trend)
    }));
  }

  transformMeetingStats(data) {
    return {
      ...data,
      // Add aggregated metrics
      totalMeetingHours: this.calculateTotalHours(data.meetings || []),
      averageParticipants: this.calculateAverageParticipants(data.meetings || []),
      peakUsageDay: this.identifyPeakUsageDay(data.daily_stats || []),
      // Format for charts
      timeSeriesData: this.prepareTimeSeriesData(data.daily_stats || []),
      participantDistribution: this.prepareParticipantDistribution(data.meetings || [])
    };
  }

  transformEngagementMetrics(data) {
    return {
      ...data,
      // Calculate composite engagement score
      overallScore: this.calculateOverallEngagementScore(data),
      // Identify engagement patterns
      engagementPatterns: this.identifyEngagementPatterns(data),
      // Prepare recommendation data
      recommendations: this.generateEngagementRecommendations(data),
      // Format for visualization
      radarChartData: this.prepareRadarChartData(data),
      trendChartData: this.prepareEngagementTrendData(data)
    };
  }

  transformSystemAnalytics(data) {
    return {
      ...data,
      // System health indicators
      healthScore: this.calculateSystemHealthScore(data),
      performanceMetrics: this.transformPerformanceMetrics(data.performance || {}),
      // Resource utilization
      resourceUtilization: this.calculateResourceUtilization(data),
      // Growth metrics
      growthMetrics: this.calculateGrowthMetrics(data),
      // Alert thresholds
      alerts: this.checkSystemAlerts(data)
    };
  }

  transformUserEngagementReport(data) {
    if (!Array.isArray(data)) return data;
    
    return {
      summary: this.calculateEngagementSummary(data),
      groupedData: data.map(group => ({
        ...group,
        engagementLevel: this.categorizeEngagementLevel(group.average_score),
        trendIndicator: this.calculateTrendIndicator(group.trend_data || []),
        recommendations: this.generateGroupRecommendations(group)
      })),
      // Prepare for charts
      comparisonChart: this.prepareEngagementComparisonChart(data),
      distributionChart: this.prepareEngagementDistributionChart(data)
    };
  }

  transformMeetingUtilization(data) {
    return {
      ...data,
      // Utilization rates
      roomUtilizationRate: this.calculateRoomUtilization(data),
      peakHours: this.identifyPeakUtilizationHours(data),
      // Efficiency metrics
      efficiencyScore: this.calculateMeetingEfficiencyScore(data),
      optimizationSuggestions: this.generateOptimizationSuggestions(data),
      // Capacity planning
      capacityForecast: this.generateCapacityForecast(data)
    };
  }

  // ===========================================
  // Utility Calculation Methods
  // ===========================================
  
  calculateAverageSessionDuration(data) {
    if (!data.total_sessions || data.total_sessions === 0) return 0;
    return Math.round((data.total_duration_minutes || 0) / data.total_sessions);
  }

  calculateEngagementTrend(weeklyStats) {
    if (!Array.isArray(weeklyStats) || weeklyStats.length < 2) return 'stable';
    
    const recent = weeklyStats.slice(-2);
    const change = ((recent[1].engagement_score - recent[0].engagement_score) / recent[0].engagement_score) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  identifyPeakHours(hourlyActivity) {
    if (!Array.isArray(hourlyActivity)) return [];
    
    return hourlyActivity
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 3)
      .map(hour => ({
        hour: hour.hour,
        activity: hour.activity,
        formatted: this.formatHour(hour.hour)
      }));
  }

  calculatePercentageChange(trend) {
    if (!trend.previous_value || trend.previous_value === 0) return 0;
    return Math.round(((trend.value - trend.previous_value) / trend.previous_value) * 100);
  }

  identifyTrend(trend) {
    const change = this.calculatePercentageChange(trend);
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  calculateTotalHours(meetings) {
    return meetings.reduce((total, meeting) => total + (meeting.duration_minutes || 0), 0) / 60;
  }

  calculateAverageParticipants(meetings) {
    if (meetings.length === 0) return 0;
    return Math.round(meetings.reduce((total, meeting) => total + (meeting.participant_count || 0), 0) / meetings.length);
  }

  calculateOverallEngagementScore(data) {
    const weights = {
      participation_rate: 0.3,
      interaction_frequency: 0.2,
      session_duration: 0.2,
      feature_usage: 0.15,
      feedback_score: 0.15
    };

    let score = 0;
    let totalWeight = 0;

    Object.keys(weights).forEach(key => {
      if (data[key] !== undefined) {
        score += data[key] * weights[key];
        totalWeight += weights[key];
      }
    });

    return totalWeight > 0 ? Math.round(score / totalWeight) : 0;
  }

  calculateSystemHealthScore(data) {
    const metrics = [
      data.uptime_percentage || 0,
      data.response_time_score || 0,
      data.error_rate_score || 0,
      data.capacity_score || 0
    ];

    return Math.round(metrics.reduce((sum, metric) => sum + metric, 0) / metrics.length);
  }

  // ===========================================
  // Chart Data Preparation Methods
  // ===========================================
  
  prepareChartData(data) {
    return {
      timeSeriesData: this.prepareTimeSeriesData(data.daily_stats || []),
      pieChartData: this.preparePieChartData(data),
      barChartData: this.prepareBarChartData(data),
      lineChartData: this.prepareLineChartData(data.trends || [])
    };
  }

  prepareTimeSeriesData(dailyStats) {
    return dailyStats.map(stat => ({
      date: this.formatDate(stat.date),
      value: stat.value || 0,
      label: this.formatDateForChart(stat.date)
    }));
  }

  prepareRadarChartData(data) {
    return [
      { metric: 'Participation', value: data.participation_rate || 0 },
      { metric: 'Interaction', value: data.interaction_frequency || 0 },
      { metric: 'Duration', value: data.session_duration_score || 0 },
      { metric: 'Features', value: data.feature_usage_score || 0 },
      { metric: 'Feedback', value: data.feedback_score || 0 }
    ];
  }

  // ===========================================
  // Formatting Methods
  // ===========================================
  
  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  formatDuration(minutes) {
    if (!minutes) return '0m';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateForChart(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  // ===========================================
  // Export and Utility Methods
  // ===========================================
  
  async exportAnalyticsData(type = 'user', format = 'csv', timeframe = 'month') {
    try {
      const response = await fetch(`${this.apiBaseUrl}/analytics/export`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          type,
          format,
          timeframe,
          timestamp: Date.now()
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${type}-${timeframe}-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
      } else {
        const result = await response.json();
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      return { success: false, error: 'Export failed' };
    }
  }

  // Cleanup method
  destroy() {
    this.disconnectWebSocket();
    this.clearCache();
    this.realTimeSubscriptions.clear();
    
    window.removeEventListener('online', this.initializeWebSocket);
    window.removeEventListener('offline', this.disconnectWebSocket);
  }
}

// Singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;