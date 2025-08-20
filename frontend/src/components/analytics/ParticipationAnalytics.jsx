import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiDownload,
  FiShare2,
  FiCalendar,
  FiClock,
  FiUsers,
  FiMessageSquare,
  FiMic,
  FiVideo,
  FiTarget,
  FiAward,
  FiBarChart,
  FiPieChart,
  FiActivity,
} from "react-icons/fi";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

const ParticipationAnalytics = ({
  analytics,
  isLoading,
  timeframe = "month",
}) => {
  const [selectedMetric, setSelectedMetric] = useState("meetings");
  const [chartType, setChartType] = useState("line");
  const [comparisonPeriod, setComparisonPeriod] = useState(null);

  // Process data for different chart types and timeframes
  const processTimeSeriesData = () => {
    if (!analytics?.participationTrends) return [];

    return analytics.participationTrends.map((point) => ({
      date: format(new Date(point.date), "MMM dd"),
      meetings: point.meetingsAttended || 0,
      participation: point.participationRate || 0,
      engagement: point.engagementScore || 0,
      speakingTime: point.averageSpeakingTime || 0,
      messages: point.totalMessages || 0,
    }));
  };

  const processEngagementData = () => {
    if (!analytics?.engagementBreakdown) return [];

    return [
      {
        name: "Speaking",
        value: analytics.engagementBreakdown.speaking || 0,
        color: "#8884d8",
      },
      {
        name: "Chat Messages",
        value: analytics.engagementBreakdown.messages || 0,
        color: "#82ca9d",
      },
      {
        name: "Reactions",
        value: analytics.engagementBreakdown.reactions || 0,
        color: "#ffc658",
      },
      {
        name: "Screen Share",
        value: analytics.engagementBreakdown.screenShare || 0,
        color: "#ff7300",
      },
      {
        name: "File Share",
        value: analytics.engagementBreakdown.fileShare || 0,
        color: "#0088fe",
      },
    ];
  };

  const processMeetingTypesData = () => {
    if (!analytics?.meetingTypes) return [];

    return Object.entries(analytics.meetingTypes).map(([type, count]) => ({
      type: type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count,
      percentage: Math.round((count / analytics.totalMeetings) * 100),
    }));
  };

  const processWeeklyPattern = () => {
    if (!analytics?.weeklyPattern) return [];

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return days.map((day) => ({
      day: day.substring(0, 3),
      meetings: analytics.weeklyPattern[day.toLowerCase()] || 0,
      averageParticipation:
        analytics.weeklyParticipation?.[day.toLowerCase()] || 0,
    }));
  };

  const processHourlyPattern = () => {
    if (!analytics?.hourlyPattern) return [];

    return Array.from({ length: 24 }, (_, hour) => ({
      hour: hour.toString().padStart(2, "0") + ":00",
      meetings: analytics.hourlyPattern[hour] || 0,
      engagement: analytics.hourlyEngagement?.[hour] || 0,
    }));
  };

  const timeSeriesData = processTimeSeriesData();
  const engagementData = processEngagementData();
  const meetingTypesData = processMeetingTypesData();
  const weeklyPatternData = processWeeklyPattern();
  const hourlyPatternData = processHourlyPattern();

  // Calculate insights and trends
  const getTrendDirection = (current, previous) => {
    if (!previous || previous === 0) return "stable";
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return "increasing";
    if (change < -5) return "decreasing";
    return "stable";
  };

  const getTrendIcon = (direction) => {
    switch (direction) {
      case "increasing":
        return <FiTrendingUp className="w-4 h-4 text-green-500" />;
      case "decreasing":
        return <FiTrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <FiMinus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const exportData = () => {
    // Create downloadable report
    const reportData = {
      timeframe,
      analytics,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participation-analytics-${timeframe}-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareAnalytics = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Participation Analytics",
          text: `My meeting participation analytics for the last ${timeframe}`,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback to copying URL
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("Analytics URL copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <LoadingSpinner className="w-8 h-8" />
          <p className="text-muted-foreground">
            Loading participation analytics...
          </p>
        </div>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <FiBarChart className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">No Analytics Data</h3>
            <p className="text-muted-foreground">
              Analytics will appear here once you start participating in
              meetings.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Participation Analytics
          </h2>
          <p className="text-muted-foreground">
            Insights into your meeting participation and engagement over the
            last {timeframe}
          </p>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={exportData}>
            <FiDownload className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={shareAnalytics}>
            <FiShare2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Meetings</p>
              <p className="text-2xl font-bold">{analytics.totalMeetings}</p>
              <div className="flex items-center space-x-1 mt-1">
                {getTrendIcon(
                  getTrendDirection(
                    analytics.totalMeetings,
                    analytics.previousTotalMeetings,
                  ),
                )}
                <span className="text-xs text-muted-foreground">
                  vs previous {timeframe}
                </span>
              </div>
            </div>
            <FiCalendar className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Participation</p>
              <p className="text-2xl font-bold">
                {Math.round(analytics.averageParticipation)}%
              </p>
              <div className="flex items-center space-x-1 mt-1">
                {getTrendIcon(
                  getTrendDirection(
                    analytics.averageParticipation,
                    analytics.previousAverageParticipation,
                  ),
                )}
                <span className="text-xs text-muted-foreground">
                  {analytics.averageParticipation > 80
                    ? "Excellent"
                    : analytics.averageParticipation > 60
                      ? "Good"
                      : "Needs improvement"}
                </span>
              </div>
            </div>
            <FiUsers className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Engagement Score</p>
              <p className="text-2xl font-bold">
                {Math.round(analytics.engagementScore)}
              </p>
              <div className="flex items-center space-x-1 mt-1">
                {getTrendIcon(
                  getTrendDirection(
                    analytics.engagementScore,
                    analytics.previousEngagementScore,
                  ),
                )}
                <Badge
                  className={`text-xs ${
                    analytics.engagementScore >= 80
                      ? "bg-green-100 text-green-800"
                      : analytics.engagementScore >= 60
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {analytics.engagementScore >= 80
                    ? "High"
                    : analytics.engagementScore >= 60
                      ? "Medium"
                      : "Low"}
                </Badge>
              </div>
            </div>
            <FiActivity className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Minutes</p>
              <p className="text-2xl font-bold">
                {Math.round(analytics.totalMinutes)}
              </p>
              <div className="flex items-center space-x-1 mt-1">
                {getTrendIcon(
                  getTrendDirection(
                    analytics.totalMinutes,
                    analytics.previousTotalMinutes,
                  ),
                )}
                <span className="text-xs text-muted-foreground">
                  {Math.round(analytics.totalMinutes / analytics.totalMeetings)}{" "}
                  avg/meeting
                </span>
              </div>
            </div>
            <FiClock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Chart Controls */}
      <div className="flex flex-wrap items-center space-x-4 space-y-2">
        <div className="flex space-x-2">
          <Button
            variant={selectedMetric === "meetings" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMetric("meetings")}
          >
            Meetings
          </Button>
          <Button
            variant={selectedMetric === "participation" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMetric("participation")}
          >
            Participation
          </Button>
          <Button
            variant={selectedMetric === "engagement" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMetric("engagement")}
          >
            Engagement
          </Button>
        </div>

        <div className="flex space-x-2">
          <Button
            variant={chartType === "line" ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType("line")}
          >
            Line
          </Button>
          <Button
            variant={chartType === "area" ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType("area")}
          >
            Area
          </Button>
          <Button
            variant={chartType === "bar" ? "default" : "outline"}
            size="sm"
            onClick={() => setChartType("bar")}
          >
            Bar
          </Button>
        </div>
      </div>

      {/* Main Time Series Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 capitalize">
          {selectedMetric} Over Time
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" && (
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  labelStyle={{ color: "#333" }}
                  contentStyle={{
                    backgroundColor: "#f8f9fa",
                    border: "1px solid #dee2e6",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ fill: "#8884d8", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}

            {chartType === "area" && (
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              </AreaChart>
            )}

            {chartType === "bar" && (
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey={selectedMetric} fill="#8884d8" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Engagement Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={engagementData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {engagementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Meeting Types Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Meeting Types</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meetingTypesData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Pattern Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Pattern */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Meeting Pattern</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPatternData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="meetings" fill="#8884d8" />
                <Bar dataKey="averageParticipation" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Hourly Pattern */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Meeting Pattern</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyPatternData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="meetings" stroke="#8884d8" />
                <Line type="monotone" dataKey="engagement" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Insights and Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FiTarget className="w-5 h-5 mr-2" />
          Insights & Recommendations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Peak Performance Time */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <FiClock className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium">Peak Performance</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              You're most engaged during {analytics.peakHour || "10:00"} AM
              meetings
            </p>
          </div>

          {/* Best Day */}
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <FiCalendar className="w-5 h-5 text-green-600" />
              <h4 className="font-medium">Most Active Day</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {analytics.mostActiveDay || "Tuesday"} is your most productive
              meeting day
            </p>
          </div>

          {/* Engagement Tip */}
          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <FiAward className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium">Engagement Goal</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Try to increase your speaking time by 2-3 minutes per meeting
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <FiTarget className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-orange-800 dark:text-orange-200">
                Monthly Goal Progress
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                You're {analytics.goalProgress}% towards your monthly engagement
                goal of 85%. Keep participating actively in discussions to reach
                your target!
              </p>
              <div className="mt-2 w-full bg-orange-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(analytics.goalProgress || 0, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ParticipationAnalytics;
