import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import EmailVerificationSuccess from "../components/auth/EmailVerificationSuccess";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AlertCircle, RefreshCw, Mail } from "lucide-react";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // 'loading', 'success', 'error', 'already-verified'
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(
        "No verification token provided. Please check your email link.",
      );
      return;
    }

    verifyEmailToken();
  }, [token]);

  const verifyEmailToken = async () => {
    if (!token) return;

    try {
      setIsRetrying(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/verify-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        if (data.alreadyVerified) {
          setStatus("already-verified");
          setMessage("Your email was already verified. You can sign in now.");
        } else {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
        }
        setUser(data.user);
      } else {
        setStatus("error");
        setMessage(
          data.message ||
            "Email verification failed. The link may be invalid or expired.",
        );
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setStatus("error");
      setMessage("Network error occurred. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    setStatus("loading");
    verifyEmailToken();
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold text-muted-foreground">
              Verifying Email...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return <EmailVerificationSuccess user={user} message={message} />;
  }

  // Already verified state
  if (status === "already-verified") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success/10 mb-4">
              <Mail className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl font-bold text-muted-foreground">
              Already Verified
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">{message}</p>
            {user ? (
              <div className="space-y-3">
                <Button
                  onClick={handleGoToDashboard}
                  className="w-full"
                  size="lg"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={handleGoToLogin}
                  variant="outline"
                  className="w-full"
                >
                  Sign In Again
                </Button>
              </div>
            ) : (
              <Button onClick={handleGoToLogin} className="w-full" size="lg">
                Sign In
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-muted-foreground">
            Verification Failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-sm text-red-800">{message}</p>
          </div>

          <div className="space-y-3">
            {token && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full"
                variant="outline"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Try Again"
                )}
              </Button>
            )}

            <Button onClick={handleGoToLogin} className="w-full">
              Back to Sign In
            </Button>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need a new verification link?{" "}
              <button
                onClick={() => navigate("/email-verification-pending")}
                className="text-blue-600 hover:underline"
              >
                Request new email
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
