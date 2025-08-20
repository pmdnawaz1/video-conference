import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

const EmailVerificationSuccess = ({
  user,
  message = "Your email has been verified successfully!",
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to dashboard after 5 seconds
    const timer = setTimeout(() => {
      navigate("/dashboard");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-muted-foreground">
            Email Verified!
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">{message}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {user && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-center">
                <p className="text-sm text-green-800">
                  Welcome,{" "}
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                  !
                </p>
                <p className="text-sm text-green-600 mt-1">{user.email}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-muted-foreground mb-2">
                You now have access to:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create and join video conferences</li>
                <li>• Access all platform features</li>
                <li>• Receive important notifications</li>
                <li>• Reset your password if needed</li>
              </ul>
            </div>

            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue to Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                You'll be automatically redirected in 5 seconds
              </p>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Ready to start your first meeting?{" "}
              <button
                onClick={() => navigate("/dashboard")}
                className="text-blue-600 hover:underline font-medium"
              >
                Get started
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationSuccess;
