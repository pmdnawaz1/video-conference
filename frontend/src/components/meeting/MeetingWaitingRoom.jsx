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
  Clock,
  Users,
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  UserCheck,
  Building,
  Calendar,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  Bell,
  Info,
  Heart,
  Coffee,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import meetingAccessService from "../../services/MeetingAccessService";
import userAnalyticsService from "../../services/UserAnalyticsService";
import useAuthStore from "../../stores/authStore";
import LoadingSpinner from "../ui/LoadingSpinner";

const MeetingWaitingRoom = ({
  meetingId,
  waitingRoomData,
  onAdmitted,
  onDenied,
  onLeave,
  meetingInfo,
}) => {
  const { user } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [deviceSettings, setDeviceSettings] = useState({
    audioEnabled: false,
    videoEnabled: false,
    volume: 0.5,
    videoPreview: false,
  });
  const [connectionQuality, setConnectionQuality] = useState("good");
  const [lastStatusCheck, setLastStatusCheck] = useState(Date.now());
  const [encouragementMessages] = useState([
    "Hang tight! The host will let you in soon.",
    "Good things come to those who wait...",
    "Perfect time to grab a coffee ☕",
    "Almost there! Thanks for your patience.",
    "The host is preparing an amazing meeting for you!",
    "Why not take a moment to check your audio and video?",
    "Great meetings are worth the wait!",
  ]);
  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    checkWaitingRoomStatus();
    const interval = setInterval(checkWaitingRoomStatus, 5000);

    return () => clearInterval(interval);
  }, [meetingId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaitTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % encouragementMessages.length);
    }, 8000);

    return () => clearInterval(messageInterval);
  }, []);

  useEffect(() => {
    userAnalyticsService.trackEvent("waiting_room_entered", {
      meeting_id: meetingId,
      queue_position: waitingRoomData?.queuePosition,
      timestamp: Date.now(),
    });

    return () => {
      userAnalyticsService.trackEvent("waiting_room_exited", {
        meeting_id: meetingId,
        wait_time: waitTime,
        timestamp: Date.now(),
      });
    };
  }, []);

  const checkWaitingRoomStatus = async () => {
    try {
      const result = await meetingAccessService.getWaitingRoomStatus(meetingId);

      if (result.success) {
        setStatus(result.data);
        setLastStatusCheck(Date.now());

        if (result.data.admitted) {
          userAnalyticsService.trackEvent("waiting_room_admitted", {
            meeting_id: meetingId,
            wait_time: waitTime,
            timestamp: Date.now(),
          });
          onAdmitted?.(result.data);
        } else if (result.data.denied) {
          userAnalyticsService.trackEvent("waiting_room_denied", {
            meeting_id: meetingId,
            wait_time: waitTime,
            denial_reason: result.data.denialReason,
            timestamp: Date.now(),
          });
          onDenied?.(result.data.denialReason);
        }
      }
    } catch (error) {
      console.error("Status check error:", error);
    }
  };

  const handleLeaveWaitingRoom = () => {
    userAnalyticsService.trackEvent("waiting_room_left_voluntarily", {
      meeting_id: meetingId,
      wait_time: waitTime,
      timestamp: Date.now(),
    });
    onLeave?.();
  };

  const handleDeviceTest = async (deviceType) => {
    setIsLoading(true);
    try {
      if (deviceType === "audio") {
        // Test microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setDeviceSettings((prev) => ({ ...prev, audioEnabled: true }));
        stream.getTracks().forEach((track) => track.stop());
      } else if (deviceType === "video") {
        // Test camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setDeviceSettings((prev) => ({
          ...prev,
          videoEnabled: true,
          videoPreview: true,
        }));
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (error) {
      console.error(`${deviceType} test error:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWaitTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getQueueMessage = () => {
    if (!status?.queuePosition) return "You're in the waiting room";

    if (status.queuePosition === 1) {
      return "You're next in line!";
    } else if (status.queuePosition <= 3) {
      return `You're ${status.queuePosition}${status.queuePosition === 2 ? "nd" : "rd"} in line`;
    } else {
      return `${status.queuePosition} people ahead of you`;
    }
  };

  const getConnectionQualityColor = (quality) => {
    switch (quality) {
      case "excellent":
        return "text-green-600 bg-green-100";
      case "good":
        return "text-blue-600 bg-blue-100";
      case "fair":
        return "text-yellow-600 bg-yellow-100";
      case "poor":
        return "text-red-600 bg-red-100";
      default:
        return "text-muted-foreground bg-muted0";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto flex items-center justify-center mb-4">
              <UserCheck className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-muted-foreground dark:text-white">
              Waiting Room
            </h1>
            <p className="text-lg text-muted-foreground dark:text-muted-foreground">
              {getQueueMessage()}
            </p>
          </div>

          {/* Wait Time */}
          <div className="bg-white dark:bg-muted0 rounded-lg p-4 inline-block">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-mono font-bold text-blue-600">
                  {formatWaitTime(waitTime)}
                </div>
                <div className="text-sm text-muted-foreground">Wait time</div>
              </div>
            </div>
          </div>

          {/* Encouragement Message */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg p-4 transition-all duration-500">
            <p className="text-purple-700 dark:text-purple-300 font-medium">
              {encouragementMessages[currentMessage]}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Meeting Info */}
            {meetingInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    {meetingInfo.title}
                  </CardTitle>
                  <CardDescription>{meetingInfo.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>
                        {new Date(
                          meetingInfo.scheduled_start,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-500" />
                      <span>
                        {new Date(
                          meetingInfo.scheduled_start,
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span>
                        {meetingInfo.participants_count || 0} participants
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-orange-500" />
                      <span>{meetingInfo.organizer?.name}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Waiting for admission</span>
                  </div>
                  <Badge variant="outline">
                    {status?.queuePosition
                      ? `Position ${status.queuePosition}`
                      : "In Queue"}
                  </Badge>
                </div>

                {status?.estimatedWait && (
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-lg font-semibold text-muted-foreground dark:text-muted-foreground">
                      ~{Math.round(status.estimatedWait / 60)} min
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Estimated wait
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span>Last status check:</span>
                  <span className="text-muted-foreground">
                    {Math.round((Date.now() - lastStatusCheck) / 1000)}s ago
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Connection Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Connection Quality</span>
                  <Badge
                    className={getConnectionQualityColor(connectionQuality)}
                  >
                    {connectionQuality}
                  </Badge>
                </div>

                <Progress value={85} className="w-full" />

                <div className="text-xs text-muted-foreground text-center">
                  Your connection looks good for video conferencing
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Device Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Device Setup
                </CardTitle>
                <CardDescription>
                  Test your audio and video before joining
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="audio" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="audio">Audio</TabsTrigger>
                    <TabsTrigger value="video">Video</TabsTrigger>
                  </TabsList>

                  <TabsContent value="audio" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {deviceSettings.audioEnabled ? (
                            <Mic className="w-4 h-4 text-green-500" />
                          ) : (
                            <MicOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">Microphone</span>
                        </div>
                        <Button
                          variant={
                            deviceSettings.audioEnabled ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleDeviceTest("audio")}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Test"
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {deviceSettings.volume > 0 ? (
                            <Volume2 className="w-4 h-4" />
                          ) : (
                            <VolumeX className="w-4 h-4" />
                          )}
                          <span className="text-sm">Speaker Volume</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted0 dark:bg-muted0 rounded-full">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-200"
                              style={{
                                width: `${deviceSettings.volume * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">
                            {Math.round(deviceSettings.volume * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="video" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {deviceSettings.videoEnabled ? (
                            <Camera className="w-4 h-4 text-green-500" />
                          ) : (
                            <CameraOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">Camera</span>
                        </div>
                        <Button
                          variant={
                            deviceSettings.videoEnabled ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleDeviceTest("video")}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Test"
                          )}
                        </Button>
                      </div>

                      {deviceSettings.videoPreview && (
                        <div className="bg-muted0 dark:bg-muted0 rounded-lg aspect-video flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
                            <p className="text-sm text-muted-foreground">
                              Video preview would appear here
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  While You Wait
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Test your microphone and camera</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Check your internet connection</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Find a quiet, well-lit space</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Have any materials ready</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Coffee className="w-4 h-4 text-orange-500 mt-0.5" />
                      <span>Maybe grab a coffee or water!</span>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={checkWaitingRoomStatus}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Status
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={handleLeaveWaitingRoom}
                  >
                    Leave Waiting Room
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>The host will be notified of your presence. Please be patient!</p>
        </div>
      </div>
    </div>
  );
};

export default MeetingWaitingRoom;
