import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Slider } from "../ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  FiVideo,
  FiSettings,
  FiCamera,
  FiMic,
  FiSpeaker,
  FiHeadphones,
  FiEye,
  FiUsers,
  FiWifi,
  FiShield,
  FiCalendar,
  FiRefreshCw,
  FiSave,
  FiX,
} from "react-icons/fi";
import useUserStore from "../../stores/userStore";

const MeetingPreferences = ({ onClose }) => {
  const { preferences, updatePreferences } = useUserStore();

  const [formData, setFormData] = useState({
    defaultAudio: true,
    defaultVideo: false,
    autoJoin: false,
    backgroundBlur: false,
    virtualBackground: null,
    cameraPreview: true,
    speakerView: "auto",
    gridLayout: "auto",
    microphoneGain: 75,
    speakerVolume: 80,
    echoCancellation: true,
    noiseSuppression: true,
    autoMute: false,
    joinMuted: false,
    autoRecord: false,
    joinEarly: true,
    earlyJoinMinutes: 5,
    autoLeave: false,
    autoLeaveMinutes: 5,
    showParticipantList: true,
    showChat: true,
    waitingRoom: false,
    requirePassword: false,
    allowScreenShare: true,
    allowRecording: true,
    allowChat: true,
    participantControls: "all",
    videoQuality: "auto",
    bandwidth: "auto",
    adaptiveQuality: true,
    captions: false,
    highContrast: false,
    largeText: false,
    keyboardShortcuts: true,
    calendarSync: false,
    defaultMeetingLength: 60,
    bufferTime: 5,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [selectedDevices, setSelectedDevices] = useState({
    camera: null,
    microphone: null,
    speaker: null,
  });

  const [devices, setDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: [],
  });

  const [testingDevice, setTestingDevice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (preferences?.meeting) {
      setFormData({
        ...formData,
        ...preferences.meeting,
      });
    }
    getAvailableDevices();
  }, [preferences]);

  useEffect(() => {
    const hasChanges =
      JSON.stringify(formData) !== JSON.stringify(preferences?.meeting || {});
    setIsDirty(hasChanges);
  }, [formData, preferences]);

  const getAvailableDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const deviceList = await navigator.mediaDevices.enumerateDevices();

      const cameras = deviceList.filter(
        (device) => device.kind === "videoinput",
      );
      const microphones = deviceList.filter(
        (device) => device.kind === "audioinput",
      );
      const speakers = deviceList.filter(
        (device) => device.kind === "audiooutput",
      );

      setDevices({ cameras, microphones, speakers });

      // Stop the stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error("Failed to get devices:", error);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDeviceChange = (deviceType, deviceId) => {
    setSelectedDevices((prev) => ({
      ...prev,
      [deviceType]: deviceId,
    }));
  };

  const testDevice = async (deviceType, deviceId) => {
    setTestingDevice(deviceType);

    try {
      if (deviceType === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: deviceId ? { exact: deviceId } : undefined },
        });

        // Show preview for 3 seconds
        setTimeout(() => {
          stream.getTracks().forEach((track) => track.stop());
          setTestingDevice(null);
        }, 3000);
      } else if (deviceType === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
        });

        // Test microphone for 3 seconds
        setTimeout(() => {
          stream.getTracks().forEach((track) => track.stop());
          setTestingDevice(null);
        }, 3000);
      } else if (deviceType === "speaker") {
        // Play test sound
        const audio = new Audio("/test-sound.mp3");
        if (deviceId && audio.setSinkId) {
          await audio.setSinkId(deviceId);
        }
        audio.play();

        setTimeout(() => {
          setTestingDevice(null);
        }, 2000);
      }
    } catch (error) {
      console.error(`Failed to test ${deviceType}:`, error);
      setTestingDevice(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await updatePreferences({
        meeting: formData,
      });

      if (result.success) {
        await updateDevicePreferences(selectedDevices);
        setIsDirty(false);
        // Show success message
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateDevicePreferences = async (devices) => {
    // Store device preferences in localStorage or user preferences
    localStorage.setItem("meetingDevicePreferences", JSON.stringify(devices));
  };

  const resetToDefaults = () => {
    const confirmReset = confirm(
      "This will reset all meeting preferences to their default values. Continue?",
    );
    if (confirmReset) {
      setFormData({
        defaultAudio: true,
        defaultVideo: false,
        autoJoin: false,
        backgroundBlur: false,
        virtualBackground: null,
        cameraPreview: true,
        speakerView: "auto",
        gridLayout: "auto",
        microphoneGain: 75,
        speakerVolume: 80,
        echoCancellation: true,
        noiseSuppression: true,
        autoMute: false,
        joinMuted: false,
        autoRecord: false,
        joinEarly: true,
        earlyJoinMinutes: 5,
        autoLeave: false,
        autoLeaveMinutes: 5,
        showParticipantList: true,
        showChat: true,
        waitingRoom: false,
        requirePassword: false,
        allowScreenShare: true,
        allowRecording: true,
        allowChat: true,
        participantControls: "all",
        videoQuality: "auto",
        bandwidth: "auto",
        adaptiveQuality: true,
        captions: false,
        highContrast: false,
        largeText: false,
        keyboardShortcuts: true,
        calendarSync: false,
        defaultMeetingLength: 60,
        bufferTime: 5,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Meeting Preferences
          </h1>
          <p className="text-muted-foreground">
            Customize your default meeting settings and behavior
          </p>
        </div>

        {onClose && (
          <Button variant="outline" onClick={onClose}>
            <FiX className="w-4 h-4 mr-2" />
            Close
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Audio/Video Defaults */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiVideo className="w-5 h-5 mr-2" />
            Audio & Video Defaults
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Join with Audio</p>
                <p className="text-sm text-muted-foreground">
                  Automatically enable microphone
                </p>
              </div>
              <Switch
                checked={formData.defaultAudio}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("defaultAudio", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Join with Video</p>
                <p className="text-sm text-muted-foreground">
                  Automatically enable camera
                </p>
              </div>
              <Switch
                checked={formData.defaultVideo}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("defaultVideo", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-Join Meetings</p>
                <p className="text-sm text-muted-foreground">
                  Join scheduled meetings automatically
                </p>
              </div>
              <Switch
                checked={formData.autoJoin}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("autoJoin", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Join Muted</p>
                <p className="text-sm text-muted-foreground">
                  Start with microphone muted
                </p>
              </div>
              <Switch
                checked={formData.joinMuted}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("joinMuted", checked)
                }
              />
            </div>
          </div>
        </Card>

        {/* Device Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiSettings className="w-5 h-5 mr-2" />
            Device Selection
          </h3>

          <div className="space-y-6">
            {/* Camera */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center">
                <FiCamera className="w-4 h-4 mr-2" />
                Camera
              </label>
              <div className="flex space-x-2">
                <Select
                  value={selectedDevices.camera || "default"}
                  onValueChange={(value) =>
                    handleDeviceChange(
                      "camera",
                      value === "default" ? null : value,
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Camera</SelectItem>
                    {devices.cameras.map((camera) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label ||
                          `Camera ${camera.deviceId.substring(0, 8)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testDevice("camera", selectedDevices.camera)}
                  disabled={testingDevice === "camera"}
                >
                  {testingDevice === "camera" ? (
                    <LoadingSpinner className="w-4 h-4" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>

            {/* Microphone */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center">
                <FiMic className="w-4 h-4 mr-2" />
                Microphone
              </label>
              <div className="flex space-x-2">
                <Select
                  value={selectedDevices.microphone || "default"}
                  onValueChange={(value) =>
                    handleDeviceChange(
                      "microphone",
                      value === "default" ? null : value,
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Microphone</SelectItem>
                    {devices.microphones.map((mic) => (
                      <SelectItem key={mic.deviceId} value={mic.deviceId}>
                        {mic.label ||
                          `Microphone ${mic.deviceId.substring(0, 8)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    testDevice("microphone", selectedDevices.microphone)
                  }
                  disabled={testingDevice === "microphone"}
                >
                  {testingDevice === "microphone" ? (
                    <LoadingSpinner className="w-4 h-4" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>

            {/* Speaker */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center">
                <FiSpeaker className="w-4 h-4 mr-2" />
                Speaker
              </label>
              <div className="flex space-x-2">
                <Select
                  value={selectedDevices.speaker || "default"}
                  onValueChange={(value) =>
                    handleDeviceChange(
                      "speaker",
                      value === "default" ? null : value,
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select speaker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Speaker</SelectItem>
                    {devices.speakers.map((speaker) => (
                      <SelectItem
                        key={speaker.deviceId}
                        value={speaker.deviceId}
                      >
                        {speaker.label ||
                          `Speaker ${speaker.deviceId.substring(0, 8)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testDevice("speaker", selectedDevices.speaker)}
                  disabled={testingDevice === "speaker"}
                >
                  {testingDevice === "speaker" ? (
                    <LoadingSpinner className="w-4 h-4" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Audio Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiHeadphones className="w-5 h-5 mr-2" />
            Audio Settings
          </h3>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Microphone Gain</label>
                <span className="text-sm text-muted-foreground">
                  {formData.microphoneGain}%
                </span>
              </div>
              <Slider
                value={[formData.microphoneGain]}
                onValueChange={([value]) =>
                  handlePreferenceChange("microphoneGain", value)
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Speaker Volume</label>
                <span className="text-sm text-muted-foreground">
                  {formData.speakerVolume}%
                </span>
              </div>
              <Slider
                value={[formData.speakerVolume]}
                onValueChange={([value]) =>
                  handlePreferenceChange("speakerVolume", value)
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Echo Cancellation</p>
                  <p className="text-sm text-muted-foreground">
                    Reduce audio feedback
                  </p>
                </div>
                <Switch
                  checked={formData.echoCancellation}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("echoCancellation", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Noise Suppression</p>
                  <p className="text-sm text-muted-foreground">
                    Filter background noise
                  </p>
                </div>
                <Switch
                  checked={formData.noiseSuppression}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("noiseSuppression", checked)
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Visual Preferences */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiEye className="w-5 h-5 mr-2" />
            Visual Preferences
          </h3>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Background Blur</p>
                  <p className="text-sm text-muted-foreground">
                    Blur your background
                  </p>
                </div>
                <Switch
                  checked={formData.backgroundBlur}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("backgroundBlur", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Camera Preview</p>
                  <p className="text-sm text-muted-foreground">
                    Show preview before joining
                  </p>
                </div>
                <Switch
                  checked={formData.cameraPreview}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("cameraPreview", checked)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default View</label>
                <Select
                  value={formData.speakerView}
                  onValueChange={(value) =>
                    handlePreferenceChange("speakerView", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="grid">Grid View</SelectItem>
                    <SelectItem value="speaker">Speaker View</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Grid Layout</label>
                <Select
                  value={formData.gridLayout}
                  onValueChange={(value) =>
                    handlePreferenceChange("gridLayout", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="4x4">4x4 Grid</SelectItem>
                    <SelectItem value="3x3">3x3 Grid</SelectItem>
                    <SelectItem value="2x2">2x2 Grid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* Meeting Behavior */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiUsers className="w-5 h-5 mr-2" />
            Meeting Behavior
          </h3>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Join Early</p>
                  <p className="text-sm text-muted-foreground">
                    Join before scheduled time
                  </p>
                </div>
                <Switch
                  checked={formData.joinEarly}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("joinEarly", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Record</p>
                  <p className="text-sm text-muted-foreground">
                    Start recording automatically
                  </p>
                </div>
                <Switch
                  checked={formData.autoRecord}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("autoRecord", checked)
                  }
                />
              </div>
            </div>

            {formData.joinEarly && (
              <div className="space-y-2 ml-6">
                <label className="text-sm font-medium">
                  Early Join Minutes
                </label>
                <div className="flex items-center space-x-4">
                  <Slider
                    value={[formData.earlyJoinMinutes]}
                    onValueChange={([value]) =>
                      handlePreferenceChange("earlyJoinMinutes", value)
                    }
                    min={1}
                    max={15}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12">
                    {formData.earlyJoinMinutes} min
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Participant List</p>
                  <p className="text-sm text-muted-foreground">
                    Display participants panel
                  </p>
                </div>
                <Switch
                  checked={formData.showParticipantList}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("showParticipantList", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Chat</p>
                  <p className="text-sm text-muted-foreground">
                    Display chat panel
                  </p>
                </div>
                <Switch
                  checked={formData.showChat}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("showChat", checked)
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Quality Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiWifi className="w-5 h-5 mr-2" />
            Quality & Performance
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Video Quality</label>
              <Select
                value={formData.videoQuality}
                onValueChange={(value) =>
                  handlePreferenceChange("videoQuality", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="720p">HD (720p)</SelectItem>
                  <SelectItem value="480p">SD (480p)</SelectItem>
                  <SelectItem value="360p">Low (360p)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bandwidth Usage</label>
              <Select
                value={formData.bandwidth}
                onValueChange={(value) =>
                  handlePreferenceChange("bandwidth", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Adaptive Quality</p>
                <p className="text-sm text-muted-foreground">
                  Automatically adjust based on connection
                </p>
              </div>
              <Switch
                checked={formData.adaptiveQuality}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("adaptiveQuality", checked)
                }
              />
            </div>
          </div>
        </Card>

        {/* Accessibility */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiShield className="w-5 h-5 mr-2" />
            Accessibility
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Closed Captions</p>
                <p className="text-sm text-muted-foreground">
                  Enable automatic captions
                </p>
              </div>
              <Switch
                checked={formData.captions}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("captions", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">High Contrast</p>
                <p className="text-sm text-muted-foreground">
                  Enhance visual contrast
                </p>
              </div>
              <Switch
                checked={formData.highContrast}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("highContrast", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Large Text</p>
                <p className="text-sm text-muted-foreground">
                  Increase text size
                </p>
              </div>
              <Switch
                checked={formData.largeText}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("largeText", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Keyboard Shortcuts</p>
                <p className="text-sm text-muted-foreground">
                  Enable keyboard navigation
                </p>
              </div>
              <Switch
                checked={formData.keyboardShortcuts}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("keyboardShortcuts", checked)
                }
              />
            </div>
          </div>
        </Card>

        {/* Calendar Integration */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FiCalendar className="w-5 h-5 mr-2" />
            Calendar Integration
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Calendar Sync</p>
                <p className="text-sm text-muted-foreground">
                  Sync with your calendar app
                </p>
              </div>
              <Switch
                checked={formData.calendarSync}
                onCheckedChange={(checked) =>
                  handlePreferenceChange("calendarSync", checked)
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Default Meeting Length
                </label>
                <div className="flex items-center space-x-4">
                  <Slider
                    value={[formData.defaultMeetingLength]}
                    onValueChange={([value]) =>
                      handlePreferenceChange("defaultMeetingLength", value)
                    }
                    min={15}
                    max={240}
                    step={15}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-16">
                    {formData.defaultMeetingLength} min
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Buffer Time</label>
                <div className="flex items-center space-x-4">
                  <Slider
                    value={[formData.bufferTime]}
                    onValueChange={([value]) =>
                      handlePreferenceChange("bufferTime", value)
                    }
                    min={0}
                    max={30}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-16">
                    {formData.bufferTime} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={resetToDefaults}
            disabled={isSaving}
          >
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>

          <div className="flex space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isDirty) {
                  const confirmDiscard = confirm(
                    "You have unsaved changes. Are you sure you want to discard them?",
                  );
                  if (!confirmDiscard) return;
                }
                if (onClose) onClose();
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSaving || !isDirty}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MeetingPreferences;
