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
import useAdminStore from "../../stores/adminStore";
import useAuthStore from "../../stores/authStore";

// Icons
const Icons = {
  Settings: () => <span className="text-xl">⚙️</span>,
  Security: () => <span className="text-xl">🔒</span>,
  Database: () => <span className="text-xl">🗄️</span>,
  Email: () => <span className="text-xl">📧</span>,
  Integration: () => <span className="text-xl">🔗</span>,
  Video: () => <span className="text-xl">🎥</span>,
  Audio: () => <span className="text-xl">🔊</span>,
  Storage: () => <span className="text-xl">💾</span>,
  Network: () => <span className="text-xl">🌐</span>,
  Monitor: () => <span className="text-xl">📊</span>,
  Backup: () => <span className="text-xl">💿</span>,
  Update: () => <span className="text-xl">🔄</span>,
  Save: () => <span className="text-lg">💾</span>,
  Reset: () => <span className="text-lg">🔄</span>,
  Test: () => <span className="text-lg">🧪</span>,
  Check: () => <span className="text-lg">✅</span>,
  Warning: () => <span className="text-lg">⚠️</span>,
  Error: () => <span className="text-lg">❌</span>,
};

const SystemSettings = () => {
  const { systemHealth, fetchSystemHealth } = useAdminStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    general: {
      platform_name: "Video Conference Platform",
      platform_description: "Enterprise video conferencing solution",
      default_timezone: "UTC",
      default_language: "en-US",
      maintenance_mode: false,
      registration_enabled: true,
      max_users_per_organization: 1000,
      session_timeout_minutes: 60,
      password_reset_expiry_hours: 24,
    },
    meeting: {
      max_participants_per_meeting: 100,
      default_meeting_duration_minutes: 60,
      max_meeting_duration_hours: 8,
      allow_guest_access: true,
      require_meeting_passwords: false,
      enable_waiting_room: true,
      enable_meeting_recording: true,
      auto_recording: false,
      recording_retention_days: 30,
      allow_screen_sharing: true,
      enable_breakout_rooms: true,
      max_breakout_rooms: 20,
    },
    video: {
      default_video_quality: "hd",
      max_video_quality: "4k",
      enable_virtual_backgrounds: true,
      enable_beauty_filter: true,
      bandwidth_optimization: true,
      adaptive_bitrate: true,
      h264_hardware_acceleration: true,
      vp9_encoding: true,
    },
    audio: {
      default_audio_quality: "high",
      noise_suppression: true,
      echo_cancellation: true,
      auto_gain_control: true,
      enable_music_mode: true,
      enable_spatial_audio: false,
      audio_processing_aec: true,
      audio_processing_ns: true,
    },
    security: {
      require_two_factor: false,
      password_min_length: 8,
      password_require_special: true,
      password_require_numbers: true,
      password_require_uppercase: true,
      max_login_attempts: 5,
      lockout_duration_minutes: 15,
      enable_ip_whitelisting: false,
      enable_rate_limiting: true,
      secure_cookies: true,
      enable_csrf_protection: true,
    },
    email: {
      smtp_host: "",
      smtp_port: 587,
      smtp_username: "",
      smtp_password: "",
      smtp_encryption: "tls",
      from_email: "",
      from_name: "",
      enable_email_notifications: true,
      email_templates_customizable: true,
    },
    storage: {
      storage_provider: "local",
      max_file_size_mb: 100,
      allowed_file_types: "pdf,doc,docx,ppt,pptx,jpg,png,gif",
      recording_storage_limit_gb: 1000,
      cleanup_old_recordings: true,
      backup_enabled: false,
      backup_frequency: "daily",
      backup_retention_days: 30,
    },
    integration: {
      google_calendar_enabled: false,
      outlook_calendar_enabled: false,
      slack_integration: false,
      teams_integration: false,
      zoom_import: false,
      webhooks_enabled: true,
      api_rate_limit: 1000,
      sso_enabled: false,
      ldap_enabled: false,
    },
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState({});

  const tabs = [
    { id: "general", label: "General", icon: <Icons.Settings /> },
    { id: "meeting", label: "Meeting", icon: <Icons.Video /> },
    { id: "video", label: "Video", icon: <Icons.Video /> },
    { id: "audio", label: "Audio", icon: <Icons.Audio /> },
    { id: "security", label: "Security", icon: <Icons.Security /> },
    { id: "email", label: "Email", icon: <Icons.Email /> },
    { id: "storage", label: "Storage", icon: <Icons.Storage /> },
    { id: "integration", label: "Integration", icon: <Icons.Integration /> },
  ];

  useEffect(() => {
    fetchSystemHealth();
    // Load settings from API
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // This would typically load from API
      // const response = await fetch('/api/admin/settings');
      // const data = await response.json();
      // setSettings(data);
      console.log("Loading settings...");
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSettingChange = (tab, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save settings to API
      console.log("Saving settings:", settings);
      // const response = await fetch('/api/admin/settings', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(settings)
      // });
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (
      window.confirm("Are you sure you want to reset all settings to defaults?")
    ) {
      loadSettings();
      setHasChanges(false);
    }
  };

  const handleTest = async (testType) => {
    setTestResults((prev) => ({ ...prev, [testType]: "testing" }));

    try {
      // Simulate test
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTestResults((prev) => ({ ...prev, [testType]: "success" }));
    } catch (error) {
      setTestResults((prev) => ({ ...prev, [testType]: "error" }));
    }
  };

  const renderInput = (tab, key, label, type = "text", options = null) => {
    const value = settings[tab][key];

    if (type === "boolean") {
      return (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleSettingChange(tab, key, e.target.checked)}
            className="toggle"
          />
        </div>
      );
    }

    if (type === "select" && options) {
      return (
        <div>
          <label className="block text-sm font-medium mb-1">{label}</label>
          <select
            value={value}
            onChange={(e) => handleSettingChange(tab, key, e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium mb-1">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) =>
            handleSettingChange(
              tab,
              key,
              type === "number" ? parseInt(e.target.value) : e.target.value,
            )
          }
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput("general", "platform_name", "Platform Name")}
        {renderInput("general", "platform_description", "Platform Description")}
        {renderInput(
          "general",
          "default_timezone",
          "Default Timezone",
          "select",
          [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time" },
            { value: "America/Chicago", label: "Central Time" },
            { value: "America/Denver", label: "Mountain Time" },
            { value: "America/Los_Angeles", label: "Pacific Time" },
          ],
        )}
        {renderInput(
          "general",
          "default_language",
          "Default Language",
          "select",
          [
            { value: "en-US", label: "English (US)" },
            { value: "en-GB", label: "English (UK)" },
            { value: "es-ES", label: "Spanish" },
            { value: "fr-FR", label: "French" },
            { value: "de-DE", label: "German" },
          ],
        )}
        {renderInput(
          "general",
          "max_users_per_organization",
          "Max Users per Organization",
          "number",
        )}
        {renderInput(
          "general",
          "session_timeout_minutes",
          "Session Timeout (minutes)",
          "number",
        )}
        {renderInput(
          "general",
          "password_reset_expiry_hours",
          "Password Reset Expiry (hours)",
          "number",
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "general",
          "maintenance_mode",
          "Maintenance Mode",
          "boolean",
        )}
        {renderInput(
          "general",
          "registration_enabled",
          "Registration Enabled",
          "boolean",
        )}
      </div>
    </div>
  );

  const renderMeetingSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "meeting",
          "max_participants_per_meeting",
          "Max Participants per Meeting",
          "number",
        )}
        {renderInput(
          "meeting",
          "default_meeting_duration_minutes",
          "Default Meeting Duration (minutes)",
          "number",
        )}
        {renderInput(
          "meeting",
          "max_meeting_duration_hours",
          "Max Meeting Duration (hours)",
          "number",
        )}
        {renderInput(
          "meeting",
          "recording_retention_days",
          "Recording Retention (days)",
          "number",
        )}
        {renderInput(
          "meeting",
          "max_breakout_rooms",
          "Max Breakout Rooms",
          "number",
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "meeting",
          "allow_guest_access",
          "Allow Guest Access",
          "boolean",
        )}
        {renderInput(
          "meeting",
          "require_meeting_passwords",
          "Require Meeting Passwords",
          "boolean",
        )}
        {renderInput(
          "meeting",
          "enable_waiting_room",
          "Enable Waiting Room",
          "boolean",
        )}
        {renderInput(
          "meeting",
          "enable_meeting_recording",
          "Enable Meeting Recording",
          "boolean",
        )}
        {renderInput("meeting", "auto_recording", "Auto Recording", "boolean")}
        {renderInput(
          "meeting",
          "allow_screen_sharing",
          "Allow Screen Sharing",
          "boolean",
        )}
        {renderInput(
          "meeting",
          "enable_breakout_rooms",
          "Enable Breakout Rooms",
          "boolean",
        )}
      </div>
    </div>
  );

  const renderVideoSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "video",
          "default_video_quality",
          "Default Video Quality",
          "select",
          [
            { value: "sd", label: "Standard Definition (SD)" },
            { value: "hd", label: "High Definition (HD)" },
            { value: "fhd", label: "Full HD (1080p)" },
            { value: "4k", label: "4K Ultra HD" },
          ],
        )}
        {renderInput(
          "video",
          "max_video_quality",
          "Max Video Quality",
          "select",
          [
            { value: "hd", label: "High Definition (HD)" },
            { value: "fhd", label: "Full HD (1080p)" },
            { value: "4k", label: "4K Ultra HD" },
          ],
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "video",
          "enable_virtual_backgrounds",
          "Enable Virtual Backgrounds",
          "boolean",
        )}
        {renderInput(
          "video",
          "enable_beauty_filter",
          "Enable Beauty Filter",
          "boolean",
        )}
        {renderInput(
          "video",
          "bandwidth_optimization",
          "Bandwidth Optimization",
          "boolean",
        )}
        {renderInput(
          "video",
          "adaptive_bitrate",
          "Adaptive Bitrate",
          "boolean",
        )}
        {renderInput(
          "video",
          "h264_hardware_acceleration",
          "H.264 Hardware Acceleration",
          "boolean",
        )}
        {renderInput("video", "vp9_encoding", "VP9 Encoding", "boolean")}
      </div>
    </div>
  );

  const renderAudioSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "audio",
          "default_audio_quality",
          "Default Audio Quality",
          "select",
          [
            { value: "low", label: "Low Quality" },
            { value: "standard", label: "Standard Quality" },
            { value: "high", label: "High Quality" },
            { value: "premium", label: "Premium Quality" },
          ],
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "audio",
          "noise_suppression",
          "Noise Suppression",
          "boolean",
        )}
        {renderInput(
          "audio",
          "echo_cancellation",
          "Echo Cancellation",
          "boolean",
        )}
        {renderInput(
          "audio",
          "auto_gain_control",
          "Auto Gain Control",
          "boolean",
        )}
        {renderInput(
          "audio",
          "enable_music_mode",
          "Enable Music Mode",
          "boolean",
        )}
        {renderInput(
          "audio",
          "enable_spatial_audio",
          "Enable Spatial Audio",
          "boolean",
        )}
        {renderInput(
          "audio",
          "audio_processing_aec",
          "Audio Processing AEC",
          "boolean",
        )}
        {renderInput(
          "audio",
          "audio_processing_ns",
          "Audio Processing NS",
          "boolean",
        )}
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "security",
          "password_min_length",
          "Minimum Password Length",
          "number",
        )}
        {renderInput(
          "security",
          "max_login_attempts",
          "Max Login Attempts",
          "number",
        )}
        {renderInput(
          "security",
          "lockout_duration_minutes",
          "Lockout Duration (minutes)",
          "number",
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "security",
          "require_two_factor",
          "Require Two-Factor Authentication",
          "boolean",
        )}
        {renderInput(
          "security",
          "password_require_special",
          "Require Special Characters",
          "boolean",
        )}
        {renderInput(
          "security",
          "password_require_numbers",
          "Require Numbers",
          "boolean",
        )}
        {renderInput(
          "security",
          "password_require_uppercase",
          "Require Uppercase Letters",
          "boolean",
        )}
        {renderInput(
          "security",
          "enable_ip_whitelisting",
          "Enable IP Whitelisting",
          "boolean",
        )}
        {renderInput(
          "security",
          "enable_rate_limiting",
          "Enable Rate Limiting",
          "boolean",
        )}
        {renderInput("security", "secure_cookies", "Secure Cookies", "boolean")}
        {renderInput(
          "security",
          "enable_csrf_protection",
          "Enable CSRF Protection",
          "boolean",
        )}
      </div>
    </div>
  );

  const renderEmailSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput("email", "smtp_host", "SMTP Host")}
        {renderInput("email", "smtp_port", "SMTP Port", "number")}
        {renderInput("email", "smtp_username", "SMTP Username")}
        {renderInput("email", "smtp_password", "SMTP Password", "password")}
        {renderInput("email", "smtp_encryption", "SMTP Encryption", "select", [
          { value: "none", label: "None" },
          { value: "tls", label: "TLS" },
          { value: "ssl", label: "SSL" },
        ])}
        {renderInput("email", "from_email", "From Email")}
        {renderInput("email", "from_name", "From Name")}
      </div>

      <div className="space-y-4">
        {renderInput(
          "email",
          "enable_email_notifications",
          "Enable Email Notifications",
          "boolean",
        )}
        {renderInput(
          "email",
          "email_templates_customizable",
          "Email Templates Customizable",
          "boolean",
        )}
      </div>

      <div className="pt-4">
        <Button
          onClick={() => handleTest("email")}
          variant="outline"
          disabled={testResults.email === "testing"}
        >
          <Icons.Test />
          <span className="ml-1">
            {testResults.email === "testing"
              ? "Testing..."
              : "Test Email Configuration"}
          </span>
        </Button>
        {testResults.email === "success" && (
          <p className="text-success text-sm mt-2">
            <Icons.Check /> Email configuration test successful
          </p>
        )}
        {testResults.email === "error" && (
          <p className="text-destructive text-sm mt-2">
            <Icons.Error /> Email configuration test failed
          </p>
        )}
      </div>
    </div>
  );

  const renderStorageSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "storage",
          "storage_provider",
          "Storage Provider",
          "select",
          [
            { value: "local", label: "Local Storage" },
            { value: "aws_s3", label: "Amazon S3" },
            { value: "google_cloud", label: "Google Cloud Storage" },
            { value: "azure_blob", label: "Azure Blob Storage" },
          ],
        )}
        {renderInput(
          "storage",
          "max_file_size_mb",
          "Max File Size (MB)",
          "number",
        )}
        {renderInput("storage", "allowed_file_types", "Allowed File Types")}
        {renderInput(
          "storage",
          "recording_storage_limit_gb",
          "Recording Storage Limit (GB)",
          "number",
        )}
        {renderInput(
          "storage",
          "backup_frequency",
          "Backup Frequency",
          "select",
          [
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ],
        )}
        {renderInput(
          "storage",
          "backup_retention_days",
          "Backup Retention (days)",
          "number",
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "storage",
          "cleanup_old_recordings",
          "Cleanup Old Recordings",
          "boolean",
        )}
        {renderInput("storage", "backup_enabled", "Backup Enabled", "boolean")}
      </div>
    </div>
  );

  const renderIntegrationSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput(
          "integration",
          "api_rate_limit",
          "API Rate Limit (per hour)",
          "number",
        )}
      </div>

      <div className="space-y-4">
        {renderInput(
          "integration",
          "google_calendar_enabled",
          "Google Calendar Integration",
          "boolean",
        )}
        {renderInput(
          "integration",
          "outlook_calendar_enabled",
          "Outlook Calendar Integration",
          "boolean",
        )}
        {renderInput(
          "integration",
          "slack_integration",
          "Slack Integration",
          "boolean",
        )}
        {renderInput(
          "integration",
          "teams_integration",
          "Microsoft Teams Integration",
          "boolean",
        )}
        {renderInput("integration", "zoom_import", "Zoom Import", "boolean")}
        {renderInput(
          "integration",
          "webhooks_enabled",
          "Webhooks Enabled",
          "boolean",
        )}
        {renderInput(
          "integration",
          "sso_enabled",
          "Single Sign-On (SSO)",
          "boolean",
        )}
        {renderInput(
          "integration",
          "ldap_enabled",
          "LDAP Integration",
          "boolean",
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralSettings();
      case "meeting":
        return renderMeetingSettings();
      case "video":
        return renderVideoSettings();
      case "audio":
        return renderAudioSettings();
      case "security":
        return renderSecuritySettings();
      case "email":
        return renderEmailSettings();
      case "storage":
        return renderStorageSettings();
      case "integration":
        return renderIntegrationSettings();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-muted-foreground">
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure platform settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && <Badge variant="warning">Unsaved Changes</Badge>}
          <Button variant="outline" onClick={handleReset}>
            <Icons.Reset />
            <span className="ml-1">Reset</span>
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            <Icons.Save />
            <span className="ml-1">
              {isSaving ? "Saving..." : "Save Changes"}
            </span>
          </Button>
        </div>
      </div>

      {/* System Status */}
      {systemHealth && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icons.Monitor />
                <div>
                  <h3 className="font-semibold">System Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Overall system health and performance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-success">
                    {systemHealth.overall_score || 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Health Score
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">
                    {systemHealth.uptime || "99.9"}%
                  </div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">
                    {systemHealth.active_users || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active Users
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary border-r-2 border-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Settings Content */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {tabs.find((t) => t.id === activeTab)?.icon}
              {tabs.find((t) => t.id === activeTab)?.label} Settings
            </CardTitle>
            <CardDescription>
              Configure{" "}
              {tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}{" "}
              options for your platform
            </CardDescription>
          </CardHeader>
          <CardContent>{renderTabContent()}</CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Icons.Database />
            <h3 className="font-semibold mt-2">Database</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Manage database settings
            </p>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Icons.Backup />
            <h3 className="font-semibold mt-2">Backup</h3>
            <p className="text-sm text-muted-foreground mb-3">
              System backup and restore
            </p>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Icons.Update />
            <h3 className="font-semibold mt-2">Updates</h3>
            <p className="text-sm text-muted-foreground mb-3">
              System updates and maintenance
            </p>
            <Button variant="outline" size="sm">
              Check Updates
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemSettings;
