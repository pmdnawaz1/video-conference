import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import useMeetingStore from "../stores/meetingStore";
import useAuthStore from "../stores/authStore";
import useUserStore from "../stores/userStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import InvitationForm from "../components/meetings/InvitationForm";
import MeetingHistoryFilter from "../components/user/MeetingHistoryFilter";
import MeetingHistoryTable from "../components/user/MeetingHistoryTable";
import MeetingDetailsModal from "../components/user/MeetingDetailsModal";
import ParticipationAnalytics from "../components/analytics/ParticipationAnalytics";
import { useTheme } from "../contexts/ThemeContext";
import {
  MdDarkMode,
  MdLightMode,
  MdTrendingUp,
  MdTrendingDown,
  MdTrendingFlat,
} from "react-icons/md";
import {
  FiPlus,
  FiShare,
  FiUsers,
  FiLogOut,
  FiCalendar,
  FiClock,
  FiActivity,
  FiBell,
  FiSettings,
  FiBarChart,
  FiVideo,
  FiMessageSquare,
} from "react-icons/fi";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import {
  useRoleCheck,
  ScheduleMeetingsAccess,
} from "../components/auth/RoleBasedAccess";

const UserDashboardWithLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Get active tab from location state or URL params
  const urlParams = new URLSearchParams(location.search);
  const tabFromUrl = urlParams.get("tab");
  const tabFromState = location.state?.activeTab;
  const initialActiveTab = tabFromState || tabFromUrl || "overview";

  // Helper function to get default datetime values
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // 30 minutes from now
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  const getDefaultEndTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 90); // 1.5 hours from now
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  const [newMeeting, setNewMeeting] = useState({
    title: "",
    description: "",
    scheduled_start: getDefaultStartTime(),
    scheduled_end: getDefaultEndTime(),
    max_participants: 10,
  });

  const { isCreating, error, createMeeting, startMeeting, endMeeting } =
    useMeetingStore();

  const {
    analytics,
    dashboardData,
    meetingHistory,
    isAnalyticsLoading,
    isDashboardLoading,
    isHistoryLoading,
    fetchAnalytics,
    fetchDashboardData,
    fetchMeetingHistory,
    getEngagementLevel,
    getParticipationTrend,
    getTodaysMeetingsCount,
    getUpcomingMeetingsCount,
    getUnreadNotificationsCount,
  } = useUserStore();

  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { canScheduleMeetings } = useRoleCheck();

  // Additional state for enhanced dashboard
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [historyFilters, setHistoryFilters] = useState({});
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState(null);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState("month");

  useEffect(() => {
    fetchDashboardData();
    fetchAnalytics(analyticsTimeframe);
  }, [fetchDashboardData, fetchAnalytics, analyticsTimeframe]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchMeetingHistory(1, 20, historyFilters);
    }
  }, [activeTab, historyFilters, fetchMeetingHistory]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();

    if (
      !newMeeting.title ||
      !newMeeting.scheduled_start ||
      !newMeeting.scheduled_end
    ) {
      return;
    }

    // Convert datetime-local format to ISO string
    const meetingData = {
      ...newMeeting,
      scheduled_start: new Date(newMeeting.scheduled_start).toISOString(),
      scheduled_end: new Date(newMeeting.scheduled_end).toISOString(),
    };

    const result = await createMeeting(meetingData);

    if (result.success) {
      setShowCreateForm(false);
      setNewMeeting({
        title: "",
        description: "",
        scheduled_start: getDefaultStartTime(),
        scheduled_end: getDefaultEndTime(),
        max_participants: 10,
      });
      // Refresh dashboard data to show the new meeting
      await fetchDashboardData();
    }
  };

  const handleStartInstantMeeting = async () => {
    try {
      const now = new Date();
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + 1); // 1 hour duration by default

      const instantMeeting = {
        title: `Instant Meeting - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        description: "Quick meeting started instantly",
        scheduled_start: now.toISOString(),
        scheduled_end: endTime.toISOString(),
        max_participants: 10,
      };

      console.log("Creating instant meeting:", instantMeeting);
      const result = await createMeeting(instantMeeting);
      console.log("Create meeting result:", result);

      if (result.success) {
        // Immediately start the meeting after creating it
        const meeting = result.meeting; // The meeting data is in result.meeting, not result.data
        console.log("Starting meeting with ID:", meeting.id);
        const startResult = await startMeeting(meeting.id);
        console.log("Start meeting result:", startResult);

        if (startResult.success) {
          console.log("Instant meeting started:", startResult.data);
          // Redirect to video conference room
          navigate(`/meeting/${meeting.roomId || meeting.id}`);
        } else {
          // If meeting is already active, just join it
          console.log("Meeting already active, joining directly");
          navigate(`/meeting/${meeting.roomId || meeting.id}`);
        }
      } else {
        console.error("Failed to create meeting:", result.error);
        alert(
          "Failed to create instant meeting: " +
            (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("Error in handleStartInstantMeeting:", error);
      alert("Error creating instant meeting: " + error.message);
    }
  };

  const handleStartMeeting = async (meetingId) => {
    const result = await startMeeting(meetingId);
    if (result.success) {
      // In a real app, redirect to video conference room
      console.log("Meeting started:", result.data);
    }
  };

  const handleEndMeeting = async (meetingId) => {
    const result = await endMeeting(meetingId);
    if (result.success) {
      console.log("Meeting ended:", result.data);
    }
  };

  const handleInviteUsers = (meeting) => {
    setSelectedMeeting(meeting);
    setShowInviteForm(true);
  };

  const handleSendInvitations = async (emails) => {
    if (!selectedMeeting || !emails.length) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: JSON.stringify({
            meeting_id: selectedMeeting.id,
            emails: emails,
            message: `You're invited to join: ${selectedMeeting.title}`,
          }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`Invitations sent successfully to ${emails.join(", ")}`);
        setShowInviteForm(false);
        setSelectedMeeting(null);
      } else {
        alert(
          "Failed to send invitations: " + (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      alert("Error sending invitations: " + error.message);
    }
  };

  const generateMeetingLink = (meetingId) => {
    return `${window.location.origin}/meeting/${meetingId}`;
  };

  const handleCopyMeetingLink = async (meeting) => {
    const meetingLink = generateMeetingLink(meeting.roomId || meeting.id);

    try {
      await navigator.clipboard.writeText(meetingLink);
      alert("Meeting link copied to clipboard!");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        alert("Meeting link copied to clipboard!");
      } catch (fallbackError) {
        alert(`Failed to copy link. Please copy manually: ${meetingLink}`);
      }

      document.body.removeChild(textArea);
    }
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString();
  };

  const {
    upcomingMeetings = [],
    activeMeetings = [],
    completedMeetings: pastMeetings = [],
  } = dashboardData || {};

  // Analytics data processing
  const engagementLevel = getEngagementLevel();
  const participationTrend = getParticipationTrend();
  const todaysCount = getTodaysMeetingsCount();
  const upcomingCount = getUpcomingMeetingsCount();
  const unreadNotifications = getUnreadNotificationsCount();

  // Format next meeting info
  const getNextMeetingInfo = () => {
    const nextMeeting = upcomingMeetings[0];
    if (!nextMeeting) return null;

    const startTime = new Date(nextMeeting.scheduled_start);
    const now = new Date();
    const diffDays = differenceInDays(startTime, now);

    let timeText;
    if (isToday(startTime)) {
      timeText = `Today at ${format(startTime, "HH:mm")}`;
    } else if (isTomorrow(startTime)) {
      timeText = `Tomorrow at ${format(startTime, "HH:mm")}`;
    } else if (diffDays <= 7) {
      timeText = format(startTime, "EEEE \\a\\t HH:mm");
    } else {
      timeText = format(startTime, "MMM dd \\a\\t HH:mm");
    }

    return {
      ...nextMeeting,
      timeText,
      isStartingSoon: startTime - now <= 15 * 60 * 1000, // 15 minutes
    };
  };

  const nextMeetingInfo = getNextMeetingInfo();

  // Render trend icon
  const renderTrendIcon = (trend) => {
    switch (trend) {
      case "increasing":
        return <MdTrendingUp className="w-4 h-4 text-success" />;
      case "decreasing":
        return <MdTrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <MdTrendingFlat className="w-4 h-4 text-muted" />;
    }
  };

  // Get engagement color
  const getEngagementColor = (level) => {
    switch (level) {
      case "high":
        return "badge-success";
      case "medium":
        return "badge-primary";
      case "low":
        return "badge-warning";
      default:
        return "badge-destructive";
    }
  };

  // Header actions for the layout
  const headerActions = (
    <div className="flex items-center space-x-2">
      <Button
        onClick={toggleDarkMode}
        variant="outline"
        size="sm"
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? (
          <MdLightMode className="w-4 h-4" />
        ) : (
          <MdDarkMode className="w-4 h-4" />
        )}
      </Button>
      <ScheduleMeetingsAccess>
        <Button
          onClick={handleStartInstantMeeting}
          disabled={isCreating}
          className="bg-green-600 hover:bg-green-700"
          size="sm"
        >
          {isCreating ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              Starting...
            </>
          ) : (
            <>
              <FiVideo className="w-4 h-4 mr-2" />
              Instant Meeting
            </>
          )}
        </Button>
      </ScheduleMeetingsAccess>
      <ScheduleMeetingsAccess>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="btn-base btn-primary"
          size="sm"
        >
          <FiPlus className="w-4 h-4 mr-2" />
          Schedule
        </Button>
      </ScheduleMeetingsAccess>
    </div>
  );

  const subtitle = nextMeetingInfo
    ? `Welcome back, ${user?.first_name}! Next meeting: ${nextMeetingInfo.timeText}`
    : `Welcome back, ${user?.first_name}!`;

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={subtitle}
      headerActions={headerActions}
    >
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Create Meeting Form */}
      <ScheduleMeetingsAccess>
        {showCreateForm && (
          <Card className="mb-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Schedule New Meeting</h2>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Meeting Title *
                </label>
                <Input
                  value={newMeeting.title}
                  onChange={(e) =>
                    setNewMeeting((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Enter meeting title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  value={newMeeting.description}
                  onChange={(e) =>
                    setNewMeeting((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter meeting description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Time *
                  </label>
                  <Input
                    type="datetime-local"
                    value={newMeeting.scheduled_start}
                    onChange={(e) =>
                      setNewMeeting((prev) => ({
                        ...prev,
                        scheduled_start: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Time *
                  </label>
                  <Input
                    type="datetime-local"
                    value={newMeeting.scheduled_end}
                    onChange={(e) =>
                      setNewMeeting((prev) => ({
                        ...prev,
                        scheduled_end: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Participants
                </label>
                <Input
                  type="number"
                  min="2"
                  max="100"
                  value={newMeeting.max_participants}
                  onChange={(e) =>
                    setNewMeeting((prev) => ({
                      ...prev,
                      max_participants: parseInt(e.target.value),
                    }))
                  }
                />
              </div>

              <Button type="submit" disabled={isCreating} className="w-full">
                {isCreating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Creating...
                  </>
                ) : (
                  "Schedule Meeting"
                )}
              </Button>
            </form>
          </Card>
        )}
      </ScheduleMeetingsAccess>

      {/* Invite Users Form */}
      {showInviteForm && selectedMeeting && (
        <Card className="mb-8 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Invite Users to: {selectedMeeting.title}
            </h2>
            <Button
              onClick={() => {
                setShowInviteForm(false);
                setSelectedMeeting(null);
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>

          <InvitationForm
            meeting={selectedMeeting}
            onSendInvitations={handleSendInvitations}
            onCancel={() => {
              setShowInviteForm(false);
              setSelectedMeeting(null);
            }}
          />
        </Card>
      )}

      {/* Loading State */}
      {isDashboardLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner className="w-8 h-8" />
          <span className="ml-2">Loading meetings...</span>
        </div>
      )}

      {/* Enhanced Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className="grid w-full grid-cols-5 lg:w-fit lg:grid-cols-5"
          role="tablist"
        >
          <TabsTrigger
            value="overview"
            className="flex items-center space-x-2"
            role="tab"
          >
            <FiActivity className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="meetings"
            className="flex items-center space-x-2"
            role="tab"
          >
            <FiVideo className="w-4 h-4" />
            <span className="hidden sm:inline">Meetings</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="flex items-center space-x-2"
            role="tab"
          >
            <FiBarChart className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center space-x-2"
            role="tab"
          >
            <FiClock className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex items-center space-x-2"
            role="tab"
          >
            <FiSettings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6" role="tabpanel">
          {isDashboardLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner className="w-8 h-8" />
              <span className="ml-2">Loading dashboard...</span>
            </div>
          ) : (
            <>
              {/* Quick Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted">
                        Total Meetings
                      </p>
                      <p className="text-2xl font-bold">
                        {analytics.totalMeetings}
                      </p>
                    </div>
                    <FiVideo className="w-8 h-8 text-blue-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted">
                        Total Minutes
                      </p>
                      <p className="text-2xl font-bold">
                        {Math.round(analytics.totalMinutes)}
                      </p>
                    </div>
                    <FiClock className="w-8 h-8 text-green-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted">
                        Engagement
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold">
                          {Math.round(analytics.engagementScore)}%
                        </p>
                        <Badge className={getEngagementColor(engagementLevel)}>
                          {engagementLevel}
                        </Badge>
                      </div>
                    </div>
                    <FiActivity className="w-8 h-8 text-purple-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted">
                        Participation
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold">
                          {Math.round(analytics.averageParticipation)}%
                        </p>
                        {renderTrendIcon(participationTrend)}
                      </div>
                    </div>
                    <FiUsers className="w-8 h-8 text-orange-500" />
                  </div>
                </Card>
              </div>

              {/* Next Meeting Alert */}
              {nextMeetingInfo && (
                <Card
                  className={`p-4 ${
                    nextMeetingInfo.isStartingSoon
                      ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                      : "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-full ${
                          nextMeetingInfo.isStartingSoon
                            ? "bg-warning/10 text-warning"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <FiCalendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {nextMeetingInfo.title}
                        </h3>
                        <p className="text-sm text-muted">
                          {nextMeetingInfo.timeText}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {nextMeetingInfo.isStartingSoon && (
                        <Button
                          onClick={() => {
                            handleStartMeeting(nextMeetingInfo.id);
                            navigate(
                              `/meeting/${nextMeetingInfo.roomId || nextMeetingInfo.id}`,
                            );
                          }}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Join Now
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/meeting/${nextMeetingInfo.roomId || nextMeetingInfo.id}`,
                          )
                        }
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Recent Activity */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {!Array.isArray(dashboardData.recentActivity) ||
                  dashboardData.recentActivity.length === 0 ? (
                    <p className="text-muted text-center py-4">
                      No recent activity
                    </p>
                  ) : (
                    (dashboardData.recentActivity || [])
                      .slice(0, 5)
                      .map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="p-2 rounded-full bg-background">
                            <FiMessageSquare className="w-4 h-4 text-muted" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">
                              {activity.description || "Activity"}
                            </p>
                            <p className="text-xs text-muted">
                              {activity.timestamp
                                ? format(
                                    new Date(activity.timestamp),
                                    "MMM dd, HH:mm",
                                  )
                                : "Unknown time"}
                            </p>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-6" role="tabpanel">
          {!isDashboardLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Active Meetings */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-success flex items-center space-x-2">
                  <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                  <span>Active Meetings</span>
                </h2>
                <div className="space-y-4">
                  {activeMeetings.length === 0 ? (
                    <Card className="p-6 text-center">
                      <FiVideo className="w-12 h-12 text-muted mx-auto mb-2" />
                      <p className="text-muted">
                        No active meetings
                      </p>
                      <p className="text-sm text-muted">
                        Start an instant meeting or join a scheduled one
                      </p>
                    </Card>
                  ) : (
                    activeMeetings.map((meeting) => (
                      <Card key={meeting.id} className="p-4 border-green-200">
                        <h3 className="font-medium mb-2">{meeting.title}</h3>
                        <p className="text-sm text-muted mb-2">
                          {meeting.description}
                        </p>
                        <p className="text-xs text-muted mb-3">
                          Started: {formatDateTime(meeting.scheduled_start)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="flex-1 min-w-0"
                            onClick={() =>
                              navigate(
                                `/meeting/${meeting.roomId || meeting.id}`,
                              )
                            }
                          >
                            Join
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInviteUsers(meeting)}
                          >
                            Invite
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyMeetingLink(meeting)}
                            title="Copy meeting link"
                          >
                            Share
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEndMeeting(meeting.id)}
                          >
                            End
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* Upcoming Meetings */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-primary flex items-center space-x-2">
                  <FiCalendar className="w-5 h-5" />
                  <span>Upcoming Meetings</span>
                </h2>
                <div className="space-y-4">
                  {upcomingMeetings.length === 0 ? (
                    <Card className="p-6 text-center">
                      <FiCalendar className="w-12 h-12 text-muted mx-auto mb-2" />
                      <p className="text-muted">
                        No upcoming meetings
                      </p>
                      <ScheduleMeetingsAccess>
                        <Button
                          onClick={() => setShowCreateForm(true)}
                          className="mt-2"
                          size="sm"
                        >
                          Schedule Meeting
                        </Button>
                      </ScheduleMeetingsAccess>
                    </Card>
                  ) : (
                    upcomingMeetings.map((meeting) => (
                      <Card key={meeting.id} className="p-4 border-blue-200">
                        <h3 className="font-medium mb-2">{meeting.title}</h3>
                        <p className="text-sm text-muted mb-2">
                          {meeting.description}
                        </p>
                        <p className="text-xs text-muted mb-3">
                          Starts: {formatDateTime(meeting.scheduled_start)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="flex-1 min-w-0"
                            onClick={() => {
                              handleStartMeeting(meeting.id);
                              navigate(
                                `/meeting/${meeting.roomId || meeting.id}`,
                              );
                            }}
                          >
                            Start Meeting
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInviteUsers(meeting)}
                          >
                            Invite
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyMeetingLink(meeting)}
                            title="Copy meeting link"
                          >
                            Share
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* Past Meetings Preview */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-muted flex items-center space-x-2">
                  <FiClock className="w-5 h-5" />
                  <span>Recent Past Meetings</span>
                </h2>
                <div className="space-y-4">
                  {pastMeetings.slice(0, 5).length === 0 ? (
                    <Card className="p-6 text-center">
                      <FiClock className="w-12 h-12 text-muted mx-auto mb-2" />
                      <p className="text-muted">No past meetings</p>
                    </Card>
                  ) : (
                    <>
                      {pastMeetings.slice(0, 3).map((meeting) => (
                        <Card key={meeting.id} className="p-4 border-muted">
                          <h3 className="font-medium mb-2">{meeting.title}</h3>
                          <p className="text-sm text-muted mb-2">
                            {meeting.description}
                          </p>
                          <p className="text-xs text-muted mb-3">
                            Ended: {formatDateTime(meeting.scheduled_end)}
                          </p>
                          <div className="flex justify-between">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedMeetingDetails(meeting)}
                            >
                              View Details
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyMeetingLink(meeting)}
                              title="Copy meeting link"
                            >
                              Share Link
                            </Button>
                          </div>
                        </Card>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("history")}
                      >
                        View All History
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner className="w-8 h-8" />
              <span className="ml-2">Loading meetings...</span>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6" role="tabpanel">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Participation Analytics</h2>
            <select
              value={analyticsTimeframe}
              onChange={(e) => setAnalyticsTimeframe(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Select analytics timeframe"
            >
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="quarter">Last 3 months</option>
              <option value="year">Last year</option>
            </select>
          </div>

          <ParticipationAnalytics
            analytics={analytics}
            isLoading={isAnalyticsLoading}
            timeframe={analyticsTimeframe}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6" role="tabpanel">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center space-y-4 lg:space-y-0">
            <h2 className="text-2xl font-bold">Meeting History</h2>
            <MeetingHistoryFilter
              filters={historyFilters}
              onFiltersChange={setHistoryFilters}
            />
          </div>

          <MeetingHistoryTable
            meetings={meetingHistory}
            isLoading={isHistoryLoading}
            onViewDetails={setSelectedMeetingDetails}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6" role="tabpanel">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <p className="text-muted mb-6">
              Manage your profile, preferences, and account settings.
            </p>

            <div className="grid gap-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Profile Settings</h3>
                <p className="text-sm text-muted mb-4">
                  Update your personal information and preferences
                </p>
                <Button onClick={() => navigate("/profile")}>
                  Edit Profile
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Notification Preferences
                </h3>
                <p className="text-sm text-muted mb-4">
                  Control how and when you receive notifications
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/settings/notifications")}
                >
                  Manage Notifications
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Meeting Preferences
                </h3>
                <p className="text-sm text-muted mb-4">
                  Set default options for meetings
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/settings/meetings")}
                >
                  Configure Meetings
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Account Security</h3>
                <p className="text-sm text-muted mb-4">
                  Manage password and security settings
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/settings/security")}
                >
                  Security Settings
                </Button>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Meeting Details Modal */}
      <Dialog
        open={!!selectedMeetingDetails}
        onOpenChange={() => setSelectedMeetingDetails(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meeting Details</DialogTitle>
            <DialogDescription>
              Detailed information about this meeting session
            </DialogDescription>
          </DialogHeader>
          {selectedMeetingDetails && (
            <MeetingDetailsModal
              meeting={selectedMeetingDetails}
              onClose={() => setSelectedMeetingDetails(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserDashboardWithLayout;
