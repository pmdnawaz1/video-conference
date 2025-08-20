import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Mail, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const EmailVerificationPending = ({ userEmail, onResendSuccess }) => {
  const [email, setEmail] = useState(userEmail || "");
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'

  const handleResendVerification = async (e) => {
    e.preventDefault();

    if (!email) {
      setMessage("Please enter your email address");
      setMessageType("error");
      return;
    }

    setIsResending(true);
    setMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        if (data.alreadyVerified) {
          setMessage("Your email is already verified! You can now sign in.");
          setMessageType("success");
          if (onResendSuccess) onResendSuccess(data);
        } else {
          setMessage("Verification email sent! Please check your inbox.");
          setMessageType("success");
        }
      } else {
        setMessage(data.message || "Failed to send verification email");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setMessage("Network error. Please try again.");
      setMessageType("error");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-muted-foreground">
            Verify Your Email
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            We've sent a verification link to your email address. Please check
            your inbox and click the link to verify your account.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {message && (
            <div
              className={`p-4 rounded-md flex items-center space-x-2 ${
                messageType === "success"
                  ? "bg-green-50 text-green-800"
                  : messageType === "error"
                    ? "bg-red-50 text-red-800"
                    : "bg-blue-50 text-blue-800"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm">{message}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-muted-foreground mb-2">
                What to do next:
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Check your email inbox (and spam/junk folder)</li>
                <li>2. Click the verification link in the email</li>
                <li>3. Return here to sign in</li>
              </ol>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive the email? Enter your email address and we'll
                send another one.
              </p>

              <form onSubmit={handleResendVerification} className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button type="submit" className="w-full" disabled={isResending}>
                  {isResending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need help?{" "}
              <a
                href="mailto:support@example.com"
                className="text-blue-600 hover:underline"
              >
                Contact support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationPending;
