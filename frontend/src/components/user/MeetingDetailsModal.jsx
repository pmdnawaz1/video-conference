import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  FiClock,
  FiUsers,
  FiMessageSquare,
  FiVideo,
  FiPlay,
  FiDownload,
  FiShare2,
  FiCalendar,
  FiMic,
  FiMicOff,
  FiVideoOff,
  FiPhone,
  FiThumbsUp,
  FiHeart,
  FiEye,
  FiCopy,
  FiExternalLink,
  FiUserPlus,
} from "react-icons/fi";
import MeetingInvitationManager from "../meetings/MeetingInvitationManager";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const MeetingDetailsModal = ({ meeting, onClose }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (meeting) {
      loadMeetingData();
    }
  }, [meeting]);

  const loadMeetingData = async () => {
    // Load different data based on active tab
    if (activeTab === "chat" && chatHistory.length === 0) {
      await loadChatHistory();
    }
    if (activeTab === "participants" && participants.length === 0) {
      await loadParticipants();
    }
    if (activeTab === "analytics" && !analyticsData) {
      await loadAnalytics();
    }
  };

  useEffect(() => {
    loadMeetingData();
  }, [activeTab]);

  const loadChatHistory = async () => {
    setIsLoadingChat(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/meetings/${meeting.id}/chat-history`,
      );
      const data = await response.json();
      if (data.success) {
        setChatHistory(data.data.messages || []);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const loadParticipants = async () => {
    setIsLoadingParticipants(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/meetings/${meeting.id}/participants`,
      );
      const data = await response.json();
      if (data.success) {
        setParticipants(data.data.participants || []);
      }
    } catch (error) {
      console.error("Failed to load participants:", error);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/meetings/${meeting.id}/analytics`,
      );
      const data = await response.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${minutes}m`;
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const copyMeetingLink = async () => {
    const link = `${window.location.origin}/meeting/${meeting.meeting_id}`;
    try {
      await navigator.clipboard.writeText(link);
      // You could show a toast notification here
      alert("Meeting link copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const downloadReport = () => {
    // Implementation for downloading meeting report
    console.log("Downloading meeting report...");
  };

  const shareReport = () => {
    // Implementation for sharing meeting report
    console.log("Sharing meeting report...");
  };

  if (!meeting) return null;

  const meetingDuration = differenceInMinutes(
    new Date(meeting.actual_end || meeting.scheduled_end),
    new Date(meeting.actual_start || meeting.scheduled_start),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {meeting.title}
            </h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <FiCalendar className="w-4 h-4" />
                <span>
                  {format(
                    new Date(meeting.scheduled_start),
                    "EEEE, MMMM dd, yyyy",
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <FiClock className="w-4 h-4" />
                <span>
                  {format(new Date(meeting.scheduled_start), "HH:mm")} -{" "}
                  {format(new Date(meeting.scheduled_end), "HH:mm")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              <FiUserPlus className="w-4 h-4 mr-2" />
              Invite
            </Button>
            <Button variant="outline" size="sm" onClick={copyMeetingLink}>
              <FiCopy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <FiDownload className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={shareReport}>
              <FiShare2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {meeting.description && (
          <p className="text-muted-foreground">{meeting.description}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="chat">Chat History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(meetingDuration)}
                  </p>
                </div>
                <FiClock className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Participants</p>
                  <p className="text-2xl font-bold">
                    {meeting.participants?.length || 0}
                  </p>
                </div>
                <FiUsers className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages</p>
                  <p className="text-2xl font-bold">
                    {meeting.totalMessages || 0}
                  </p>
                </div>
                <FiMessageSquare className="w-8 h-8 text-purple-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className="mt-1"
                    variant={
                      meeting.status === "completed" ? "default" : "secondary"
                    }
                  >
                    {meeting.status}
                  </Badge>
                </div>
                <FiVideo className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
          </div>

          {/* Meeting Timeline */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Meeting Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Meeting Started</p>
                  <p className="text-xs text-muted-foreground">
                    {format(
                      new Date(meeting.actual_start || meeting.scheduled_start),
                      "HH:mm:ss",
                    )}
                  </p>
                </div>
              </div>

              {meeting.keyEvents?.map((event, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.timestamp), "HH:mm:ss")} -{" "}
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Meeting Ended</p>
                  <p className="text-xs text-muted-foreground">
                    {format(
                      new Date(meeting.actual_end || meeting.scheduled_end),
                      "HH:mm:ss",
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Your Participation */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Your Participation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(
                    meeting.userParticipation?.attendancePercentage || 0,
                  )}
                  %
                </p>
                <p className="text-sm text-muted-foreground">Attendance</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatDuration(meeting.userEngagement?.speakingTime || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Speaking Time</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {meeting.userEngagement?.chatMessages || 0}
                </p>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          {isLoadingParticipants ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="w-8 h-8" />
              <span className="ml-2">Loading participants...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant) => (
                <Card key={participant.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={participant.avatar} />
                        <AvatarFallback>
                          {getInitials(
                            participant.first_name,
                            participant.last_name,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">
                          {participant.first_name} {participant.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {participant.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">
                          {formatDuration(participant.duration || 0)}
                        </p>
                        <p className="text-muted-foreground">Duration</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">
                          {participant.messages || 0}
                        </p>
                        <p className="text-muted-foreground">Messages</p>
                      </div>
                      <div className="flex space-x-1">
                        {participant.hadVideo && (
                          <FiVideo className="w-4 h-4 text-green-500" />
                        )}
                        {participant.hadAudio && (
                          <FiMic className="w-4 h-4 text-blue-500" />
                        )}
                        {participant.wasHost && (
                          <Badge variant="outline">Host</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <MeetingInvitationManager
            meetingId={meeting.meeting_id || meeting.id}
            meetingTitle={meeting.title}
            meetingStartTime={meeting.scheduled_start}
            onInvitationSent={(result) => {
              console.log("Invitation sent:", result);
              // Optional: Show success notification
            }}
          />
        </TabsContent>

        {/* Chat History Tab */}
        <TabsContent value="chat" className="space-y-4">
          {isLoadingChat ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="w-8 h-8" />
              <span className="ml-2">Loading chat history...</span>
            </div>
          ) : (
            <Card className="p-4">
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <FiMessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No messages in this meeting
                      </p>
                    </div>
                  ) : (
                    chatHistory.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={message.user?.avatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(
                              message.user?.first_name,
                              message.user?.last_name,
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium">
                              {message.user?.first_name}{" "}
                              {message.user?.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.timestamp), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground break-words">
                            {message.content}
                          </p>
                          {message.reactions &&
                            message.reactions.length > 0 && (
                              <div className="flex space-x-1 mt-2">
                                {message.reactions.map((reaction, rIndex) => (
                                  <Badge
                                    key={rIndex}
                                    variant="outline"
                                    className="text-xs px-2 py-1"
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </Badge>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {isLoadingAnalytics ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="w-8 h-8" />
              <span className="ml-2">Loading analytics...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Participation Over Time */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Participation Over Time
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={analyticsData?.participationTimeline || []}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="participants"
                        stroke="#8884d8"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Audio/Video Usage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Audio Usage</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData?.audioUsage || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {(analyticsData?.audioUsage || []).map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  ["#0088FE", "#00C49F", "#FFBB28"][index % 3]
                                }
                              />
                            ),
                          )}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Video Usage</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData?.videoUsage || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={60}
                          fill="#82ca9d"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {(analyticsData?.videoUsage || []).map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  ["#FF8042", "#8884D8", "#82CA9D"][index % 3]
                                }
                              />
                            ),
                          )}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Speaking Time Distribution */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Speaking Time Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.speakingTime || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="participant" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="duration" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Invite Participants</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                >
                  ✕
                </Button>
              </div>
              <MeetingInvitationManager
                meetingId={meeting.meeting_id || meeting.id}
                meetingTitle={meeting.title}
                meetingStartTime={meeting.scheduled_start}
                onInvitationSent={(result) => {
                  console.log("Invitation sent:", result);
                  // Optional: Show success notification and close modal
                  setShowInviteModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingDetailsModal;
