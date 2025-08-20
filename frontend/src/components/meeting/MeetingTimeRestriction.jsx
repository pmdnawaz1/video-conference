import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  RefreshCw,
  Timer,
  Video,
  Users,
  Building,
  CheckCircle,
  XCircle,
  Zap,
  Bell,
  ArrowLeft,
  CalendarDays,
  Loader2,
} from "lucide-react";
import meetingAccessService from "../../services/MeetingAccessService";
import userAnalyticsService from "../../services/UserAnalyticsService";
import LoadingSpinner from "../ui/LoadingSpinner";

const MeetingTimeRestriction = ({
  meetingId,
  meetingInfo,
  timeRestrictions,
  onRetryAccess,
  onBackToDashboard,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeUntilAvailable, setTimeUntilAvailable] = useState(null);
  const [restrictionType, setRestrictionType] = useState("unknown");
  const [isChecking, setIsChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      calculateTimeUntilAvailable();
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRestrictions]);

  useEffect(() => {
    calculateTimeUntilAvailable();
    determineRestrictionType();
  }, [timeRestrictions, currentTime]);

  useEffect(() => {
    userAnalyticsService.trackEvent("meeting_time_restriction_viewed", {
      meeting_id: meetingId,
      restriction_type: restrictionType,
      time_until_available: timeUntilAvailable,
      timestamp: Date.now(),
    });
  }, [restrictionType]);

  useEffect(() => {
    let autoRefreshInterval;
    if (
      autoRefresh &&
      timeUntilAvailable !== null &&
      timeUntilAvailable <= 60
    ) {
      // Auto-refresh when very close to meeting time
      autoRefreshInterval = setInterval(() => {
        handleCheckAccess();
      }, 30000); // Check every 30 seconds when close
    }

    return () => {
      if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    };
  }, [autoRefresh, timeUntilAvailable]);

  const calculateTimeUntilAvailable = () => {
    if (!timeRestrictions) return;

    const now = currentTime.getTime();
    const scheduledStart = new Date(timeRestrictions.scheduledStart).getTime();
    const scheduledEnd = new Date(timeRestrictions.scheduledEnd).getTime();
    const bufferTime = (timeRestrictions.bufferTime || 0) * 60 * 1000; // Convert minutes to ms

    if (timeRestrictions.status === "not_started") {
      const availableTime = scheduledStart - bufferTime;
      setTimeUntilAvailable(
        Math.max(0, Math.floor((availableTime - now) / 1000)),
      );
    } else if (timeRestrictions.status === "ended") {
      setTimeUntilAvailable(0);
    } else {
      setTimeUntilAvailable(0);
    }
  };

  const determineRestrictionType = () => {
    if (!timeRestrictions) {
      setRestrictionType("unknown");
      return;
    }

    switch (timeRestrictions.status) {
      case "not_started":
        setRestrictionType("too_early");
        break;
      case "ended":
        setRestrictionType("too_late");
        break;
      case "cancelled":
        setRestrictionType("cancelled");
        break;
      case "locked":
        setRestrictionType("locked");
        break;
      default:
        setRestrictionType("unknown");
    }
  };

  const handleCheckAccess = async () => {
    setIsChecking(true);
    try {
      const result =
        await meetingAccessService.checkTimeRestrictions(meetingId);

      if (result.success && result.data.canJoin) {
        userAnalyticsService.trackEvent("meeting_time_restriction_resolved", {
          meeting_id: meetingId,
          resolution_type: "can_join_now",
          timestamp: Date.now(),
        });
        onRetryAccess?.();
      } else {
        // Update time restrictions with new data
        if (result.success) {
          // This would update the parent component's time restrictions
        }
      }
    } catch (error) {
      console.error("Time check error:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "0s";

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRestrictionInfo = () => {
    switch (restrictionType) {
      case "too_early":
        return {
          icon: <Timer className="w-12 h-12 text-blue-500" />,
          title: "Meeting Not Started Yet",
          description:
            "This meeting is scheduled for a future time. Please come back when it's time to join.",
          color: "blue",
          showCountdown: true,
        };
      case "too_late":
        return {
          icon: <XCircle className="w-12 h-12 text-red-500" />,
          title: "Meeting Has Ended",
          description:
            "Unfortunately, this meeting has already concluded. You may be able to view recordings if available.",
          color: "red",
          showCountdown: false,
        };
      case "cancelled":
        return {
          icon: <XCircle className="w-12 h-12 text-muted-foreground" />,
          title: "Meeting Cancelled",
          description:
            "This meeting has been cancelled by the organizer. Please contact them for more information.",
          color: "gray",
          showCountdown: false,
        };
      case "locked":
        return {
          icon: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
          title: "Meeting Locked",
          description:
            "The organizer has locked this meeting and is not accepting new participants at this time.",
          color: "yellow",
          showCountdown: false,
        };
      default:
        return {
          icon: <AlertTriangle className="w-12 h-12 text-muted-foreground" />,
          title: "Access Restricted",
          description:
            "There appears to be a restriction preventing you from joining this meeting right now.",
          color: "gray",
          showCountdown: false,
        };
    }
  };

  const restriction = getRestrictionInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" onClick={onBackToDashboard}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center space-y-6">
          {/* Restriction Icon and Message */}
          <div className="space-y-4">
            {restriction.icon}
            <div>
              <h1 className="text-3xl font-bold text-muted-foreground dark:text-white">
                {restriction.title}
              </h1>
              <p className="text-lg text-muted-foreground dark:text-muted-foreground mt-2">
                {restriction.description}
              </p>
            </div>
          </div>

          {/* Countdown Timer */}
          {restriction.showCountdown &&
            timeUntilAvailable !== null &&
            timeUntilAvailable > 0 && (
              <Card className="inline-block">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="text-4xl font-mono font-bold text-blue-600">
                      {formatTimeRemaining(timeUntilAvailable)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      until you can join
                    </div>
                    {timeUntilAvailable <= 300 && ( // Show progress bar when less than 5 minutes
                      <div className="w-64 mx-auto">
                        <Progress
                          value={Math.max(
                            0,
                            100 - (timeUntilAvailable / 300) * 100,
                          )}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meeting Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Meeting Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {meetingInfo && (
                <>
                  <div>
                    <h3 className="font-medium text-lg">{meetingInfo.title}</h3>
                    {meetingInfo.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {meetingInfo.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-orange-500" />
                      <span>Organizer: {meetingInfo.organizer?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span>
                        {meetingInfo.participants_count || 0} participants
                        expected
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Time Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeRestrictions && (
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">
                      Scheduled Start:
                    </span>
                    <div className="text-right">
                      <div className="text-sm">
                        {formatDateTime(timeRestrictions.scheduledStart)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">Scheduled End:</span>
                    <div className="text-right">
                      <div className="text-sm">
                        {formatDateTime(timeRestrictions.scheduledEnd)}
                      </div>
                    </div>
                  </div>

                  {timeRestrictions.bufferTime &&
                    timeRestrictions.bufferTime > 0 && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">Early Join:</span>
                        <div className="text-right">
                          <div className="text-sm">
                            {timeRestrictions.bufferTime} minutes before start
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">Current Status:</span>
                    <Badge
                      variant={
                        restriction.color === "blue" ? "default" : "secondary"
                      }
                    >
                      {timeRestrictions.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Current Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold">
                  {currentTime.toLocaleTimeString()}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {currentTime.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {restrictionType === "too_early" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Set a Reminder</AlertTitle>
                  <AlertDescription>
                    Consider setting a calendar reminder for{" "}
                    {formatDateTime(timeRestrictions.scheduledStart)}
                  </AlertDescription>
                </Alert>
              )}

              {restrictionType === "too_late" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Check for Recordings</AlertTitle>
                  <AlertDescription>
                    You may be able to view meeting recordings or get a summary
                    from the organizer.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                {(restrictionType === "too_early" ||
                  restrictionType === "locked") && (
                  <Button
                    className="w-full"
                    onClick={handleCheckAccess}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check if Available Now
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onBackToDashboard}
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>

                {restrictionType === "too_early" && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="auto-refresh"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    <label
                      htmlFor="auto-refresh"
                      className="text-sm text-muted-foreground"
                    >
                      Auto-check when meeting time approaches
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips for Different Scenarios */}
        {restrictionType === "too_early" && timeUntilAvailable > 3600 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                While You Wait
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Add this meeting to your calendar</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Prepare any materials or documents</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Test your audio and video setup</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>Review the meeting agenda if available</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MeetingTimeRestriction;
