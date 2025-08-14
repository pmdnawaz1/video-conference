import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import useAdminStore from '../../stores/adminStore';
import useAuthStore from '../../stores/authStore';
import analyticsService from '../../services/analyticsService';

// Icons (using simple Unicode symbols for now, could be replaced with icon library)
const Icons = {
  Users: () => <span className="text-xl">👥</span>,
  Meetings: () => <span className="text-xl">🎥</span>,
  Analytics: () => <span className="text-xl">📊</span>,
  Settings: () => <span className="text-xl">⚙️</span>,
  Activity: () => <span className="text-xl">⚡</span>,
  Calendar: () => <span className="text-xl">📅</span>,
  Warning: () => <span className="text-xl">⚠️</span>,
  Success: () => <span className="text-xl">✅</span>,
  Info: () => <span className="text-xl">ℹ️</span>,
  Error: () => <span className="text-xl">❌</span>
};

const AdminDashboard = () => {
  const {
    dashboardData,
    systemHealth,
    isDashboardLoading,
    dashboardError,
    fetchDashboardOverview,
    fetchMeetingStats,
    fetchRecentMeetings,
    fetchUpcomingMeetings,
    fetchSystemHealth,
    getUsersCount,
    getActiveUsersCount,
    getAdminsCount
  } = useAdminStore();
  
  const { user } = useAuthStore();
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Auto-refresh dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        await Promise.all([
          fetchDashboardOverview(),
          fetchMeetingStats(),
          fetchRecentMeetings(),
          fetchUpcomingMeetings(),
          fetchSystemHealth()
        ]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };

    // Initial load
    loadDashboardData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Load system analytics
  useEffect(() => {
    const loadSystemAnalytics = async () => {
      try {
        const result = await analyticsService.getSystemAnalytics(selectedTimeframe);
        if (result.success) {
          setSystemAnalytics(result.data);
        }
      } catch (error) {
        console.error('Error loading system analytics:', error);
      }
    };

    loadSystemAnalytics();
  }, [selectedTimeframe]);

  const handleRefreshDashboard = async () => {
    try {
      await Promise.all([
        fetchDashboardOverview(),
        fetchMeetingStats(),
        fetchRecentMeetings(),
        fetchUpcomingMeetings()
      ]);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    }
  };

  const renderSystemHealthIndicator = (health) => {
    if (!health) return null;

    const getHealthColor = (score) => {
      if (score >= 90) return 'text-green-600 bg-green-100';
      if (score >= 70) return 'text-yellow-600 bg-yellow-100';
      return 'text-red-600 bg-red-100';
    };

    const getHealthIcon = (score) => {
      if (score >= 90) return <Icons.Success />;
      if (score >= 70) return <Icons.Warning />;
      return <Icons.Error />;
    };

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(health.overall_score)}`}>
        {getHealthIcon(health.overall_score)}
        <span className="ml-1">{health.overall_score}%</span>
      </div>
    );
  };

  const renderMetricCard = (title, value, subtitle, icon, trend = null) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className="text-2xl opacity-75">{icon}</div>
        </div>
        {trend && (
          <div className="mt-2 text-xs">
            <span className={trend.positive ? 'text-green-600' : 'text-red-600'}>
              {trend.positive ? '↗️' : '↘️'} {trend.percentage}%
            </span>
            <span className="text-gray-500 ml-1">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderRecentActivity = () => {
    const activities = [
      ...(dashboardData.recentMeetings?.slice(0, 3).map(meeting => ({
        type: 'meeting',
        title: `Meeting "${meeting.title}" started`,
        time: new Date(meeting.start_time).toLocaleTimeString(),
        user: meeting.created_by_name,
        status: meeting.status
      })) || []),
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Activity />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.length > 0 ? activities.map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-gray-500">by {activity.user} at {activity.time}</p>
                </div>
                <Badge variant={activity.status === 'active' ? 'success' : 'secondary'}>
                  {activity.status}
                </Badge>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSystemAlerts = () => {
    const alerts = systemHealth?.alerts || [];
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Warning />
            System Alerts
            {alerts.length > 0 && <Badge variant="destructive">{alerts.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.length > 0 ? alerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <Icons.Warning />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-gray-600">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.timestamp}</p>
                </div>
                <Button size="sm" variant="outline">
                  Resolve
                </Button>
              </div>
            )) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Icons.Success />
                <p className="text-sm text-green-700">All systems operational</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderUpcomingMeetings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icons.Calendar />
          Upcoming Meetings
        </CardTitle>
        <CardDescription>Next scheduled meetings across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dashboardData.upcomingMeetings?.slice(0, 5).map((meeting, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium">{meeting.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(meeting.scheduled_start).toLocaleString()} • {meeting.participant_count} participants
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">
                  {Math.ceil((new Date(meeting.scheduled_start) - new Date()) / (1000 * 60))} min
                </Badge>
              </div>
            </div>
          )) || (
            <p className="text-gray-500 text-center py-4">No upcoming meetings</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderQuickActions = () => (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-20 flex-col">
            <Icons.Users />
            <span className="text-xs mt-1">Manage Users</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col">
            <Icons.Meetings />
            <span className="text-xs mt-1">Create Meeting</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col">
            <Icons.Analytics />
            <span className="text-xs mt-1">View Analytics</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col">
            <Icons.Settings />
            <span className="text-xs mt-1">System Settings</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderAnalyticsChart = () => {
    if (!systemAnalytics) return null;

    return (
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icons.Analytics />
            System Analytics
          </CardTitle>
          <select 
            value={selectedTimeframe} 
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 3 months</option>
          </select>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{systemAnalytics.total_meetings || 0}</p>
              <p className="text-sm text-gray-500">Total Meetings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{systemAnalytics.active_users || 0}</p>
              <p className="text-sm text-gray-500">Active Users</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {Math.round((systemAnalytics.total_duration || 0) / 60)}h
              </p>
              <p className="text-sm text-gray-500">Total Duration</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {systemAnalytics.average_participants || 0}
              </p>
              <p className="text-sm text-gray-500">Avg. Participants</p>
            </div>
          </div>
          
          {/* Simple chart representation */}
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Icons.Analytics />
              <p className="text-gray-500 mt-2">Analytics Chart</p>
              <p className="text-xs text-gray-400">Chart visualization would go here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icons.Error />
          <p className="text-red-600 mt-2">Error loading dashboard</p>
          <p className="text-sm text-gray-500">{dashboardError}</p>
          <Button onClick={handleRefreshDashboard} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user?.name || 'Admin'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {renderSystemHealthIndicator(systemHealth)}
          <Button onClick={handleRefreshDashboard} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderMetricCard(
          'Total Users',
          getUsersCount(),
          `${getActiveUsersCount()} active`,
          <Icons.Users />,
          { positive: true, percentage: 12 }
        )}
        {renderMetricCard(
          'Active Meetings',
          dashboardData.meetingStats?.active_meetings || 0,
          'Right now',
          <Icons.Meetings />,
          { positive: false, percentage: 5 }
        )}
        {renderMetricCard(
          'Total Meetings Today',
          dashboardData.meetingStats?.todays_meetings || 0,
          'Since midnight',
          <Icons.Calendar />
        )}
        {renderMetricCard(
          'System Health',
          systemHealth ? `${systemHealth.overall_score}%` : 'N/A',
          'All systems',
          <Icons.Activity />,
          systemHealth ? { 
            positive: systemHealth.overall_score > 80, 
            percentage: Math.abs(systemHealth.trend || 0) 
          } : null
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {renderRecentActivity()}
          {renderSystemAlerts()}
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          {renderUpcomingMeetings()}
          {renderQuickActions()}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">CPU Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth?.cpu_usage || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth?.cpu_usage || 0}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Memory Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth?.memory_usage || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth?.memory_usage || 0}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Storage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth?.storage_usage || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth?.storage_usage || 0}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Icons.Users />
                  <span className="ml-2">User Management</span>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Icons.Settings />
                  <span className="ml-2">System Settings</span>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Icons.Analytics />
                  <span className="ml-2">Analytics Reports</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Chart Section */}
      {systemAnalytics && (
        <div className="grid grid-cols-1">
          {renderAnalyticsChart()}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;