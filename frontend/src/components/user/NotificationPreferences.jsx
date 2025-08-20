import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
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
import useUserStore from "../../stores/userStore";
import useAuthStore from "../../stores/authStore";

const NotificationPreferences = ({ onClose }) => {
  const { preferences, updatePreferences, isLoading, error } = useUserStore();

  const [formData, setFormData] = useState({
    email: {
      enabled: true,
      meetingInvites: true,
      meetingReminders: true,
      meetingCancellations: true,
      chatMessages: false,
      weeklyDigest: true,
      systemUpdates: false,
      securityAlerts: true,
    },
    browser: {
      enabled: true,
      meetingStarting: true,
      joinRequests: true,
      chatMessages: true,
      handRaised: true,
      participantJoined: false,
      participantLeft: false,
      screenShare: true,
    },
    mobile: {
      enabled: true,
      meetingInvites: true,
      meetingReminders: true,
      urgentMessages: true,
      directMessages: true,
      mentions: true,
      missedCalls: true,
    },
    meeting: {
      soundEffects: true,
      joinLeaveSound: false,
      chatSound: true,
      reactionSound: true,
      handRaiseSound: true,
      recordingSound: true,
      lowBatteryWarning: true,
      connectionIssues: true,
    },
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testNotification, setTestNotification] = useState(null);
  const [browserPermission, setBrowserPermission] = useState("default");

  useEffect(() => {
    if (preferences?.notifications) {
      setFormData((prevData) => ({
        ...prevData,
        ...preferences.notifications,
      }));
    }

    if ("Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [preferences]);

  const handleSectionToggle = (section, enabled) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], enabled },
    }));
    setIsDirty(true);
  };

  const handlePreferenceToggle = (section, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
    setIsDirty(true);
  };

  const requestBrowserPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);

      if (permission === "granted") {
        handleSectionToggle("browser", true);
      }
    }
  };

  const sendTestNotification = async (type) => {
    setTestNotification(type);

    try {
      if (
        type === "browser" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Test Notification", {
          body: "This is a test notification from your video conference app.",
          icon: "/favicon.ico",
        });
      }

      setTimeout(() => setTestNotification(null), 2000);
    } catch (error) {
      console.error("Failed to send test notification:", error);
      setTestNotification(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await updatePreferences({ notifications: formData });
      if (result.success) {
        setIsDirty(false);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const NotificationSection = ({
    title,
    description,
    icon: Icon,
    section,
    children,
  }) => (
    <Card className="p-6 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-lg transition-colors ${
              formData[section]?.enabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {section === "browser" && browserPermission !== "granted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={requestBrowserPermission}
            >
              Enable
            </Button>
          )}
          <Switch
            checked={formData[section]?.enabled || false}
            onCheckedChange={(checked) => handleSectionToggle(section, checked)}
            aria-label={`Toggle ${title} notifications`}
          />
        </div>
      </div>

      {formData[section]?.enabled && (
        <>
          <Separator className="my-4" />
          <div className="space-y-4">{children}</div>
        </>
      )}
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Notification Preferences
          </h1>
          <p className="text-muted-foreground">
            Control how and when you receive notifications
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
        {/* Email Notifications */}
        <NotificationSection
          title="Email Notifications"
          description="Receive notifications via email"
          icon={FiMail}
          section="email"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Meeting Invites</p>
                <p className="text-sm text-muted-foreground">
                  New meeting invitations
                </p>
              </div>
              <Switch
                checked={formData.email?.meetingInvites || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("email", "meetingInvites", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Meeting Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Upcoming meeting alerts
                </p>
              </div>
              <Switch
                checked={formData.email?.meetingReminders || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("email", "meetingReminders", checked)
                }
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => sendTestNotification("email")}
              disabled={testNotification === "email"}
            >
              {testNotification === "email" ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <FiMail className="w-4 h-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </div>
        </NotificationSection>

        {/* Browser Notifications */}
        <NotificationSection
          title="Browser Notifications"
          description="Real-time notifications in your browser"
          icon={FiMonitor}
          section="browser"
        >
          {browserPermission === "denied" && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg mb-4">
              <div className="flex items-center space-x-2">
                <FiAlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Browser notifications are blocked. Please enable them in your
                  browser settings.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Meeting Starting</p>
                <p className="text-sm text-muted-foreground">
                  When it's time to join
                </p>
              </div>
              <Switch
                checked={formData.browser?.meetingStarting || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("browser", "meetingStarting", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Chat Messages</p>
                <p className="text-sm text-muted-foreground">
                  New chat messages
                </p>
              </div>
              <Switch
                checked={formData.browser?.chatMessages || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("browser", "chatMessages", checked)
                }
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => sendTestNotification("browser")}
              disabled={
                testNotification === "browser" ||
                browserPermission !== "granted"
              }
            >
              {testNotification === "browser" ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <FiMonitor className="w-4 h-4 mr-2" />
              )}
              Send Test Notification
            </Button>
          </div>
        </NotificationSection>

        {/* In-Meeting Notifications */}
        <NotificationSection
          title="In-Meeting Notifications"
          description="Audio alerts during meetings"
          icon={FiVolume2}
          section="meeting"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Chat Sounds</p>
                <p className="text-sm text-muted-foreground">
                  Audio alert for new messages
                </p>
              </div>
              <Switch
                checked={formData.meeting?.chatSound || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("meeting", "chatSound", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Hand Raise Sound</p>
                <p className="text-sm text-muted-foreground">
                  Audio alert when hand raised
                </p>
              </div>
              <Switch
                checked={formData.meeting?.handRaiseSound || false}
                onCheckedChange={(checked) =>
                  handlePreferenceToggle("meeting", "handRaiseSound", checked)
                }
              />
            </div>
          </div>
        </NotificationSection>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-border">
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
      </form>
    </div>
  );
};

export default NotificationPreferences;
