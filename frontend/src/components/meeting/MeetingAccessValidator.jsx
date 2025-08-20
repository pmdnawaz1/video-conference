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
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Shield,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Building,
  Timer,
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Settings,
  Info,
  Zap,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Globe,
  Eye,
  EyeOff,
} from "lucide-react";
import meetingAccessService from "../../services/MeetingAccessService";
import userAnalyticsService from "../../services/UserAnalyticsService";
import useAuthStore from "../../stores/authStore";
import LoadingSpinner from "../ui/LoadingSpinner";

const MeetingAccessValidator = ({
  meetingId,
  onAccessGranted,
  onAccessDenied,
  onWaitingRoom,
  joinOptions = {
    audioEnabled: false,
    videoEnabled: false,
    screenShareEnabled: false,
  },
  showJoinOptions = true,
}) => {
  const { user } = useAuthStore();
  const [accessInfo, setAccessInfo] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationStep, setValidationStep] = useState("access");
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [localJoinOptions, setLocalJoinOptions] = useState(joinOptions);
  const [retryCount, setRetryCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    validateMeetingAccess();
  }, [meetingId]);

  useEffect(() => {
    let interval;
    if (accessInfo?.time?.success && accessInfo.time.data.timeUntilStart > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev && prev > 0) {
            return prev - 1;
          }
          // Re-validate when time is up
          if (prev === 0) {
            validateMeetingAccess();
          }
          return 0;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [accessInfo]);

  const validateMeetingAccess = async () => {
    setIsValidating(true);
    setError(null);
    setValidationStep("access");

    try {
      const result = await meetingAccessService.getMeetingAccessInfo(meetingId);

      if (result.success) {
        setAccessInfo(result.data);

        if (result.data.time.success) {
          setTimeRemaining(result.data.time.data.timeUntilStart);
        }

        // Determine next action based on validation results
        if (
          result.data.access.success &&
          result.data.access.data.accessGranted
        ) {
          if (result.data.access.data.waitingRoomRequired) {
            setValidationStep("waiting");
          } else if (
            result.data.time.success &&
            result.data.time.data.canJoin
          ) {
            setValidationStep("ready");
          } else {
            setValidationStep("waiting_time");
          }
        } else {
          setValidationStep("denied");
        }

        userAnalyticsService.trackEvent("meeting_access_validation_completed", {
          meeting_id: meetingId,
          access_granted: result.data.access.data?.accessGranted || false,
          validation_step: validationStep,
          timestamp: Date.now(),
        });
      } else {
        setError(result.error);
        setValidationStep("error");
      }
    } catch (error) {
      console.error("Access validation error:", error);
      setError("Failed to validate meeting access");
      setValidationStep("error");
    } finally {
      setIsValidating(false);
    }
  };

  const handleJoinMeeting = async () => {
    setIsValidating(true);

    try {
      const result = await meetingAccessService.joinMeeting(
        meetingId,
        localJoinOptions,
      );

      if (result.success) {
        onAccessGranted?.(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error("Join meeting error:", error);
      setError("Failed to join meeting");
    } finally {
      setIsValidating(false);
    }
  };

  const handleJoinWaitingRoom = async () => {
    setIsValidating(true);

    try {
      const result = await meetingAccessService.joinWaitingRoom(meetingId, {
        name: user?.first_name + " " + user?.last_name,
        email: user?.email,
        organization: user?.organization?.name,
      });

      if (result.success) {
        onWaitingRoom?.(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error("Join waiting room error:", error);
      setError("Failed to join waiting room");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    validateMeetingAccess();
  };

  const getValidationIcon = (success, loading = false) => {
    if (loading) return <Loader2 className="w-4 h-4 animate-spin" />;
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "Now";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const renderValidationStatus = () => {
    if (!accessInfo) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {getValidationIcon(accessInfo.access.success)}
            <span className="text-sm font-medium">Access Validation</span>
          </div>
          <Badge
            variant={accessInfo.access.success ? "default" : "destructive"}
          >
            {accessInfo.access.success
              ? accessInfo.access.data.accessGranted
                ? "Granted"
                : "Restricted"
              : "Failed"}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {getValidationIcon(accessInfo.time.success)}
            <span className="text-sm font-medium">Time Validation</span>
          </div>
          <Badge
            variant={
              accessInfo.time.success && accessInfo.time.data.canJoin
                ? "default"
                : "secondary"
            }
          >
            {accessInfo.time.success
              ? accessInfo.time.data.canJoin
                ? "Available"
                : "Waiting"
              : "Unknown"}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {getValidationIcon(accessInfo.organization.success)}
            <span className="text-sm font-medium">Organization</span>
          </div>
          <Badge
            variant={
              accessInfo.organization.success &&
              accessInfo.organization.data.isMember
                ? "default"
                : "secondary"
            }
          >
            {accessInfo.organization.success
              ? accessInfo.organization.data.isMember
                ? "Member"
                : "Guest"
              : "Unknown"}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {getValidationIcon(accessInfo.history.success)}
            <span className="text-sm font-medium">History</span>
          </div>
          <Badge variant="outline">
            {accessInfo.history.success
              ? `${accessInfo.history.data.participationCount || 0} meetings`
              : "Unknown"}
          </Badge>
        </div>
      </div>
    );
  };

  const renderMeetingInfo = () => {
    if (!accessInfo?.access?.success || !accessInfo.access.data.meetingInfo)
      return null;

    const meeting = accessInfo.access.data.meetingInfo;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            {meeting.title}
          </CardTitle>
          <CardDescription>{meeting.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>
                {new Date(meeting.scheduled_start).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-green-500" />
              <span>
                {new Date(meeting.scheduled_start).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span>{meeting.participants_count || 0} participants</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" />
              <span>{meeting.organizer?.name}</span>
            </div>
          </div>

          {meeting.status && (
            <div className="flex items-center gap-2">
              <Badge
                variant={meeting.status === "active" ? "default" : "secondary"}
              >
                {meeting.status}
              </Badge>
              {meeting.is_locked && (
                <Badge variant="outline">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderJoinOptions = () => {
    if (!showJoinOptions) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Join Options
          </CardTitle>
          <CardDescription>
            Configure your audio and video settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {localJoinOptions.audioEnabled ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
              <span className="text-sm">Microphone</span>
            </div>
            <Button
              variant={localJoinOptions.audioEnabled ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setLocalJoinOptions((prev) => ({
                  ...prev,
                  audioEnabled: !prev.audioEnabled,
                }))
              }
            >
              {localJoinOptions.audioEnabled ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {localJoinOptions.videoEnabled ? (
                <Camera className="w-4 h-4" />
              ) : (
                <CameraOff className="w-4 h-4" />
              )}
              <span className="text-sm">Camera</span>
            </div>
            <Button
              variant={localJoinOptions.videoEnabled ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setLocalJoinOptions((prev) => ({
                  ...prev,
                  videoEnabled: !prev.videoEnabled,
                }))
              }
            >
              {localJoinOptions.videoEnabled ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Screen Share Ready</span>
            </div>
            <Button
              variant={
                localJoinOptions.screenShareEnabled ? "default" : "outline"
              }
              size="sm"
              onClick={() =>
                setLocalJoinOptions((prev) => ({
                  ...prev,
                  screenShareEnabled: !prev.screenShareEnabled,
                }))
              }
            >
              {localJoinOptions.screenShareEnabled ? "Ready" : "Not Ready"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTimeCountdown = () => {
    if (
      !accessInfo?.time?.success ||
      !accessInfo.time.data.timeUntilStart ||
      accessInfo.time.data.timeUntilStart <= 0
    ) {
      return null;
    }

    const progress = Math.max(
      0,
      100 - (timeRemaining / accessInfo.time.data.timeUntilStart) * 100,
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Meeting Starts In
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {formatTimeRemaining(timeRemaining)}
            </div>
            <div className="text-sm text-muted-foreground">
              {accessInfo.time.data.bufferTime &&
                accessInfo.time.data.bufferTime > 0 &&
                `You can join ${accessInfo.time.data.bufferTime} minutes early`}
            </div>
          </div>
          <Progress value={progress} className="w-full" />
        </CardContent>
      </Card>
    );
  };

  if (isValidating && !accessInfo) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <div>
              <h3 className="text-lg font-medium">Validating Access</h3>
              <p className="text-sm text-muted-foreground">
                Checking meeting permissions and time restrictions...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || validationStep === "error") {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Validation Failed</AlertTitle>
            <AlertDescription className="mt-2">{error}</AlertDescription>
          </Alert>

          <div className="mt-6 text-center">
            <Button onClick={handleRetry} disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Meeting Access Validation</h1>
        </div>
        <p className="text-muted-foreground">
          Please wait while we verify your access to this meeting
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {renderMeetingInfo()}
          {renderTimeCountdown()}
          {renderJoinOptions()}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Validation Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Validation Status</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showAdvanced ? (
                renderValidationStatus()
              ) : (
                <div className="text-center space-y-4">
                  {validationStep === "ready" && (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <div>
                        <h3 className="font-medium text-green-700">
                          Access Granted
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          You can join this meeting now
                        </p>
                      </div>
                    </>
                  )}

                  {validationStep === "waiting" && (
                    <>
                      <UserCheck className="w-12 h-12 text-blue-500 mx-auto" />
                      <div>
                        <h3 className="font-medium text-blue-700">
                          Waiting Room Required
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          You'll need to wait for admission
                        </p>
                      </div>
                    </>
                  )}

                  {validationStep === "waiting_time" && (
                    <>
                      <Clock className="w-12 h-12 text-yellow-500 mx-auto" />
                      <div>
                        <h3 className="font-medium text-yellow-700">
                          Meeting Not Started
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Please wait for the scheduled time
                        </p>
                      </div>
                    </>
                  )}

                  {validationStep === "denied" && (
                    <>
                      <UserX className="w-12 h-12 text-red-500 mx-auto" />
                      <div>
                        <h3 className="font-medium text-red-700">
                          Access Denied
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {accessInfo?.access?.data?.reason ||
                            "You do not have permission to join this meeting"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {validationStep === "ready" && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleJoinMeeting}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining Meeting...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        Join Meeting
                      </>
                    )}
                  </Button>
                )}

                {validationStep === "waiting" && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleJoinWaitingRoom}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining Waiting Room...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Join Waiting Room
                      </>
                    )}
                  </Button>
                )}

                {(validationStep === "waiting_time" ||
                  validationStep === "denied") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleRetry}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Again
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => onAccessDenied?.("user_cancelled")}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeetingAccessValidator;
