import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
import { Alert, AlertDescription } from "../ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Key,
  User,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import useAuthStore from "../../stores/authStore";

const ACTIVATION_STATES = {
  LOADING: "loading",
  SUCCESS: "success",
  EXPIRED: "expired",
  INVALID: "invalid",
  ALREADY_ACTIVATED: "already_activated",
  ERROR: "error",
};

const UserActivationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { activateUser, isLoading } = useAuthStore();

  const [activationState, setActivationState] = useState(
    ACTIVATION_STATES.LOADING,
  );
  const [userInfo, setUserInfo] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
    showPassword: false,
    showConfirmPassword: false,
  });
  const [errors, setErrors] = useState({});
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  useEffect(() => {
    if (token) {
      validateActivationToken();
    } else {
      setActivationState(ACTIVATION_STATES.INVALID);
    }
  }, [token]);

  const validateActivationToken = async () => {
    try {
      setActivationState(ACTIVATION_STATES.LOADING);

      // Call backend to validate token and get user info
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/activate/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        if (result.success) {
          setUserInfo(result.user);
          if (result.user.is_activated) {
            setActivationState(ACTIVATION_STATES.ALREADY_ACTIVATED);
          } else {
            setActivationState(ACTIVATION_STATES.SUCCESS);
          }
        } else {
          setActivationState(
            result.expired
              ? ACTIVATION_STATES.EXPIRED
              : ACTIVATION_STATES.INVALID,
          );
        }
      } else {
        setActivationState(ACTIVATION_STATES.ERROR);
      }
    } catch (error) {
      console.error("Token validation error:", error);
      setActivationState(ACTIVATION_STATES.ERROR);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));

    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validatePassword = () => {
    const newErrors = {};

    if (!passwordForm.password) {
      newErrors.password = "Password is required";
    } else if (passwordForm.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.password)) {
      newErrors.password =
        "Password must contain uppercase, lowercase, and number";
    }

    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (passwordForm.password !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleActivateAccount = async () => {
    if (!validatePassword()) return;

    try {
      setIsSettingPassword(true);

      const result = await activateUser({
        token,
        password: passwordForm.password,
      });

      if (result.success) {
        // Show success message briefly then redirect
        setTimeout(() => {
          navigate("/dashboard", {
            state: {
              message: "Account activated successfully! Welcome to VideoConf.",
              showOnboarding: true,
            },
          });
        }, 2000);
      } else {
        setErrors({
          general: result.error || "Activation failed. Please try again.",
        });
      }
    } catch (error) {
      console.error("Activation error:", error);
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleResendActivation = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/activate/resend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userInfo?.email }),
        },
      );

      if (response.ok) {
        setActivationState(ACTIVATION_STATES.SUCCESS);
      }
    } catch (error) {
      console.error("Resend activation error:", error);
    }
  };

  const renderLoadingState = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
          Validating Your Account
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground">
          Please wait while we verify your activation link...
        </p>
      </div>
    </div>
  );

  const renderSuccessState = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
            Activate Your Account
          </h2>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Welcome! Set up your password to complete account activation.
          </p>
        </div>
      </div>

      {userInfo && (
        <div className="flex items-center justify-center space-x-4 p-4 bg-muted dark:bg-muted0 rounded-lg">
          <Avatar className="w-12 h-12">
            <AvatarImage src={userInfo.profile_picture} />
            <AvatarFallback>
              {userInfo.first_name?.[0]}
              {userInfo.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="font-medium text-muted-foreground dark:text-white">
              {userInfo.first_name} {userInfo.last_name}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {userInfo.email}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="password" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Create Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={passwordForm.showPassword ? "text" : "password"}
              value={passwordForm.password}
              onChange={(e) => handlePasswordChange("password", e.target.value)}
              placeholder="Enter a strong password"
              className={errors.password ? "border-red-500" : ""}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() =>
                setPasswordForm((prev) => ({
                  ...prev,
                  showPassword: !prev.showPassword,
                }))
              }
            >
              {passwordForm.showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
          {errors.password && (
            <div className="text-sm text-red-600 mt-1">{errors.password}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Password must be at least 8 characters with uppercase, lowercase,
            and numbers
          </div>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={passwordForm.showConfirmPassword ? "text" : "password"}
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                handlePasswordChange("confirmPassword", e.target.value)
              }
              placeholder="Confirm your password"
              className={errors.confirmPassword ? "border-red-500" : ""}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() =>
                setPasswordForm((prev) => ({
                  ...prev,
                  showConfirmPassword: !prev.showConfirmPassword,
                }))
              }
            >
              {passwordForm.showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
          {errors.confirmPassword && (
            <div className="text-sm text-red-600 mt-1">
              {errors.confirmPassword}
            </div>
          )}
        </div>

        {errors.general && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleActivateAccount}
          disabled={isSettingPassword}
          className="w-full"
          size="lg"
        >
          {isSettingPassword ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Activating Account...
            </>
          ) : (
            <>
              Activate Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>

      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          By activating your account, you agree to our Terms of Service and
          Privacy Policy
        </div>
      </div>
    </div>
  );

  const renderExpiredState = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-8 h-8 text-orange-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
          Activation Link Expired
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground">
          This activation link has expired. Request a new one to activate your
          account.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          onClick={handleResendActivation}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Send New Activation Link
        </Button>
        <Button variant="ghost" onClick={() => navigate("/login")}>
          Back to Login
        </Button>
      </div>
    </div>
  );

  const renderInvalidState = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
          Invalid Activation Link
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground">
          This activation link is invalid or has been used already.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          onClick={() => navigate("/register")}
          variant="outline"
          className="w-full"
        >
          Create New Account
        </Button>
        <Button variant="ghost" onClick={() => navigate("/login")}>
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );

  const renderAlreadyActivatedState = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8 text-blue-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
          Account Already Activated
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground">
          Your account is already activated and ready to use.
        </p>
      </div>
      {userInfo && (
        <div className="flex items-center justify-center space-x-4 p-4 bg-muted dark:bg-muted0 rounded-lg">
          <Avatar className="w-12 h-12">
            <AvatarImage src={userInfo.profile_picture} />
            <AvatarFallback>
              {userInfo.first_name?.[0]}
              {userInfo.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="font-medium text-muted-foreground dark:text-white">
              {userInfo.first_name} {userInfo.last_name}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {userInfo.email}
            </div>
          </div>
        </div>
      )}
      <Button onClick={() => navigate("/login")} className="w-full">
        <User className="w-4 h-4 mr-2" />
        Sign In to Your Account
      </Button>
    </div>
  );

  const renderErrorState = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-muted-foreground dark:text-white mb-2">
          Something Went Wrong
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground">
          We encountered an error while processing your activation.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          onClick={validateActivationToken}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activationState) {
      case ACTIVATION_STATES.LOADING:
        return renderLoadingState();
      case ACTIVATION_STATES.SUCCESS:
        return renderSuccessState();
      case ACTIVATION_STATES.EXPIRED:
        return renderExpiredState();
      case ACTIVATION_STATES.INVALID:
        return renderInvalidState();
      case ACTIVATION_STATES.ALREADY_ACTIVATED:
        return renderAlreadyActivatedState();
      case ACTIVATION_STATES.ERROR:
        return renderErrorState();
      default:
        return renderErrorState();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Account Activation</CardTitle>
            <CardDescription>
              Complete your VideoConf account setup
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">{renderContent()}</CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Need help?{" "}
            <Button variant="link" className="p-0 h-auto">
              Contact Support
            </Button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default UserActivationPage;
