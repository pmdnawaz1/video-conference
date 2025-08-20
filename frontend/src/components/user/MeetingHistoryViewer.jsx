import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  Video,
  Download,
  Eye,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  FileText,
  Share2,
  Star,
  StarOff,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Timer,
  Activity,
  Award,
  Zap,
  Target,
} from "lucide-react";
import useUserStore from "../../stores/userStore";
import userAnalyticsService from "../../services/UserAnalyticsService";
import LoadingSpinner from "../ui/LoadingSpinner";

const MeetingHistoryViewer = () => {
  const {
    meetingHistory,
    fetchMeetingHistory,
    bookmarkedMoments,
    bookmarkMoment,
    removeBookmark,
    isHistoryLoading,
  } = useUserStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [participationFilter, setParticipationFilter] = useState("all");

  useEffect(() => {
    loadMeetingHistory();
  }, [currentPage, filterType, sortBy, dateRange, participationFilter]);

  useEffect(() => {
    userAnalyticsService.trackEvent("meeting_history_viewed", {
      page: currentPage,
      filters: { filterType, sortBy, dateRange, participationFilter },
      timestamp: Date.now(),
    });
  }, [currentPage, filterType, sortBy, dateRange, participationFilter]);

  const loadMeetingHistory = async () => {
    const filters = {
      type: filterType !== "all" ? filterType : undefined,
      date_range: dateRange !== "all" ? dateRange : undefined,
      participation:
        participationFilter !== "all" ? participationFilter : undefined,
      sort_by: sortBy.split("_")[0],
      sort_order: sortBy.split("_")[1] || "desc",
      search: searchTerm || undefined,
    };

    await fetchMeetingHistory(currentPage, 20, filters);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadMeetingHistory();
  };

  const handleMeetingSelect = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetails(true);

    userAnalyticsService.trackEvent("meeting_details_viewed", {
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      timestamp: Date.now(),
    });
  };

  const handleBookmark = async (meetingId, timestamp, note = "") => {
    const result = await bookmarkMoment(meetingId, timestamp, note);
    if (result.success) {
      userAnalyticsService.trackEvent("moment_bookmarked", {
        meeting_id: meetingId,
        timestamp: timestamp,
        timestamp: Date.now(),
      });
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMeetingStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "ongoing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "no_show":
        return "bg-muted0 text-muted-foreground border-gray-200";
      default:
        return "bg-muted0 text-muted-foreground border-gray-200";
    }
  };

  const getParticipationScore = (meeting) => {
    if (!meeting.participation_data) return 0;
    const { speaking_time, attendance_percentage, chat_messages, camera_time } =
      meeting.participation_data;

    let score = 0;
    if (attendance_percentage > 80) score += 25;
    else if (attendance_percentage > 60) score += 15;
    else if (attendance_percentage > 40) score += 10;

    if (speaking_time > 0) score += 25;
    if (chat_messages > 0) score += 25;
    if (camera_time > 0) score += 25;

    return score;
  };

  const filteredMeetings =
    meetingHistory?.filter((meeting) => {
      const matchesSearch =
        !searchTerm ||
        meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meeting.organizer?.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesSearch;
    }) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6" />
            Meeting History
          </h1>
          <p className="text-muted-foreground">
            View and analyze your past meeting participation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadMeetingHistory}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search meetings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meeting Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Participation</Label>
              <Select
                value={participationFilter}
                onValueChange={setParticipationFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="hosted">Hosted</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Newest First</SelectItem>
                  <SelectItem value="date_asc">Oldest First</SelectItem>
                  <SelectItem value="duration_desc">Longest First</SelectItem>
                  <SelectItem value="duration_asc">Shortest First</SelectItem>
                  <SelectItem value="participants_desc">
                    Most Participants
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meeting List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Meetings ({filteredMeetings.length})</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={filteredMeetings.length < 20}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredMeetings.length > 0 ? (
            <div className="space-y-4">
              {filteredMeetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={meeting.organizer?.avatar} />
                            <AvatarFallback>
                              {meeting.organizer?.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "M"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-lg">
                                {meeting.title}
                              </h3>
                              <Badge
                                className={getMeetingStatusColor(
                                  meeting.status,
                                )}
                              >
                                {meeting.status}
                              </Badge>
                              {meeting.is_recorded && (
                                <Badge
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  <Video className="w-3 h-3" />
                                  Recorded
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(meeting.started_at)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Timer className="w-4 h-4" />
                                {formatDuration(meeting.duration || 0)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {meeting.participants_count} participants
                              </div>
                              <div className="flex items-center gap-1">
                                <Activity className="w-4 h-4" />
                                Organizer: {meeting.organizer?.name}
                              </div>
                            </div>

                            {/* Participation Metrics */}
                            {meeting.participation_data && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-500" />
                                  <span>
                                    Attendance:{" "}
                                    {Math.round(
                                      meeting.participation_data
                                        .attendance_percentage || 0,
                                    )}
                                    %
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mic className="w-4 h-4 text-green-500" />
                                  <span>
                                    Speaking:{" "}
                                    {formatDuration(
                                      meeting.participation_data
                                        .speaking_time || 0,
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-purple-500" />
                                  <span>
                                    Messages:{" "}
                                    {meeting.participation_data.chat_messages ||
                                      0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-orange-500" />
                                  <span>
                                    Score: {getParticipationScore(meeting)}/100
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {meeting.is_recorded && (
                          <Button variant="outline" size="sm">
                            <Play className="w-4 h-4 mr-1" />
                            Watch
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMeetingSelect(meeting)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No meetings found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Try adjusting your search or filters"
                  : "Your meeting history will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Details Dialog */}
      <Dialog open={showMeetingDetails} onOpenChange={setShowMeetingDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedMeeting && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  {selectedMeeting.title}
                </DialogTitle>
                <DialogDescription>
                  Meeting held on {formatDate(selectedMeeting.started_at)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="participants">Participants</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="recordings">Recordings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Meeting Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Duration:</span>
                          <span className="text-sm">
                            {formatDuration(selectedMeeting.duration || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Participants:
                          </span>
                          <span className="text-sm">
                            {selectedMeeting.participants_count}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            Organizer:
                          </span>
                          <span className="text-sm">
                            {selectedMeeting.organizer?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge
                            className={getMeetingStatusColor(
                              selectedMeeting.status,
                            )}
                          >
                            {selectedMeeting.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Your Participation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedMeeting.participation_data ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                Attendance:
                              </span>
                              <span className="text-sm">
                                {Math.round(
                                  selectedMeeting.participation_data
                                    .attendance_percentage || 0,
                                )}
                                %
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                Speaking Time:
                              </span>
                              <span className="text-sm">
                                {formatDuration(
                                  selectedMeeting.participation_data
                                    .speaking_time || 0,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                Chat Messages:
                              </span>
                              <span className="text-sm">
                                {selectedMeeting.participation_data
                                  .chat_messages || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                Camera Time:
                              </span>
                              <span className="text-sm">
                                {formatDuration(
                                  selectedMeeting.participation_data
                                    .camera_time || 0,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">
                                Participation Score:
                              </span>
                              <Badge variant="outline">
                                {getParticipationScore(selectedMeeting)}/100
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No participation data available
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {selectedMeeting.description && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Description</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{selectedMeeting.description}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="participants" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Participants (
                        {selectedMeeting.participants?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        {selectedMeeting.participants?.length > 0 ? (
                          <div className="space-y-2">
                            {selectedMeeting.participants.map(
                              (participant, index) => (
                                <div
                                  key={participant.id || index}
                                  className="flex items-center justify-between p-2 border rounded"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={participant.avatar} />
                                      <AvatarFallback>
                                        {participant.name
                                          ?.split(" ")
                                          .map((n) => n[0])
                                          .join("") || "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium text-sm">
                                        {participant.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {participant.email}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {participant.was_host && (
                                      <Badge variant="outline" size="sm">
                                        Host
                                      </Badge>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      {formatDuration(
                                        participant.duration || 0,
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            No participant data available
                          </p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Engagement Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedMeeting.analytics ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                Average Attendance
                              </span>
                              <Badge variant="outline">
                                {Math.round(
                                  selectedMeeting.analytics
                                    .average_attendance || 0,
                                )}
                                %
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Peak Participants</span>
                              <Badge variant="outline">
                                {selectedMeeting.analytics.peak_participants ||
                                  0}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                Total Chat Messages
                              </span>
                              <Badge variant="outline">
                                {selectedMeeting.analytics
                                  .total_chat_messages || 0}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Screen Share Time</span>
                              <Badge variant="outline">
                                {formatDuration(
                                  selectedMeeting.analytics.screen_share_time ||
                                    0,
                                )}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            No analytics data available
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Quality Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedMeeting.quality_metrics ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Audio Quality</span>
                              <Badge
                                variant={
                                  selectedMeeting.quality_metrics
                                    .audio_quality > 80
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {selectedMeeting.quality_metrics
                                  .audio_quality || 0}
                                %
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Video Quality</span>
                              <Badge
                                variant={
                                  selectedMeeting.quality_metrics
                                    .video_quality > 80
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {selectedMeeting.quality_metrics
                                  .video_quality || 0}
                                %
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                Connection Stability
                              </span>
                              <Badge
                                variant={
                                  selectedMeeting.quality_metrics
                                    .connection_stability > 80
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {selectedMeeting.quality_metrics
                                  .connection_stability || 0}
                                %
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            No quality metrics available
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="recordings" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Recordings & Resources
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedMeeting.is_recorded ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Video className="w-8 h-8 text-blue-500" />
                              <div>
                                <div className="font-medium">
                                  Meeting Recording
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Duration:{" "}
                                  {formatDuration(
                                    selectedMeeting.duration || 0,
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline">
                                <Play className="w-4 h-4 mr-1" />
                                Play
                              </Button>
                              <Button size="sm" variant="outline">
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>

                          {selectedMeeting.chat_transcript && (
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <MessageSquare className="w-8 h-8 text-green-500" />
                                <div>
                                  <div className="font-medium">
                                    Chat Transcript
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {selectedMeeting.analytics
                                      ?.total_chat_messages || 0}{" "}
                                    messages
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline">
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Download className="w-4 h-4 mr-1" />
                                  Export
                                </Button>
                              </div>
                            </div>
                          )}

                          {selectedMeeting.shared_files?.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Shared Files</h4>
                              <div className="space-y-2">
                                {selectedMeeting.shared_files.map(
                                  (file, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-2 border rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <span className="text-sm">
                                          {file.name}
                                        </span>
                                      </div>
                                      <Button size="sm" variant="ghost">
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>This meeting was not recorded</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingHistoryViewer;
