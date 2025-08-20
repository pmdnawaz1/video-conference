import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  User,
  Mail,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import userInvitationService from "../../services/UserInvitationService";
import useAuthStore from "../../stores/authStore";
import LoadingSpinner from "../ui/LoadingSpinner";

const UserInvitationLanding = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  // Component states
  const [step, setStep] = useState(1); // 1: Validation, 2: Registration, 3: Success
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [errors, setErrors] = useState({});
  const [validationError, setValidationError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  });

  // Registration form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    phone: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: "en",
    bio: "",
    theme: "light",
    termsAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
    emailNotifications: true,
    browserNotifications: true,
    meetingReminders: true,
  });

  // Available timezones and languages
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
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "ja", label: "Japanese" },
    { value: "zh", label: "Chinese" },
  ];

  useEffect(() => {
    validateInvitation();
  }, [token]);

  useEffect(() => {
    if (formData.firstName && formData.lastName && invitation) {
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || invitation.first_name || "",
        lastName: prev.lastName || invitation.last_name || "",
      }));
    }
  }, [invitation]);

  // Real-time password strength checking
  useEffect(() => {
    if (formData.password) {
      checkPasswordStrength(formData.password);
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [formData.password]);

  const validateInvitation = async () => {
    setIsLoading(true);
    setValidationError(null);

    try {
      const result =
        await userInvitationService.validateUserInvitationToken(token);

      if (result.success) {
        setInvitation(result.invitation);
        setOrganization(result.organization);
        setAdmin(result.admin);
        setStep(2);

        // Pre-populate form with invitation data
        setFormData((prev) => ({
          ...prev,
          firstName: result.invitation.first_name || "",
          lastName: result.invitation.last_name || "",
        }));
      } else {
        setValidationError(result.error);
        setStep(1);
      }
    } catch (error) {
      setValidationError("Network error - please try again");
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPasswordStrength = (password) => {
    const validation = userInvitationService.validatePassword(password);
    let score = 0;
    const feedback = [];

    // Calculate score based on criteria
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

    // Additional complexity checks
    if (password.length >= 12) score += 1;
    if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
    if (/123|abc|password|qwerty/i.test(password)) score -= 2; // Common patterns

    score = Math.max(0, Math.min(5, score));

    // Generate feedback
    if (!validation.isValid) {
      feedback.push(...validation.errors);
    } else {
      if (score <= 2)
        feedback.push("Consider adding more variety to make it stronger");
      if (score >= 4) feedback.push("Strong password!");
    }

    setPasswordStrength({ score, feedback });
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear field-specific errors
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    const passwordValidation = userInvitationService.validatePassword(
      formData.password,
    );
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the terms of service";
    }

    if (!formData.privacyAccepted) {
      newErrors.privacyAccepted = "You must accept the privacy policy";
    }

    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegistration = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await userInvitationService.completeUserRegistration(
        token,
        formData,
      );

      if (result.success) {
        // Auto-login the user
        setAuth(
          result.user,
          result.tokens.accessToken,
          result.tokens.refreshToken,
        );
        setStep(3);

        // Redirect after a delay
        setTimeout(() => {
          navigate("/dashboard");
        }, 3000);
      } else {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
        } else {
          setErrors({ submit: result.error });
        }
      }
    } catch (error) {
      setErrors({ submit: "Registration failed. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrengthColor = (score) => {
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-yellow-500";
    if (score <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = (score) => {
    if (score <= 1) return "Very Weak";
    if (score <= 2) return "Weak";
    if (score <= 3) return "Fair";
    if (score <= 4) return "Strong";
    return "Very Strong";
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invitation state
  if (step === 1 && validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-700">Invalid Invitation</CardTitle>
            <CardDescription className="text-red-600">
              {validationError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">
                  This invitation may have expired or been cancelled. Please
                  contact your administrator for a new invitation.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration form
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              {organization?.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="h-12 w-auto"
                />
              ) : (
                <Building className="w-12 h-12 text-blue-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-muted-foreground">
              Welcome to {organization?.name}!
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Complete your account setup to get started
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Complete Your Profile
                  </CardTitle>
                  <CardDescription>
                    You've been invited by {admin?.first_name}{" "}
                    {admin?.last_name}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {invitation?.email}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        handleFormChange("firstName", e.target.value)
                      }
                      className={errors.firstName ? "border-red-500" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-red-500">{errors.firstName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        handleFormChange("lastName", e.target.value)
                      }
                      className={errors.lastName ? "border-red-500" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-red-500">{errors.lastName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number (Optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) =>
                        handleFormChange("phone", e.target.value)
                      }
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) =>
                        handleFormChange("timezone", value)
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (Optional)</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us a bit about yourself..."
                    value={formData.bio}
                    onChange={(e) => handleFormChange("bio", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              {/* Security */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          handleFormChange("password", e.target.value)
                        }
                        className={
                          errors.password ? "border-red-500 pr-10" : "pr-10"
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>

                    {formData.password && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Password Strength:</span>
                          <span
                            className={`font-medium ${
                              passwordStrength.score <= 2
                                ? "text-red-600"
                                : passwordStrength.score <= 3
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {getPasswordStrengthText(passwordStrength.score)}
                          </span>
                        </div>
                        <Progress
                          value={(passwordStrength.score / 5) * 100}
                          className="h-2"
                        />
                        {passwordStrength.feedback.length > 0 && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            {passwordStrength.feedback.map(
                              (feedback, index) => (
                                <p key={index}>{feedback}</p>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {errors.password && (
                      <p className="text-sm text-red-500">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleFormChange("confirmPassword", e.target.value)
                      }
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Preferences */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Preferences</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) =>
                        handleFormChange("language", value)
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
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={formData.theme}
                      onValueChange={(value) =>
                        handleFormChange("theme", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notification Preferences */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Notifications</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emailNotifications"
                        checked={formData.emailNotifications}
                        onCheckedChange={(checked) =>
                          handleFormChange("emailNotifications", checked)
                        }
                      />
                      <Label htmlFor="emailNotifications" className="text-sm">
                        Email notifications
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="browserNotifications"
                        checked={formData.browserNotifications}
                        onCheckedChange={(checked) =>
                          handleFormChange("browserNotifications", checked)
                        }
                      />
                      <Label htmlFor="browserNotifications" className="text-sm">
                        Browser notifications
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="meetingReminders"
                        checked={formData.meetingReminders}
                        onCheckedChange={(checked) =>
                          handleFormChange("meetingReminders", checked)
                        }
                      />
                      <Label htmlFor="meetingReminders" className="text-sm">
                        Meeting reminders
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Terms and Conditions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Terms & Privacy</h3>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="termsAccepted"
                      checked={formData.termsAccepted}
                      onCheckedChange={(checked) =>
                        handleFormChange("termsAccepted", checked)
                      }
                      className={errors.termsAccepted ? "border-red-500" : ""}
                    />
                    <Label
                      htmlFor="termsAccepted"
                      className="text-sm leading-relaxed"
                    >
                      I agree to the{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        Terms of Service
                      </a>{" "}
                      *
                    </Label>
                  </div>
                  {errors.termsAccepted && (
                    <p className="text-sm text-red-500 ml-6">
                      {errors.termsAccepted}
                    </p>
                  )}

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="privacyAccepted"
                      checked={formData.privacyAccepted}
                      onCheckedChange={(checked) =>
                        handleFormChange("privacyAccepted", checked)
                      }
                      className={errors.privacyAccepted ? "border-red-500" : ""}
                    />
                    <Label
                      htmlFor="privacyAccepted"
                      className="text-sm leading-relaxed"
                    >
                      I agree to the{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        Privacy Policy
                      </a>{" "}
                      *
                    </Label>
                  </div>
                  {errors.privacyAccepted && (
                    <p className="text-sm text-red-500 ml-6">
                      {errors.privacyAccepted}
                    </p>
                  )}

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="marketingConsent"
                      checked={formData.marketingConsent}
                      onCheckedChange={(checked) =>
                        handleFormChange("marketingConsent", checked)
                      }
                    />
                    <Label
                      htmlFor="marketingConsent"
                      className="text-sm leading-relaxed"
                    >
                      I would like to receive marketing communications and
                      updates
                    </Label>
                  </div>
                </div>
              </div>

              {errors.submit && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}

              <Button
                onClick={handleRegistration}
                disabled={isSubmitting}
                className="w-full h-12 text-lg"
              >
                {isSubmitting && (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                )}
                Complete Registration
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md border-green-200 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <CheckCircle className="w-16 h-16 text-green-500" />
                <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1" />
              </div>
            </div>
            <CardTitle className="text-green-700 text-xl">
              Welcome Aboard!
            </CardTitle>
            <CardDescription className="text-green-600">
              Your account has been created successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-700">
                You're now part of <strong>{organization?.name}</strong>.
                Redirecting you to your dashboard...
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-green-600" />
              </div>
              <p className="text-sm text-green-600">
                Setting up your workspace...
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              Go to Dashboard Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default UserInvitationLanding;
