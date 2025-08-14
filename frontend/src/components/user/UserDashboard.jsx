import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Calendar,
  Clock,
  Users,
  Video,
  TrendingUp,
  Bell,
  Settings,
  Play,
  Pause,
  MoreHorizontal,
  ChevronRight,
  Star,
  Award,
  Activity,
  MessageSquare,
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  PieChart,
  CalendarDays,
  Timer,
  Mic,
  Camera,
  Share2,
  BookOpen,
  Sparkles,
  Building,
  Mail,
  Phone
} from 'lucide-react';
import useUserStore from '../../stores/userStore';
import useAuthStore from '../../stores/authStore';
import userAnalyticsService from '../../services/UserAnalyticsService';
import LoadingSpinner from '../ui/LoadingSpinner';

const UserDashboard = () => {
  const { user } = useAuthStore();
  const { 
    dashboardData, 
    analytics, 
    fetchDashboardData, 
    fetchAnalytics,
    isLoading,
    isDashboardLoading,
    isAnalyticsLoading 
  } = useUserStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('month');
  const [quickJoinId, setQuickJoinId] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Track dashboard view
    userAnalyticsService.trackEvent('dashboard_viewed', {
      section: 'user_dashboard',
      timestamp: Date.now()
    });
  }, []);

  const loadDashboardData = async () => {
    await Promise.all([
      fetchDashboardData(),
      fetchAnalytics(selectedTimeframe)
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
      userAnalyticsService.trackEvent('dashboard_refreshed', {
        timestamp: Date.now()
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickJoin = () => {
    if (quickJoinId.trim()) {
      window.location.href = `/meeting/${quickJoinId.trim()}`;
      userAnalyticsService.trackEvent('quick_join_used', {
        meeting_id: quickJoinId.trim(),
        timestamp: Date.now()
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getEngagementColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user?.profile_picture} />
              <AvatarFallback className="text-lg font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {getGreeting()}, {user?.first_name}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Building className="w-4 h-4" />
                {user?.organization?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="border-2 border-dashed border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Join</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Meeting ID"
                    value={quickJoinId}
                    onChange={(e) => setQuickJoinId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQuickJoin()}
                    className="flex-1"
                  />
                  <Button onClick={handleQuickJoin} disabled={!quickJoinId.trim()}>
                    <Video className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button className="h-auto p-4 flex flex-col items-center gap-2" variant="outline">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div className="text-center">
                  <div className="font-medium">Schedule Meeting</div>
                  <div className="text-xs text-gray-500">Plan ahead</div>
                </div>
              </Button>

              <Button className="h-auto p-4 flex flex-col items-center gap-2" variant="outline">
                <Zap className="w-6 h-6 text-green-600" />
                <div className="text-center">
                  <div className="font-medium">Instant Meeting</div>
                  <div className="text-xs text-gray-500">Start now</div>
                </div>
              </Button>

              <Button className="h-auto p-4 flex flex-col items-center gap-2" variant="outline">
                <Share2 className="w-6 h-6 text-purple-600" />
                <div className="text-center">
                  <div className="font-medium">Share Screen</div>
                  <div className="text-xs text-gray-500">Present content</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Schedule */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    Today's Schedule
                  </CardTitle>
                  <CardDescription>
                    {dashboardData?.todaysMeetings?.length || 0} meetings scheduled
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Calendar
                </Button>
              </CardHeader>
              <CardContent>
                {isDashboardLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : dashboardData?.todaysMeetings?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.todaysMeetings.slice(0, 5).map((meeting, index) => (
                      <div key={meeting.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">{meeting.title}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(meeting.scheduled_start)}
                              <Users className="w-3 h-3 ml-2" />
                              {meeting.participants_count || 0} participants
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={meeting.status === 'active' ? 'default' : 'secondary'}>
                            {meeting.status}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Video className="w-4 h-4 mr-1" />
                            Join
                          </Button>
                        </div>
                      </div>
                    ))}
                    {dashboardData.todaysMeetings.length > 5 && (
                      <Button variant="ghost" className="w-full">
                        View {dashboardData.todaysMeetings.length - 5} more meetings
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No meetings scheduled for today</p>
                    <p className="text-sm">Time to focus or schedule something new!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Your latest meeting activities and interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {dashboardData?.recentActivity?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.recentActivity.map((activity, index) => (
                        <div key={activity.id || index} className="flex items-start gap-3 p-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            {activity.type === 'meeting_joined' && <Video className="w-4 h-4 text-blue-600" />}
                            {activity.type === 'chat_sent' && <MessageSquare className="w-4 h-4 text-green-600" />}
                            {activity.type === 'file_shared' && <FileText className="w-4 h-4 text-purple-600" />}
                            {activity.type === 'recording_viewed' && <Play className="w-4 h-4 text-orange-600" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{activity.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(activity.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-sm">Your activities will appear here</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Analytics Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Your Meeting Analytics
                </CardTitle>
                <CardDescription>
                  Performance insights for the past {selectedTimeframe}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAnalyticsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : analytics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{analytics.totalMeetings || 0}</div>
                      <div className="text-sm text-gray-500">Meetings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatDuration(analytics.totalMinutes * 60 || 0)}
                      </div>
                      <div className="text-sm text-gray-500">Total Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(analytics.averageParticipation || 0)}%
                      </div>
                      <div className="text-sm text-gray-500">Participation</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getEngagementColor(analytics.engagementScore || 0).split(' ')[0]}`}>
                        {analytics.engagementScore || 0}
                      </div>
                      <div className="text-sm text-gray-500">Engagement</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <PieChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No analytics data available</p>
                    <p className="text-sm">Join some meetings to see your stats!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Upcoming</span>
                  </div>
                  <Badge variant="outline">
                    {dashboardData?.upcomingMeetings?.length || 0}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Notifications</span>
                  </div>
                  <Badge variant="outline">
                    {dashboardData?.notifications?.filter(n => !n.read).length || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-green-500" />
                    <span className="text-sm">This Week</span>
                  </div>
                  <Badge variant="outline">
                    {analytics?.weeklyStats?.meetings || 0} meetings
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Trend</span>
                  </div>
                  <Badge variant={analytics?.participationTrends?.slice(-1)[0]?.change > 0 ? 'default' : 'secondary'}>
                    {analytics?.participationTrends?.slice(-1)[0]?.change > 0 ? '↗' : '↘'} 
                    {Math.abs(analytics?.participationTrends?.slice(-1)[0]?.change || 0)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Engagement Score
                </CardTitle>
                <CardDescription>
                  Based on your participation and activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getEngagementColor(analytics?.engagementScore || 0).split(' ')[0]}`}>
                    {analytics?.engagementScore || 0}
                  </div>
                  <div className="text-sm text-gray-500">out of 100</div>
                </div>
                
                <Progress 
                  value={analytics?.engagementScore || 0} 
                  className="w-full"
                />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Meeting Attendance</span>
                    <span className="font-medium">
                      {Math.round((analytics?.totalMeetings || 0) / 30 * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Participation Rate</span>
                    <span className="font-medium">
                      {Math.round(analytics?.averageParticipation || 0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Speaking Time</span>
                    <span className="font-medium">
                      {Math.round(analytics?.speakingTimePercentage || 0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notifications
                </CardTitle>
                <Badge variant="outline">
                  {dashboardData?.notifications?.filter(n => !n.read).length || 0} new
                </Badge>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {dashboardData?.notifications?.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.notifications.slice(0, 8).map((notification, index) => (
                        <div 
                          key={notification.id || index} 
                          className={`p-2 rounded text-sm ${!notification.read ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500' : 'opacity-60'}`}
                        >
                          <div className="font-medium">{notification.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(notification.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Upcoming Meetings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Next Up
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.upcomingMeetings?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.upcomingMeetings.slice(0, 3).map((meeting, index) => (
                      <div key={meeting.id || index} className="p-3 border rounded-lg">
                        <div className="font-medium text-sm">{meeting.title}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {formatDate(meeting.scheduled_start)}
                        </div>
                        <Button size="sm" className="w-full mt-2">
                          <Video className="w-3 h-3 mr-1" />
                          Join
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming meetings</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section - Tips and Getting Started */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Getting Started Tips
            </CardTitle>
            <CardDescription>
              Make the most of your video conferencing experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">Test Your Audio</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Check your microphone before joining important meetings
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">Camera Position</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Position your camera at eye level for better video quality
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">Customize Settings</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Set your preferences for notifications and meeting defaults
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;