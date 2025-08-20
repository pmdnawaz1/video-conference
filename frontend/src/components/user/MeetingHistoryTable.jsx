import React, { useState } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import {
  FiClock,
  FiUsers,
  FiMessageSquare,
  FiVideo,
  FiPlay,
  FiPause,
  FiEye,
  FiDownload,
  FiShare2,
  FiCalendar,
  FiMoreHorizontal,
  FiX,
  FiMinus,
} from "react-icons/fi";
import { FaCheckCircle } from "react-icons/fa";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

const MeetingHistoryTable = ({
  meetings = [],
  isLoading = false,
  onViewDetails,
}) => {
  const [selectedMeetings, setSelectedMeetings] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRowSelection = (meetingId) => {
    const newSelected = new Set(selectedMeetings);
    if (newSelected.has(meetingId)) {
      newSelected.delete(meetingId);
    } else {
      newSelected.add(meetingId);
    }
    setSelectedMeetings(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedMeetings.size === meetings.length) {
      setSelectedMeetings(new Set());
    } else {
      setSelectedMeetings(new Set(meetings.map((m) => m.id)));
    }
  };

  const toggleRowExpansion = (meetingId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(meetingId)) {
      newExpanded.delete(meetingId);
    } else {
      newExpanded.add(meetingId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "no_show":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "ongoing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-muted0 text-muted-foreground dark:bg-muted0 dark:text-muted-foreground";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <FaCheckCircle className="w-3 h-3" />;
      case "cancelled":
        return <FiX className="w-3 h-3" />;
      case "no_show":
        return <FiMinus className="w-3 h-3" />;
      case "ongoing":
        return <FiPlay className="w-3 h-3" />;
      default:
        return <FiClock className="w-3 h-3" />;
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";
    try {
      const minutes = differenceInMinutes(
        new Date(endTime),
        new Date(startTime),
      );
      if (isNaN(minutes)) return "N/A";
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${minutes}m`;
    } catch (error) {
      return "N/A";
    }
  };

  const safeFormat = (date, formatString, fallback = "N/A") => {
    if (!date) return fallback;
    try {
      return format(new Date(date), formatString);
    } catch (error) {
      return fallback;
    }
  };

  const safeFormatDistanceToNow = (date, options, fallback = "N/A") => {
    if (!date) return fallback;
    try {
      return formatDistanceToNow(new Date(date), options);
    } catch (error) {
      return fallback;
    }
  };

  const getParticipationScore = (participation) => {
    if (!participation) return 0;
    const { joinTime, leaveTime, totalDuration } = participation;
    if (!joinTime || !leaveTime || !totalDuration) return 0;

    const attendedMinutes = differenceInMinutes(
      new Date(leaveTime),
      new Date(joinTime),
    );
    return Math.round((attendedMinutes / totalDuration) * 100);
  };

  const getEngagementLevel = (engagement) => {
    if (!engagement) return "low";
    const score =
      engagement.chatMessages + engagement.reactions + engagement.speakingTime;
    if (score >= 20) return "high";
    if (score >= 10) return "medium";
    return "low";
  };

  const getEngagementColor = (level) => {
    switch (level) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-blue-600";
      default:
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <LoadingSpinner className="w-8 h-8" />
          <p className="text-muted-foreground">Loading meeting history...</p>
        </div>
      </Card>
    );
  }

  if (!meetings || meetings.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <FiVideo className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">No Meeting History</h3>
            <p className="text-muted-foreground">
              Your meeting history will appear here once you start participating
              in meetings.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedMeetings.size > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedMeetings.size} meeting
              {selectedMeetings.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <FiDownload className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <FiShare2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Desktop Table View */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-4 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedMeetings.size === meetings.length &&
                      meetings.length > 0
                    }
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    aria-label="Select all meetings"
                  />
                </th>
                <th className="p-4 text-left font-medium">Meeting</th>
                <th className="p-4 text-left font-medium">Date & Time</th>
                <th className="p-4 text-left font-medium">Duration</th>
                <th className="p-4 text-left font-medium">Participants</th>
                <th className="p-4 text-left font-medium">
                  Your Participation
                </th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {meetings.map((meeting) => (
                <React.Fragment key={meeting.id}>
                  <tr
                    className={`hover:bg-muted/50 transition-colors ${
                      selectedMeetings.has(meeting.id) ? "bg-muted/50" : ""
                    }`}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedMeetings.has(meeting.id)}
                        onChange={() => toggleRowSelection(meeting.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label={`Select ${meeting.title}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <h3 className="font-medium text-foreground">
                          {meeting.title}
                        </h3>
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {meeting.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <FiCalendar className="w-4 h-4 text-muted-foreground" />
                          {safeFormat(
                            meeting.scheduledStartTime,
                            "MMM dd, yyyy",
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {safeFormat(meeting.scheduledStartTime, "HH:mm")} -{" "}
                          {safeFormat(meeting.scheduledEndTime, "HH:mm")}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <FiClock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {formatDuration(
                            meeting.actualStartTime ||
                              meeting.scheduledStartTime,
                            meeting.actualEndTime || meeting.scheduledEndTime,
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <FiUsers className="w-4 h-4 text-muted-foreground" />
                        <span>{meeting.participants?.length || 0} people</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-muted0 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${getParticipationScore(meeting.userParticipation)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {getParticipationScore(meeting.userParticipation)}%
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs">
                          <FiMessageSquare className="w-3 h-3" />
                          <span>
                            {meeting.userEngagement?.chatMessages || 0} messages
                          </span>
                          <span
                            className={`ml-2 ${getEngagementColor(getEngagementLevel(meeting.userEngagement))}`}
                          >
                            {getEngagementLevel(meeting.userEngagement)}{" "}
                            engagement
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        className={`${getStatusColor(meeting.status)} flex items-center space-x-1`}
                      >
                        {getStatusIcon(meeting.status)}
                        <span className="capitalize">{meeting.status}</span>
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(meeting)}
                          aria-label={`View details for ${meeting.title}`}
                        >
                          <FiEye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(meeting.id)}
                          aria-label={`${expandedRows.has(meeting.id) ? "Collapse" : "Expand"} row`}
                        >
                          <FiMoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Details */}
                  {expandedRows.has(meeting.id) && (
                    <tr className="bg-muted/25">
                      <td colSpan="8" className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium mb-2">
                              Meeting Details
                            </h4>
                            <div className="space-y-1 text-muted-foreground">
                              <p>Meeting ID: {meeting.id}</p>
                              <p>
                                Created:{" "}
                                {safeFormatDistanceToNow(meeting.createdAt, {
                                  addSuffix: true,
                                })}
                              </p>
                              {meeting.host && (
                                <p>
                                  Host: {meeting.host.firstName}{" "}
                                  {meeting.host.lastName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Your Activity</h4>
                            <div className="space-y-1 text-muted-foreground">
                              {meeting.userParticipation?.joinTime && (
                                <p>
                                  Joined:{" "}
                                  {safeFormat(
                                    meeting.userParticipation.joinTime,
                                    "HH:mm",
                                  )}
                                </p>
                              )}
                              {meeting.userParticipation?.leaveTime && (
                                <p>
                                  Left:{" "}
                                  {safeFormat(
                                    meeting.userParticipation.leaveTime,
                                    "HH:mm",
                                  )}
                                </p>
                              )}
                              <p>
                                Speaking time:{" "}
                                {Math.round(
                                  meeting.userEngagement?.speakingTime || 0,
                                )}
                                min
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">
                              Available Actions
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {meeting.hasRecording && (
                                <Button variant="outline" size="sm">
                                  <FiPlay className="w-4 h-4 mr-2" />
                                  View Recording
                                </Button>
                              )}
                              {meeting.hasChatHistory && (
                                <Button variant="outline" size="sm">
                                  <FiMessageSquare className="w-4 h-4 mr-2" />
                                  Chat History
                                </Button>
                              )}
                              <Button variant="outline" size="sm">
                                <FiDownload className="w-4 h-4 mr-2" />
                                Export Data
                              </Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedMeetings.has(meeting.id)}
                    onChange={() => toggleRowSelection(meeting.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    aria-label={`Select ${meeting.title}`}
                  />
                  <h3 className="font-medium text-foreground line-clamp-1">
                    {meeting.title}
                  </h3>
                </div>

                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <FiCalendar className="w-4 h-4" />
                    <span>
                      {safeFormat(
                        meeting.scheduledStartTime || meeting.scheduled_start,
                        "MMM dd",
                      )}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FiClock className="w-4 h-4" />
                    <span>
                      {formatDuration(
                        meeting.actualStartTime ||
                          meeting.actual_start ||
                          meeting.scheduledStartTime ||
                          meeting.scheduled_start,
                        meeting.actualEndTime ||
                          meeting.actual_end ||
                          meeting.scheduledEndTime ||
                          meeting.scheduled_end,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FiUsers className="w-4 h-4" />
                    <span>{meeting.participants?.length || 0}</span>
                  </div>
                </div>
              </div>

              <Badge
                className={`${getStatusColor(meeting.status)} flex items-center space-x-1 ml-2`}
              >
                {getStatusIcon(meeting.status)}
                <span className="capitalize">{meeting.status}</span>
              </Badge>
            </div>

            {/* Participation Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Your Participation
                </span>
                <span className="font-medium">
                  {getParticipationScore(meeting.userParticipation)}%
                </span>
              </div>
              <div className="flex-1 bg-muted0 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${getParticipationScore(meeting.userParticipation)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <FiMessageSquare className="w-3 h-3" />
                  <span>
                    {meeting.userEngagement?.chatMessages || 0} messages
                  </span>
                </div>
                <span
                  className={getEngagementColor(
                    getEngagementLevel(meeting.userEngagement),
                  )}
                >
                  {getEngagementLevel(meeting.userEngagement)} engagement
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(meeting)}
              >
                <FiEye className="w-4 h-4 mr-2" />
                View Details
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="More actions">
                    <FiMoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {meeting.hasRecording && (
                    <DropdownMenuItem>
                      <FiPlay className="w-4 h-4 mr-2" />
                      View Recording
                    </DropdownMenuItem>
                  )}
                  {meeting.hasChatHistory && (
                    <DropdownMenuItem>
                      <FiMessageSquare className="w-4 h-4 mr-2" />
                      Chat History
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <FiDownload className="w-4 h-4 mr-2" />
                    Export Data
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FiShare2 className="w-4 h-4 mr-2" />
                    Share Meeting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Load More Button */}
      {meetings.length >= 20 && (
        <div className="text-center pt-4">
          <Button variant="outline" className="w-full lg:w-auto">
            Load More Meetings
          </Button>
        </div>
      )}
    </div>
  );
};

export default MeetingHistoryTable;
