import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  FiBarChart,
  FiActivity,
  FiUsers,
  FiVideo,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiDownload,
  FiRefreshCw,
  FiCalendar,
  FiGlobe,
  FiHardDrive,
  FiWifi,
  FiCpu,
  FiMonitor,
} from "react-icons/fi";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import useAuthStore from "../../stores/authStore";

const SystemAnalytics = () => {
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({});

  // Sample analytics data
  useEffect(() => {
    const generateSampleData = () => {
      // Usage trends data
      const usageTrends = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        usageTrends.push({
          date: date.toISOString().split("T")[0],
          meetings: Math.floor(Math.random() * 50) + 20,
          users: Math.floor(Math.random() * 100) + 50,
          minutes: Math.floor(Math.random() * 2000) + 1000,
          bandwidth: Math.floor(Math.random() * 500) + 200,
        });
      }

      // User growth data
      const userGrowth = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        userGrowth.push({
          month: date.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          totalUsers: Math.floor(Math.random() * 200) + 100 + i * 20,
          activeUsers: Math.floor(Math.random() * 150) + 80 + i * 15,
          newUsers: Math.floor(Math.random() * 30) + 10,
        });
      }

      // Device usage data
      const deviceUsage = [
        { name: "Desktop", value: 45, color: "#8884d8" },
        { name: "Mobile", value: 30, color: "#82ca9d" },
        { name: "Tablet", value: 15, color: "#ffc658" },
        { name: "Other", value: 10, color: "#ff7300" },
      ];

      // Meeting quality data
      const meetingQuality = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        meetingQuality.push({
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          excellent: Math.floor(Math.random() * 30) + 40,
          good: Math.floor(Math.random() * 20) + 25,
          fair: Math.floor(Math.random() * 15) + 10,
          poor: Math.floor(Math.random() * 10) + 5,
        });
      }

      // Geographic distribution
      const geographicData = [
        { country: "United States", users: 245, percentage: 35 },
        { country: "United Kingdom", users: 180, percentage: 26 },
        { country: "Canada", users: 120, percentage: 17 },
        { country: "Australia", users: 85, percentage: 12 },
        { country: "Germany", users: 70, percentage: 10 },
      ];

      // System performance metrics
      const performanceMetrics = {
        cpuUsage: 68,
        memoryUsage: 74,
        diskUsage: 45,
        networkLatency: 12,
        uptime: 99.95,
        responseTime: 45,
      };

      return {
        overview: {
          totalMeetings: 1247,
          totalUsers: 856,
          totalMinutes: 45280,
          avgMeetingDuration: 36,
          peakConcurrentUsers: 89,
          totalBandwidth: 12.5,
        },
        usageTrends,
        userGrowth,
        deviceUsage,
        meetingQuality,
        geographicData,
        performanceMetrics,
      };
    };

    setTimeout(() => {
      setAnalyticsData(generateSampleData());
      setLoading(false);
    }, 1000);
  }, [timeRange]);

  const OverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Meetings
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.totalMeetings.toLocaleString()}
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success">
                  +12.3% from last month
                </span>
              </div>
            </div>
            <FiVideo className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Users
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.totalUsers.toLocaleString()}
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success">
                  +8.7% from last month
                </span>
              </div>
            </div>
            <FiUsers className="w-8 h-8 text-success" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Minutes
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.totalMinutes.toLocaleString()}
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success">
                  +15.2% from last month
                </span>
              </div>
            </div>
            <FiClock className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Avg Meeting Duration
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.avgMeetingDuration}min
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingDown className="w-4 h-4 text-destructive mr-1" />
                <span className="text-sm text-destructive">
                  -2.1% from last month
                </span>
              </div>
            </div>
            <FiActivity className="w-8 h-8 text-warning" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Peak Concurrent
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.peakConcurrentUsers}
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success">
                  +23.4% from last month
                </span>
              </div>
            </div>
            <FiMonitor className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Bandwidth Used
              </p>
              <p className="text-2xl font-bold">
                {analyticsData.overview?.totalBandwidth}TB
              </p>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success">
                  +9.8% from last month
                </span>
              </div>
            </div>
            <FiWifi className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const UsageTrendsChart = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <FiBarChart className="w-5 h-5 mr-2" />
            Usage Trends
          </CardTitle>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={analyticsData.usageTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="meetings"
              stroke="#8884d8"
              name="Daily Meetings"
            />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#82ca9d"
              name="Active Users"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const UserGrowthChart = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiUsers className="w-5 h-5 mr-2" />
          User Growth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analyticsData.userGrowth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="totalUsers"
              stackId="1"
              stroke="#8884d8"
              fill="#8884d8"
              name="Total Users"
            />
            <Area
              type="monotone"
              dataKey="activeUsers"
              stackId="2"
              stroke="#82ca9d"
              fill="#82ca9d"
              name="Active Users"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const DeviceUsageChart = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiMonitor className="w-5 h-5 mr-2" />
          Device Usage Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.deviceUsage}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {analyticsData.deviceUsage?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const MeetingQualityChart = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiActivity className="w-5 h-5 mr-2" />
          Meeting Quality Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.meetingQuality}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="excellent"
              stackId="a"
              fill="#22c55e"
              name="Excellent"
            />
            <Bar dataKey="good" stackId="a" fill="#84cc16" name="Good" />
            <Bar dataKey="fair" stackId="a" fill="#eab308" name="Fair" />
            <Bar dataKey="poor" stackId="a" fill="#ef4444" name="Poor" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const GeographicDistribution = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiGlobe className="w-5 h-5 mr-2" />
          Geographic Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analyticsData.geographicData?.map((country, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{country.country}</p>
                  <p className="text-sm text-muted-foreground">
                    {country.users} users
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${country.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium w-8">
                  {country.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const SystemPerformance = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiCpu className="w-5 h-5 mr-2" />
          System Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">CPU Usage</span>
                <span className="text-sm font-medium">
                  {analyticsData.performanceMetrics?.cpuUsage}%
                </span>
              </div>
              <Progress value={analyticsData.performanceMetrics?.cpuUsage} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Memory Usage</span>
                <span className="text-sm font-medium">
                  {analyticsData.performanceMetrics?.memoryUsage}%
                </span>
              </div>
              <Progress value={analyticsData.performanceMetrics?.memoryUsage} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Disk Usage</span>
                <span className="text-sm font-medium">
                  {analyticsData.performanceMetrics?.diskUsage}%
                </span>
              </div>
              <Progress value={analyticsData.performanceMetrics?.diskUsage} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Network Latency</span>
              <span className="text-sm font-bold text-success">
                {analyticsData.performanceMetrics?.networkLatency}ms
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">System Uptime</span>
              <span className="text-sm font-bold text-success">
                {analyticsData.performanceMetrics?.uptime}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Avg Response Time</span>
              <span className="text-sm font-bold text-primary">
                {analyticsData.performanceMetrics?.responseTime}ms
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Analytics</h1>
          <p className="text-muted-foreground">
            Monitor platform performance and usage metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <FiDownload className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <FiRefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <OverviewCards />

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-6">
          <UsageTrendsChart />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UserGrowthChart />
            <DeviceUsageChart />
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <MeetingQualityChart />
        </TabsContent>

        <TabsContent value="geographic" className="space-y-6">
          <GeographicDistribution />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <SystemPerformance />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemAnalytics;
