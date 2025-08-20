import React, { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  FiAward,
  FiServer,
  FiDatabase,
  FiActivity,
  FiUsers,
  FiShield,
  FiSettings,
  FiAlertTriangle,
  FiXCircle,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiHardDrive,
  FiCpu,
  FiWifi,
  FiRefreshCw,
} from "react-icons/fi";
import { FaBuilding, FaCheckCircle } from "react-icons/fa";
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
import useAuthStore from "../stores/authStore";

const SuperAdminPage = () => {
  const { user } = useAuthStore();
  const [systemStats, setSystemStats] = useState({});
  const [organizationStats, setOrganizationStats] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sample data - replace with actual API calls
  useEffect(() => {
    const sampleSystemStats = {
      totalOrganizations: 45,
      totalUsers: 1247,
      totalMeetings: 8932,
      totalStorage: 2.4, // TB
      activeConnections: 342,
      serverUptime: 99.97,
      systemHealth: "excellent",
    };

    const sampleOrgStats = [
      {
        id: "1",
        name: "Quibic Gen",
        domain: "quibic-gen.com",
        users: 12,
        meetings: 45,
        storage: 128, // MB
        plan: "Enterprise",
        status: "active",
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: "2",
        name: "TechCorp Solutions",
        domain: "techcorp.io",
        users: 89,
        meetings: 234,
        storage: 1200,
        plan: "Professional",
        status: "active",
        lastActivity: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: "3",
        name: "Startup Inc",
        domain: "startup-inc.com",
        users: 25,
        meetings: 67,
        storage: 450,
        plan: "Starter",
        status: "trial",
        lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];

    const samplePerformanceData = [
      { time: "00:00", cpu: 45, memory: 62, connections: 120, bandwidth: 78 },
      { time: "04:00", cpu: 32, memory: 58, connections: 95, bandwidth: 65 },
      { time: "08:00", cpu: 78, memory: 71, connections: 280, bandwidth: 92 },
      { time: "12:00", cpu: 85, memory: 76, connections: 340, bandwidth: 98 },
      { time: "16:00", cpu: 92, memory: 82, connections: 380, bandwidth: 105 },
      { time: "20:00", cpu: 67, memory: 69, connections: 220, bandwidth: 87 },
    ];

    const sampleAlerts = [
      {
        id: "1",
        type: "warning",
        title: "High Memory Usage",
        message: "Server memory usage has exceeded 85% for the past 30 minutes",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        resolved: false,
      },
      {
        id: "2",
        type: "info",
        title: "Scheduled Maintenance",
        message: "System maintenance scheduled for tomorrow at 2:00 AM UTC",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        resolved: false,
      },
      {
        id: "3",
        type: "success",
        title: "Backup Completed",
        message: "Daily backup process completed successfully",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        resolved: true,
      },
    ];

    setTimeout(() => {
      setSystemStats(sampleSystemStats);
      setOrganizationStats(sampleOrgStats);
      setPerformanceData(samplePerformanceData);
      setAlerts(sampleAlerts);
      setLoading(false);
    }, 1000);
  }, []);

  const getHealthColor = (health) => {
    switch (health) {
      case "excellent":
        return "text-success";
      case "good":
        return "text-primary";
      case "warning":
        return "text-warning";
      case "critical":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "badge-success";
      case "trial":
        return "badge-primary";
      case "suspended":
        return "badge-destructive";
      case "inactive":
        return "badge-gray";
      default:
        return "badge-gray";
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case "Enterprise":
        return "badge-warning";
      case "Professional":
        return "badge-primary";
      case "Starter":
        return "badge-success";
      default:
        return "badge-gray";
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "warning":
        return <FiAlertTriangle className="w-4 h-4 text-warning" />;
      case "error":
        return <FiXCircle className="w-4 h-4 text-destructive" />;
      case "success":
        return <FaCheckCircle className="w-4 h-4 text-success" />;
      default:
        return <FiActivity className="w-4 h-4 text-primary" />;
    }
  };

  const SystemOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Organizations
              </p>
              <p className="text-2xl font-bold">
                {systemStats.totalOrganizations}
              </p>
            </div>
            <FaBuilding className="w-8 h-8 text-primary" />
          </div>
          <div className="flex items-center mt-2">
            <FiTrendingUp className="w-4 h-4 text-success mr-1" />
            <span className="text-sm text-success">+12% from last month</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Users
              </p>
              <p className="text-2xl font-bold">
                {systemStats.totalUsers?.toLocaleString()}
              </p>
            </div>
            <FiUsers className="w-8 h-8 text-success" />
          </div>
          <div className="flex items-center mt-2">
            <FiTrendingUp className="w-4 h-4 text-success mr-1" />
            <span className="text-sm text-success">+8% from last month</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Connections
              </p>
              <p className="text-2xl font-bold">
                {systemStats.activeConnections}
              </p>
            </div>
            <FiActivity className="w-8 h-8 text-warning" />
          </div>
          <div className="flex items-center mt-2">
            <FiTrendingDown className="w-4 h-4 text-destructive mr-1" />
            <span className="text-sm text-destructive">-3% from last hour</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                System Health
              </p>
              <p
                className={`text-2xl font-bold ${getHealthColor(systemStats.systemHealth)}`}
              >
                {systemStats.systemHealth?.toUpperCase()}
              </p>
            </div>
            <FiShield className="w-8 h-8 text-info" />
          </div>
          <div className="flex items-center mt-2">
            <span className="text-sm text-muted-foreground">
              Uptime: {systemStats.serverUptime}%
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const PerformanceCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FiActivity className="w-5 h-5 mr-2" />
            System Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#8884d8"
                name="CPU %"
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#82ca9d"
                name="Memory %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FiWifi className="w-5 h-5 mr-2" />
            Network & Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="connections"
                stackId="1"
                stroke="#8884d8"
                fill="#8884d8"
                name="Active Connections"
              />
              <Area
                type="monotone"
                dataKey="bandwidth"
                stackId="2"
                stroke="#82ca9d"
                fill="#82ca9d"
                name="Bandwidth (Mbps)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const OrganizationsList = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FaBuilding className="w-5 h-5 mr-2" />
          Organizations Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {organizationStats.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FaBuilding className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{org.name}</h3>
                  <p className="text-sm text-muted-foreground">{org.domain}</p>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-sm font-medium">{org.users}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{org.meetings}</p>
                  <p className="text-xs text-muted-foreground">Meetings</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {(org.storage / 1024).toFixed(1)}GB
                  </p>
                  <p className="text-xs text-muted-foreground">Storage</p>
                </div>
                <Badge className={getPlanColor(org.plan)}>{org.plan}</Badge>
                <Badge className={getStatusColor(org.status)}>
                  {org.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const AlertsPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FiAlertTriangle className="w-5 h-5 mr-2" />
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 border rounded-lg ${alert.resolved ? "opacity-60" : ""}`}
            >
              <div className="flex items-start space-x-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{alert.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {alert.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {alert.message}
                  </p>
                </div>
                {alert.resolved && (
                  <FaCheckCircle className="w-4 h-4 text-success" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const ResourceMonitoring = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FiCpu className="w-5 h-5 mr-2" />
            CPU Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Average</span>
                <span className="text-sm font-medium">67%</span>
              </div>
              <Progress value={67} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Peak</span>
                <span className="text-sm font-medium">92%</span>
              </div>
              <Progress value={92} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FiServer className="w-5 h-5 mr-2" />
            Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Used</span>
                <span className="text-sm font-medium">14.2GB / 32GB</span>
              </div>
              <Progress value={44} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Available</span>
                <span className="text-sm font-medium">17.8GB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FiHardDrive className="w-5 h-5 mr-2" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Total Used</span>
                <span className="text-sm font-medium">2.4TB / 10TB</span>
              </div>
              <Progress value={24} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Available</span>
                <span className="text-sm font-medium">7.6TB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout
        title="Super Admin"
        subtitle="System-wide administration and monitoring"
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading system data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Super Admin"
      subtitle="System-wide administration and monitoring"
    >
      {/* Quick Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button size="sm">
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
          <Button variant="outline" size="sm">
            <FiSettings className="w-4 h-4 mr-2" />
            System Settings
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-success">
            System Operational
          </Badge>
          <Badge variant="outline">Uptime: {systemStats.serverUptime}%</Badge>
        </div>
      </div>

      {/* System Overview Cards */}
      <SystemOverview />

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceCharts />
        </TabsContent>

        <TabsContent value="organizations" className="space-y-6">
          <OrganizationsList />
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <ResourceMonitoring />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <AlertsPanel />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default SuperAdminPage;
