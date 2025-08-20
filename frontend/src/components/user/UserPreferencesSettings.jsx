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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Slider } from "../ui/slider";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  FiBell,
  FiMail,
  FiSmartphone,
  FiMonitor,
  FiUsers,
  FiMessageSquare,
  FiCalendar,
  FiVideo,
  FiMic,
  FiSettings,
  FiVolume2,
  FiVolumeX,
  FiSave,
  FiRefreshCw,
  FiX,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import { FaCheckCircle } from "react-icons/fa";
import userAnalyticsService from "../../services/UserAnalyticsService";
import useUserStore from "../../stores/userStore";
import useUIStore from "../../stores/uiStore";
import useAuthStore from "../../stores/authStore";
import LoadingSpinner from "../ui/LoadingSpinner";

const UserPreferencesSettings = ({ open, onOpenChange }) => {
  const { user } = useAuthStore();
  const { preferences, updatePreferences, isLoading } = useUserStore();
  const {
    theme,
    setTheme,
    notifications,
    devices,
    updateNotificationSettings,
    updateDeviceSettings,
  } = useUIStore();

  const [localPreferences, setLocalPreferences] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [availableDevices, setAvailableDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: [],
  });

  // Initialize preferences
  useEffect(() => {
    if (preferences && Object.keys(localPreferences).length === 0) {
      setLocalPreferences({
        // Notification preferences
        notifications: {
          email: preferences.notifications?.email !== false,
          browser: preferences.notifications?.browser !== false,
          mobile: preferences.notifications?.mobile !== false,
          meetingReminders:
            preferences.notifications?.meetingReminders !== false,
          meetingInvites: preferences.notifications?.meetingInvites !== false,
          chatMessages: preferences.notifications?.chatMessages !== false,
          systemUpdates: preferences.notifications?.systemUpdates !== false,
          soundEnabled: preferences.notifications?.soundEnabled !== false,
          quietHours: preferences.notifications?.quietHours || {
            enabled: false,
            start: "22:00",
            end: "08:00",
          },
        },

        // Meeting preferences
        meeting: {
          defaultAudio: preferences.meeting?.defaultAudio !== false,
          defaultVideo: preferences.meeting?.defaultVideo !== false,
          autoJoin: preferences.meeting?.autoJoin !== false,
          backgroundBlur: preferences.meeting?.backgroundBlur !== false,
          timezone:
            preferences.meeting?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          joinEarlyMinutes: preferences.meeting?.joinEarlyMinutes || 5,
          defaultQuality: preferences.meeting?.defaultQuality || "auto",
          echoCancellation: preferences.meeting?.echoCancellation !== false,
          noiseSuppression: preferences.meeting?.noiseSuppression !== false,
          speakingIndicator: preferences.meeting?.speakingIndicator !== false,
          recordingConsent: preferences.meeting?.recordingConsent || "ask",
          virtualBackground: preferences.meeting?.virtualBackground || "none",
        },

        // Privacy preferences
        privacy: {
          showOnlineStatus: preferences.privacy?.showOnlineStatus !== false,
          allowDirectMessages:
            preferences.privacy?.allowDirectMessages !== false,
          shareParticipationStats:
            preferences.privacy?.shareParticipationStats !== false,
          dataCollection: preferences.privacy?.dataCollection !== false,
          profileVisibility:
            preferences.privacy?.profileVisibility || "organization",
          activityTracking: preferences.privacy?.activityTracking !== false,
        },

        // Accessibility preferences
        accessibility: {
          highContrast: preferences.accessibility?.highContrast !== false,
          largeText: preferences.accessibility?.largeText !== false,
          screenReader: preferences.accessibility?.screenReader !== false,
          keyboardNavigation:
            preferences.accessibility?.keyboardNavigation !== false,
          reduceMotion: preferences.accessibility?.reduceMotion !== false,
          captionsEnabled: preferences.accessibility?.captionsEnabled !== false,
          fontSize: preferences.accessibility?.fontSize || "medium",
        },

        // Language and region
        localization: {
          language: preferences.localization?.language || "en",
          dateFormat: preferences.localization?.dateFormat || "MM/DD/YYYY",
          timeFormat: preferences.localization?.timeFormat || "12",
          timezone:
            preferences.localization?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: preferences.localization?.currency || "USD",
        },
      });
    }
  }, [preferences]);

  // Load available media devices
  useEffect(() => {
    loadAvailableDevices();
  }, []);

  const loadAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      setAvailableDevices({
        cameras: devices.filter((device) => device.kind === "videoinput"),
        microphones: devices.filter((device) => device.kind === "audioinput"),
        speakers: devices.filter((device) => device.kind === "audiooutput"),
      });
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const handlePreferenceChange = (section, key, value) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setHasChanges(true);
    setSuccess(false);

    // Clear any existing errors for this field
    if (errors[`${section}.${key}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${section}.${key}`];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    setIsUpdating(true);
    setErrors({});

    try {
      // Validate preferences
      const validationErrors = validatePreferences();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Update preferences via service
      const result =
        await userAnalyticsService.updateUserPreferences(localPreferences);

      if (result.success) {
        // Update local stores
        await updatePreferences(localPreferences);

        // Update UI store settings
        updateNotificationSettings(localPreferences.notifications);
        updateDeviceSettings({
          preferredCamera: localPreferences.meeting?.preferredCamera,
          preferredMicrophone: localPreferences.meeting?.preferredMicrophone,
          preferredSpeaker: localPreferences.meeting?.preferredSpeaker,
          autoJoinAudio: localPreferences.meeting?.defaultAudio,
          autoJoinVideo: localPreferences.meeting?.defaultVideo,
          backgroundBlur: localPreferences.meeting?.backgroundBlur,
        });

        setSuccess(true);
        setHasChanges(false);

        // Track preference update
        userAnalyticsService.trackEvent("preferences_updated", {
          sections_updated: Object.keys(localPreferences),
          timestamp: Date.now(),
        });

        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrors({ general: result.error || "Failed to update preferences" });
      }
    } catch (error) {
      setErrors({ general: "Network error - please try again" });
    } finally {
      setIsUpdating(false);
    }
  };

  const validatePreferences = () => {
    const errors = {};

    // Validate timezone
    if (!localPreferences.localization?.timezone) {
      errors["localization.timezone"] = "Timezone is required";
    }

    // Validate quiet hours
    if (localPreferences.notifications?.quietHours?.enabled) {
      const { start, end } = localPreferences.notifications.quietHours;
      if (!start || !end) {
        errors["notifications.quietHours"] =
          "Quiet hours start and end times are required";
      }
    }

    // Validate join early minutes
    const joinEarly = localPreferences.meeting?.joinEarlyMinutes;
    if (joinEarly < 0 || joinEarly > 30) {
      errors["meeting.joinEarlyMinutes"] =
        "Join early minutes must be between 0 and 30";
    }

    return errors;
  };

  const handleReset = () => {
    if (preferences) {
      setLocalPreferences({ ...preferences });
      setHasChanges(false);
      setErrors({});
      setSuccess(false);
    }
  };

  const handleExportPreferences = async () => {
    try {
      const data = JSON.stringify(localPreferences, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `preferences-${user?.first_name}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);

      userAnalyticsService.trackEvent("preferences_exported", {
        export_format: "json",
        timestamp: Date.now(),
      });
    } catch (error) {
      setErrors({ general: "Failed to export preferences" });
    }
  };

  const handleImportPreferences = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedPrefs = JSON.parse(e.target.result);
        setLocalPreferences(importedPrefs);
        setHasChanges(true);

        userAnalyticsService.trackEvent("preferences_imported", {
          import_format: "json",
          timestamp: Date.now(),
        });
      } catch (error) {
        setErrors({ general: "Invalid preferences file format" });
      }
    };
    reader.readAsText(file);
  };

  const availableTimezones = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
    { value: "Europe/Paris", label: "Central European Time (CET)" },
    { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
    { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
    { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
  ];

  const availableLanguages = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "it", label: "Italiano" },
    { value: "pt", label: "Português" },
    { value: "ja", label: "日本語" },
    { value: "zh", label: "中文" },
  ];

  if (isLoading || Object.keys(localPreferences).length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
        <span className="ml-3">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Preferences
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your meeting experience and notification settings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPreferences}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <div className="relative">
            <Input
              type="file"
              accept=".json"
              onChange={handleImportPreferences}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span>Preferences updated successfully!</span>
            </div>
          </CardContent>
        </Card>
      )}

      {errors.general && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.general}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="meeting" className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Meeting</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger
            value="accessibility"
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Accessibility</span>
          </TabsTrigger>
          <TabsTrigger value="localization" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Language</span>
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Choose how and when you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notification Types */}
              <div className="space-y-4">
                <h3 className="font-medium">Notification Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-blue-500" />
                      <div>
                        <Label className="text-sm font-medium">
                          Email Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.email}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "email",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-3">
                      <Monitor className="w-5 h-5 text-green-500" />
                      <div>
                        <Label className="text-sm font-medium">
                          Browser Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show desktop notifications
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.browser}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "browser",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="w-5 h-5 text-purple-500" />
                      <div>
                        <Label className="text-sm font-medium">
                          Mobile Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Push notifications on mobile
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.mobile}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "mobile",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="w-5 h-5 text-orange-500" />
                      <div>
                        <Label className="text-sm font-medium">
                          Sound Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Play sounds for notifications
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.soundEnabled}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "soundEnabled",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notification Categories */}
              <div className="space-y-4">
                <h3 className="font-medium">What to Notify About</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <Label>Meeting reminders</Label>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.meetingReminders}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "meetingReminders",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-green-500" />
                      <Label>Meeting invitations</Label>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.meetingInvites}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "meetingInvites",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      <Label>Chat messages</Label>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.chatMessages}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "chatMessages",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <Label>System updates</Label>
                    </div>
                    <Switch
                      checked={localPreferences.notifications?.systemUpdates}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "notifications",
                          "systemUpdates",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quiet Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Quiet Hours
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Disable notifications during specific hours
                    </p>
                  </div>
                  <Switch
                    checked={
                      localPreferences.notifications?.quietHours?.enabled
                    }
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("notifications", "quietHours", {
                        ...localPreferences.notifications?.quietHours,
                        enabled: checked,
                      })
                    }
                  />
                </div>

                {localPreferences.notifications?.quietHours?.enabled && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label htmlFor="quietStart">Start Time</Label>
                      <Input
                        id="quietStart"
                        type="time"
                        value={
                          localPreferences.notifications?.quietHours?.start
                        }
                        onChange={(e) =>
                          handlePreferenceChange(
                            "notifications",
                            "quietHours",
                            {
                              ...localPreferences.notifications?.quietHours,
                              start: e.target.value,
                            },
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quietEnd">End Time</Label>
                      <Input
                        id="quietEnd"
                        type="time"
                        value={localPreferences.notifications?.quietHours?.end}
                        onChange={(e) =>
                          handlePreferenceChange(
                            "notifications",
                            "quietHours",
                            {
                              ...localPreferences.notifications?.quietHours,
                              end: e.target.value,
                            },
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {errors["notifications.quietHours"] && (
                  <p className="text-sm text-red-500 ml-6">
                    {errors["notifications.quietHours"]}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meeting Tab */}
        <TabsContent value="meeting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Meeting Preferences
              </CardTitle>
              <CardDescription>
                Configure your default meeting behavior and device settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Meeting Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Default Join Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mic className="w-5 h-5 text-blue-500" />
                      <Label>Join with audio on</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.defaultAudio}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "defaultAudio",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Camera className="w-5 h-5 text-green-500" />
                      <Label>Join with video on</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.defaultVideo}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "defaultVideo",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-purple-500" />
                      <Label>Auto-join meetings</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.autoJoin}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange("meeting", "autoJoin", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-5 h-5 text-orange-500" />
                      <Label>Background blur</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.backgroundBlur}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "backgroundBlur",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Audio Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Audio Enhancement</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Headphones className="w-4 h-4 text-blue-500" />
                      <Label>Echo cancellation</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.echoCancellation}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "echoCancellation",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="w-4 h-4 text-green-500" />
                      <Label>Noise suppression</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.noiseSuppression}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "noiseSuppression",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mic className="w-4 h-4 text-purple-500" />
                      <Label>Speaking indicator</Label>
                    </div>
                    <Switch
                      checked={localPreferences.meeting?.speakingIndicator}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "meeting",
                          "speakingIndicator",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Device Preferences */}
              {(availableDevices.cameras.length > 0 ||
                availableDevices.microphones.length > 0) && (
                <div className="space-y-4">
                  <h3 className="font-medium">Preferred Devices</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {availableDevices.cameras.length > 0 && (
                      <div className="space-y-2">
                        <Label>Camera</Label>
                        <Select
                          value={
                            localPreferences.meeting?.preferredCamera || ""
                          }
                          onValueChange={(value) =>
                            handlePreferenceChange(
                              "meeting",
                              "preferredCamera",
                              value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select camera" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Default</SelectItem>
                            {availableDevices.cameras.map((device) => (
                              <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label ||
                                  `Camera ${device.deviceId.substr(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {availableDevices.microphones.length > 0 && (
                      <div className="space-y-2">
                        <Label>Microphone</Label>
                        <Select
                          value={
                            localPreferences.meeting?.preferredMicrophone || ""
                          }
                          onValueChange={(value) =>
                            handlePreferenceChange(
                              "meeting",
                              "preferredMicrophone",
                              value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select microphone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Default</SelectItem>
                            {availableDevices.microphones.map((device) => (
                              <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label ||
                                  `Microphone ${device.deviceId.substr(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {availableDevices.speakers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Speaker</Label>
                        <Select
                          value={
                            localPreferences.meeting?.preferredSpeaker || ""
                          }
                          onValueChange={(value) =>
                            handlePreferenceChange(
                              "meeting",
                              "preferredSpeaker",
                              value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select speaker" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Default</SelectItem>
                            {availableDevices.speakers.map((device) => (
                              <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label ||
                                  `Speaker ${device.deviceId.substr(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Meeting Quality and Timing */}
              <div className="space-y-4">
                <h3 className="font-medium">Quality and Timing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default video quality</Label>
                    <Select
                      value={localPreferences.meeting?.defaultQuality}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "meeting",
                          "defaultQuality",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="high">High (720p)</SelectItem>
                        <SelectItem value="medium">Medium (480p)</SelectItem>
                        <SelectItem value="low">Low (360p)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Join early (minutes)</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[
                          localPreferences.meeting?.joinEarlyMinutes || 5,
                        ]}
                        onValueChange={(value) =>
                          handlePreferenceChange(
                            "meeting",
                            "joinEarlyMinutes",
                            value[0],
                          )
                        }
                        max={30}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 min</span>
                        <span>
                          {localPreferences.meeting?.joinEarlyMinutes || 5}{" "}
                          minutes
                        </span>
                        <span>30 min</span>
                      </div>
                    </div>
                    {errors["meeting.joinEarlyMinutes"] && (
                      <p className="text-sm text-red-500">
                        {errors["meeting.joinEarlyMinutes"]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Recording Consent */}
              <div className="space-y-4">
                <h3 className="font-medium">Recording and Privacy</h3>
                <div className="space-y-2">
                  <Label>Recording consent</Label>
                  <RadioGroup
                    value={localPreferences.meeting?.recordingConsent}
                    onValueChange={(value) =>
                      handlePreferenceChange(
                        "meeting",
                        "recordingConsent",
                        value,
                      )
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="always" id="always" />
                      <Label htmlFor="always">Always allow recording</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ask" id="ask" />
                      <Label htmlFor="ask">Ask before recording</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="never" id="never" />
                      <Label htmlFor="never">Never allow recording</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control your privacy and data sharing preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visibility Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Profile Visibility</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Show online status</Label>
                    <Switch
                      checked={localPreferences.privacy?.showOnlineStatus}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "privacy",
                          "showOnlineStatus",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Allow direct messages</Label>
                    <Switch
                      checked={localPreferences.privacy?.allowDirectMessages}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "privacy",
                          "allowDirectMessages",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Profile visibility</Label>
                    <Select
                      value={localPreferences.privacy?.profileVisibility}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "privacy",
                          "profileVisibility",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="organization">
                          Organization only
                        </SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Data Sharing */}
              <div className="space-y-4">
                <h3 className="font-medium">Data Sharing</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Share participation statistics</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow admins to see your meeting participation stats
                      </p>
                    </div>
                    <Switch
                      checked={
                        localPreferences.privacy?.shareParticipationStats
                      }
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "privacy",
                          "shareParticipationStats",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Activity tracking</Label>
                      <p className="text-xs text-muted-foreground">
                        Track activity for analytics and improvements
                      </p>
                    </div>
                    <Switch
                      checked={localPreferences.privacy?.activityTracking}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "privacy",
                          "activityTracking",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data collection for insights</Label>
                      <p className="text-xs text-muted-foreground">
                        Help improve the platform with usage data
                      </p>
                    </div>
                    <Switch
                      checked={localPreferences.privacy?.dataCollection}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "privacy",
                          "dataCollection",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Accessibility
              </CardTitle>
              <CardDescription>
                Configure accessibility features for better usability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visual Accessibility */}
              <div className="space-y-4">
                <h3 className="font-medium">Visual</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>High contrast mode</Label>
                    <Switch
                      checked={localPreferences.accessibility?.highContrast}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "highContrast",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Large text</Label>
                    <Switch
                      checked={localPreferences.accessibility?.largeText}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "largeText",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Reduce motion</Label>
                    <Switch
                      checked={localPreferences.accessibility?.reduceMotion}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "reduceMotion",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Font size</Label>
                    <Select
                      value={localPreferences.accessibility?.fontSize}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "accessibility",
                          "fontSize",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="extra-large">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assistive Technology */}
              <div className="space-y-4">
                <h3 className="font-medium">Assistive Technology</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Screen reader support</Label>
                      <p className="text-xs text-muted-foreground">
                        Optimize for screen readers
                      </p>
                    </div>
                    <Switch
                      checked={localPreferences.accessibility?.screenReader}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "screenReader",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Keyboard navigation</Label>
                      <p className="text-xs text-muted-foreground">
                        Enhanced keyboard support
                      </p>
                    </div>
                    <Switch
                      checked={
                        localPreferences.accessibility?.keyboardNavigation
                      }
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "keyboardNavigation",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-generated captions</Label>
                      <p className="text-xs text-muted-foreground">
                        Show captions during meetings
                      </p>
                    </div>
                    <Switch
                      checked={localPreferences.accessibility?.captionsEnabled}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(
                          "accessibility",
                          "captionsEnabled",
                          checked,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Localization Tab */}
        <TabsContent value="localization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Language & Region
              </CardTitle>
              <CardDescription>
                Configure language and regional settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Language</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interface language</Label>
                    <Select
                      value={localPreferences.localization?.language}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "localization",
                          "language",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLanguages.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={localPreferences.localization?.timezone}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "localization",
                          "timezone",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors["localization.timezone"] && (
                      <p className="text-sm text-red-500">
                        {errors["localization.timezone"]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Format Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Formats</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date format</Label>
                    <Select
                      value={localPreferences.localization?.dateFormat}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "localization",
                          "dateFormat",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time format</Label>
                    <Select
                      value={localPreferences.localization?.timeFormat}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "localization",
                          "timeFormat",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12-hour</SelectItem>
                        <SelectItem value="24">24-hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={localPreferences.localization?.currency}
                      onValueChange={(value) =>
                        handlePreferenceChange(
                          "localization",
                          "currency",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                        <SelectItem value="AUD">AUD (A$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {hasChanges && (
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-300"
                >
                  <Info className="w-3 h-3 mr-1" />
                  You have unsaved changes
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || isUpdating}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Preferences
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserPreferencesSettings;
