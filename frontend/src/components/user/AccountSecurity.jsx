import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import { format } from "date-fns";
import useAuthStore from "../../stores/authStore";

const AccountSecurity = ({ onClose }) => {
  const { user, updatePassword, logout } = useAuthStore();

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [twoFactorData, setTwoFactorData] = useState({
    enabled: false,
    backupCodes: [],
    qrCode: null,
    verificationCode: "",
  });

  const [sessionsData, setSessionsData] = useState([]);
  const [securityLog, setSecurityLog] = useState([]);

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadSecurityData();
  }, []);

  useEffect(() => {
    // Calculate password strength when new password changes
    if (passwordData.newPassword) {
      const strength = calculatePasswordStrength(passwordData.newPassword);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [passwordData.newPassword]);

  const loadSecurityData = async () => {
    setIsLoading(true);
    try {
      // Load active sessions
      const sessionsResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/sessions`,
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      if (sessionsResponse.ok) {
        const sessionsResult = await sessionsResponse.json();
        setSessionsData(sessionsResult.data || []);
      }

      // Load security log
      const logResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/security-log`,
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      if (logResponse.ok) {
        const logResult = await logResponse.json();
        setSecurityLog(logResult.data || []);
      }

      // Load 2FA status
      const twoFactorResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/2fa-status`,
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      if (twoFactorResponse.ok) {
        const twoFactorResult = await twoFactorResponse.json();
        setTwoFactorData((prev) => ({
          ...prev,
          enabled: twoFactorResult.data?.enabled || false,
        }));
      }
    } catch (error) {
      console.error("Failed to load security data:", error);
      setError("Failed to load security information");
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePasswordStrength = (password) => {
    let score = 0;
    const feedback = [];

    if (password.length < 8) {
      feedback.push("Password should be at least 8 characters long");
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push("Add uppercase letters");
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push("Add lowercase letters");
    } else {
      score += 1;
    }

    if (!/[0-9]/.test(password)) {
      feedback.push("Add numbers");
    } else {
      score += 1;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      feedback.push("Add special characters");
    } else {
      score += 1;
    }

    if (password.length >= 12) {
      score += 1;
    }

    return {
      score: Math.min(score, 5),
      feedback: feedback.length === 0 ? ["Strong password!"] : feedback,
    };
  };

  const getPasswordStrengthColor = (score) => {
    if (score <= 2) return "bg-red-500";
    if (score <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = (score) => {
    if (score <= 2) return "Weak";
    if (score <= 3) return "Medium";
    if (score <= 4) return "Strong";
    return "Very Strong";
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordStrength.score < 3) {
      setError("Please choose a stronger password");
      return;
    }

    setIsUpdatingPassword(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: JSON.stringify({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
          }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess("Password updated successfully");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Add to security log
        setSecurityLog((prev) => [
          {
            action: "Password Changed",
            timestamp: new Date().toISOString(),
            ipAddress: "Current session",
            userAgent: navigator.userAgent,
          },
          ...prev,
        ]);
      } else {
        setError(result.error || "Failed to update password");
      }
    } catch (error) {
      setError("Network error - failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleEnable2FA = async () => {
    setIsEnabling2FA(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/enable-2fa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setTwoFactorData((prev) => ({
          ...prev,
          qrCode: result.data.qrCode,
          backupCodes: result.data.backupCodes,
        }));
      } else {
        setError(result.error || "Failed to enable 2FA");
      }
    } catch (error) {
      setError("Network error - failed to enable 2FA");
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorData.verificationCode) {
      setError("Please enter verification code");
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/verify-2fa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: JSON.stringify({
            code: twoFactorData.verificationCode,
          }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setTwoFactorData((prev) => ({
          ...prev,
          enabled: true,
          qrCode: null,
          verificationCode: "",
        }));
        setSuccess("Two-factor authentication enabled successfully");
      } else {
        setError(result.error || "Invalid verification code");
      }
    } catch (error) {
      setError("Network error - failed to verify 2FA");
    }
  };

  const handleDisable2FA = async () => {
    const confirmDisable = confirm(
      "Are you sure you want to disable two-factor authentication? This will make your account less secure.",
    );
    if (!confirmDisable) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/disable-2fa`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setTwoFactorData((prev) => ({
          ...prev,
          enabled: false,
          backupCodes: [],
        }));
        setSuccess("Two-factor authentication disabled");
      } else {
        setError(result.error || "Failed to disable 2FA");
      }
    } catch (error) {
      setError("Network error - failed to disable 2FA");
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      if (response.ok) {
        setSessionsData((prev) =>
          prev.filter((session) => session.id !== sessionId),
        );
        setSuccess("Session revoked successfully");
      }
    } catch (error) {
      setError("Failed to revoke session");
    }
  };

  const handleRevokeAllSessions = async () => {
    const confirmRevoke = confirm(
      "This will log you out of all devices except this one. Continue?",
    );
    if (!confirmRevoke) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/sessions/revoke-all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
          },
        },
      );

      if (response.ok) {
        setSessionsData((prev) => prev.filter((session) => session.isCurrent));
        setSuccess("All other sessions revoked successfully");
      }
    } catch (error) {
      setError("Failed to revoke sessions");
    }
  };

  const downloadBackupCodes = () => {
    const codesText = twoFactorData.backupCodes.join("\n");
    const blob = new Blob(
      [
        `Video Conference App - Backup Codes\\Keep these codes safe and secure. Each code can only be used once.\\${codesText}\\Generated: ${format(new Date(), "PPpp")}`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-codes-${format(new Date(), "yyyy-MM-dd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            {" "}
            <FiShield className="w-6 h-6 mr-2" /> Account Security{" "}
          </h1>{" "}
          <p className="text-muted-foreground">
            {" "}
            Manage your account security settings and monitor activity{" "}
          </p>{" "}
        </div>{" "}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {" "}
            <FiX className="w-4 h-4 mr-2" /> Close{" "}
          </Button>
        )}{" "}
      </div>{" "}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
          {" "}
          <div className="flex items-center space-x-2">
            {" "}
            <FiAlertTriangle className="w-5 h-5 text-red-600" />{" "}
            <p className="text-red-600 dark:text-red-400">{error}</p>{" "}
          </div>{" "}
        </Card>
      )}{" "}
      {success && (
        <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-950/20">
          {" "}
          <div className="flex items-center space-x-2">
            {" "}
            <FaCheckCircle className="w-5 h-5 text-green-600" />{" "}
            <p className="text-green-600 dark:text-green-400">{success}</p>{" "}
          </div>{" "}
        </Card>
      )}{" "}
      {isLoading ? (
        <Card className="p-8">
          {" "}
          <div className="flex items-center justify-center space-x-4">
            {" "}
            <LoadingSpinner className="w-8 h-8" />{" "}
            <p className="text-muted-foreground">
              Loading security settings...
            </p>{" "}
          </div>{" "}
        </Card>
      ) : (
        <>
          {" "}
          {/* Password Change */}{" "}
          <Card className="p-6">
            {" "}
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              {" "}
              <FiLock className="w-5 h-5 mr-2" /> Change Password{" "}
            </h3>{" "}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {" "}
              <div className="space-y-2">
                {" "}
                <label className="text-sm font-medium">
                  Current Password
                </label>{" "}
                <div className="relative">
                  {" "}
                  <Input
                    type={showPasswords.current ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                    placeholder="Enter current password"
                    required
                    aria-label="Current password"
                  />{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        current: !prev.current,
                      }))
                    }
                  >
                    {" "}
                    {showPasswords.current ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}{" "}
                  </Button>{" "}
                </div>{" "}
              </div>{" "}
              <div className="space-y-2">
                {" "}
                <label className="text-sm font-medium">New Password</label>{" "}
                <div className="relative">
                  {" "}
                  <Input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    placeholder="Enter new password"
                    required
                    aria-label="New password"
                  />{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() =>
                      setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                    }
                  >
                    {" "}
                    {showPasswords.new ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}{" "}
                  </Button>{" "}
                </div>{" "}
                {passwordData.newPassword && (
                  <div className="space-y-2">
                    {" "}
                    <div className="flex items-center justify-between text-sm">
                      {" "}
                      <span>Password Strength:</span>{" "}
                      <span
                        className={`font-medium ${passwordStrength.score <= 2 ? "text-red-600" : passwordStrength.score <= 3 ? "text-yellow-600" : "text-green-600"}`}
                      >
                        {" "}
                        {getPasswordStrengthText(passwordStrength.score)}{" "}
                      </span>{" "}
                    </div>{" "}
                    <Progress
                      value={(passwordStrength.score / 5) * 100}
                      className={`h-2 ${getPasswordStrengthColor(passwordStrength.score)}`}
                    />{" "}
                    <div className="text-xs text-muted-foreground">
                      {" "}
                      {passwordStrength.feedback.map((feedback, index) => (
                        <p key={index}>• {feedback}</p>
                      ))}{" "}
                    </div>{" "}
                  </div>
                )}{" "}
              </div>{" "}
              <div className="space-y-2">
                {" "}
                <label className="text-sm font-medium">
                  Confirm New Password
                </label>{" "}
                <div className="relative">
                  {" "}
                  <Input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder="Confirm new password"
                    required
                    aria-label="Confirm new password"
                  />{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        confirm: !prev.confirm,
                      }))
                    }
                  >
                    {" "}
                    {showPasswords.confirm ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}{" "}
                  </Button>{" "}
                </div>{" "}
                {passwordData.confirmPassword &&
                  passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-sm text-red-600">
                      Passwords do not match
                    </p>
                  )}{" "}
              </div>{" "}
              <Button
                type="submit"
                disabled={
                  isUpdatingPassword ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword ||
                  passwordData.newPassword !== passwordData.confirmPassword ||
                  passwordStrength.score < 3
                }
                className="w-full md:w-auto"
              >
                {" "}
                {isUpdatingPassword ? (
                  <>
                    {" "}
                    <LoadingSpinner className="w-4 h-4 mr-2" /> Updating...{" "}
                  </>
                ) : (
                  <>
                    {" "}
                    <FiSave className="w-4 h-4 mr-2" /> Update Password{" "}
                  </>
                )}{" "}
              </Button>{" "}
            </form>{" "}
          </Card>{" "}
          {/* Two-Factor Authentication */}{" "}
          <Card className="p-6">
            {" "}
            <div className="flex items-center justify-between mb-4">
              {" "}
              <div>
                {" "}
                <h3 className="text-lg font-semibold flex items-center">
                  {" "}
                  <FiSmartphone className="w-5 h-5 mr-2" /> Two-Factor
                  Authentication{" "}
                </h3>{" "}
                <p className="text-sm text-muted-foreground">
                  {" "}
                  Add an extra layer of security to your account{" "}
                </p>{" "}
              </div>{" "}
              <Badge
                className={
                  twoFactorData.enabled
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {" "}
                {twoFactorData.enabled ? "Enabled" : "Disabled"}{" "}
              </Badge>{" "}
            </div>{" "}
            {!twoFactorData.enabled ? (
              <div className="space-y-4">
                {" "}
                <p className="text-muted-foreground">
                  {" "}
                  Two-factor authentication adds an extra layer of security to
                  your account by requiring a verification code from your mobile
                  device.{" "}
                </p>{" "}
                {!twoFactorData.qrCode ? (
                  <Button onClick={handleEnable2FA} disabled={isEnabling2FA}>
                    {" "}
                    {isEnabling2FA ? (
                      <>
                        {" "}
                        <LoadingSpinner className="w-4 h-4 mr-2" /> Setting
                        up...{" "}
                      </>
                    ) : (
                      <>
                        {" "}
                        <FiZap className="w-4 h-4 mr-2" /> Enable 2FA{" "}
                      </>
                    )}{" "}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {" "}
                    <div className="border rounded-lg p-4">
                      {" "}
                      <h4 className="font-medium mb-2">
                        Step 1: Scan QR Code
                      </h4>{" "}
                      <p className="text-sm text-muted-foreground mb-4">
                        {" "}
                        Scan this QR code with your authenticator app (Google
                        Authenticator, Authy, etc.){" "}
                      </p>{" "}
                      <div className="flex justify-center">
                        {" "}
                        <img
                          src={twoFactorData.qrCode}
                          alt="2FA QR Code"
                          className="border rounded-lg"
                          width={200}
                          height={200}
                        />{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="border rounded-lg p-4">
                      {" "}
                      <h4 className="font-medium mb-2">
                        Step 2: Enter Verification Code
                      </h4>{" "}
                      <div className="flex space-x-2">
                        {" "}
                        <Input
                          value={twoFactorData.verificationCode}
                          onChange={(e) =>
                            setTwoFactorData((prev) => ({
                              ...prev,
                              verificationCode: e.target.value,
                            }))
                          }
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="flex-1"
                        />{" "}
                        <Button
                          onClick={handleVerify2FA}
                          disabled={!twoFactorData.verificationCode}
                        >
                          {" "}
                          Verify{" "}
                        </Button>{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>
                )}{" "}
              </div>
            ) : (
              <div className="space-y-4">
                {" "}
                <div className="flex items-center space-x-2 text-green-600">
                  {" "}
                  <FaCheckCircle className="w-5 h-5" />{" "}
                  <span>Two-factor authentication is enabled</span>{" "}
                </div>{" "}
                {twoFactorData.backupCodes.length > 0 && (
                  <div className="border rounded-lg p-4">
                    {" "}
                    <div className="flex items-center justify-between mb-2">
                      {" "}
                      <h4 className="font-medium">Backup Codes</h4>{" "}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadBackupCodes}
                      >
                        {" "}
                        <FiDownload className="w-4 h-4 mr-2" /> Download{" "}
                      </Button>{" "}
                    </div>{" "}
                    <p className="text-sm text-muted-foreground mb-3">
                      {" "}
                      Save these codes in a safe place. You can use them to
                      access your account if you lose your phone.{" "}
                    </p>{" "}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 font-mono text-sm">
                      {" "}
                      {twoFactorData.backupCodes.map((code, index) => (
                        <div
                          key={index}
                          className="p-2 bg-muted rounded text-center"
                        >
                          {" "}
                          {code}{" "}
                        </div>
                      ))}{" "}
                    </div>{" "}
                  </div>
                )}{" "}
                <div className="flex space-x-2">
                  {" "}
                  <Button variant="outline" onClick={handleDisable2FA}>
                    {" "}
                    Disable 2FA{" "}
                  </Button>{" "}
                </div>{" "}
              </div>
            )}{" "}
          </Card>{" "}
          {/* Active Sessions */}{" "}
          <Card className="p-6">
            {" "}
            <div className="flex items-center justify-between mb-4">
              {" "}
              <h3 className="text-lg font-semibold flex items-center">
                {" "}
                <FiMonitor className="w-5 h-5 mr-2" /> Active Sessions{" "}
              </h3>{" "}
              {sessionsData.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAllSessions}
                >
                  {" "}
                  <FiTrash2 className="w-4 h-4 mr-2" /> Revoke All Others{" "}
                </Button>
              )}{" "}
            </div>{" "}
            <div className="space-y-3">
              {" "}
              {sessionsData.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  {" "}
                  <div className="flex-1">
                    {" "}
                    <div className="flex items-center space-x-2 mb-1">
                      {" "}
                      <FiMonitor className="w-4 h-4 text-muted-foreground" />{" "}
                      <span className="font-medium">
                        {" "}
                        {session.deviceType || "Unknown Device"}{" "}
                      </span>{" "}
                      {session.isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          {" "}
                          Current{" "}
                        </Badge>
                      )}{" "}
                    </div>{" "}
                    <div className="text-sm text-muted-foreground space-y-1">
                      {" "}
                      <p>{session.location || "Unknown Location"}</p>{" "}
                      <p>{session.ipAddress}</p>{" "}
                      <p>
                        Last active:{" "}
                        {format(new Date(session.lastActivity), "PPp")}
                      </p>{" "}
                    </div>{" "}
                  </div>{" "}
                  {!session.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      {" "}
                      <FiTrash2 className="w-4 h-4 mr-2" /> Revoke{" "}
                    </Button>
                  )}{" "}
                </div>
              ))}{" "}
              {sessionsData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {" "}
                  <FiMonitor className="w-12 h-12 mx-auto mb-2" />{" "}
                  <p>No active sessions found</p>{" "}
                </div>
              )}{" "}
            </div>{" "}
          </Card>{" "}
          {/* Security Log */}{" "}
          <Card className="p-6">
            {" "}
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              {" "}
              <FiClock className="w-5 h-5 mr-2" /> Security Activity{" "}
            </h3>{" "}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {" "}
              {securityLog.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 border rounded-lg"
                >
                  {" "}
                  <div
                    className={`p-2 rounded-full ${activity.action.toLowerCase().includes("login") ? "bg-blue-100 text-blue-600" : activity.action.toLowerCase().includes("password") ? "bg-green-100 text-green-600" : activity.action.toLowerCase().includes("failed") ? "bg-red-100 text-red-600" : "bg-muted0 text-muted-foreground"}`}
                  >
                    {" "}
                    <FiShield className="w-4 h-4" />{" "}
                  </div>{" "}
                  <div className="flex-1">
                    {" "}
                    <div className="flex items-center justify-between">
                      {" "}
                      <span className="font-medium">
                        {activity.action}
                      </span>{" "}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        {format(
                          new Date(activity.timestamp),
                          "MMM dd, HH:mm",
                        )}{" "}
                      </span>{" "}
                    </div>{" "}
                    <div className="text-sm text-muted-foreground">
                      {" "}
                      {activity.ipAddress} • {activity.location}{" "}
                    </div>{" "}
                  </div>{" "}
                </div>
              ))}{" "}
              {securityLog.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {" "}
                  <FiClock className="w-12 h-12 mx-auto mb-2" />{" "}
                  <p>No recent security activity</p>{" "}
                </div>
              )}{" "}
            </div>{" "}
          </Card>{" "}
        </>
      )}{" "}
    </div>
  );
};
export default AccountSecurity;
