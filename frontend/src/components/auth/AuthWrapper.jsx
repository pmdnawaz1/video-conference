import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../../stores/authStore";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { LoadingSpinner } from "../ui/LoadingSpinner";

const AuthWrapper = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [showLegacyMode, setShowLegacyMode] = useState(false);
  const [invitationToken, setInvitationToken] = useState(null);
  const [invitationData, setInvitationData] = useState(null);

  const { isAuthenticated, user, isLoading, refreshAccessToken } =
    useAuthStore();

  // Handle invitation tokens from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get("token");

    if (token) {
      setInvitationToken(token);
      // Validate the invitation token
      validateInvitation(token);
    }
  }, [location.search]);

  // Validate invitation token
  const validateInvitation = async (token) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/public/invitations/validate?token=${token}`,
      );
      const result = await response.json();

      if (response.ok && result.success) {
        setInvitationData(result);
        setAuthMode("register"); // Show register form for invited users
      } else {
        console.error("Invalid invitation token:", result.error);
        // Token invalid, continue with normal flow
      }
    } catch (error) {
      console.error("Error validating invitation:", error);
    }
  };

  // Set auth mode based on current route
  useEffect(() => {
    if (!invitationToken) {
      // Only set mode if not handling invitation
      if (location.pathname === "/register" || location.pathname === "/join") {
        setAuthMode("register");
      } else {
        setAuthMode("login");
      }
    }
  }, [location.pathname, invitationToken]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      if (!isAuthenticated && !user) {
        // Try to refresh token if we have one stored
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          console.log("No valid session found");
        }
      }
    };

    checkSession();
  }, [isAuthenticated, user, refreshAccessToken]);

  // Handle navigation based on authentication state
  useEffect(() => {
    if (isAuthenticated && user) {
      // Only redirect to dashboard from auth pages
      if (
        location.pathname === "/" ||
        location.pathname === "/login" ||
        location.pathname === "/register"
      ) {
        navigate("/dashboard");
      }
      // Let other authenticated routes render normally
    } else {
      // If not authenticated and on a protected route, redirect to login
      const protectedRoutes = ["/dashboard", "/meeting"];
      const isProtectedRoute = protectedRoutes.some((route) =>
        location.pathname.startsWith(route),
      );

      if (isProtectedRoute && !location.pathname.includes("/join")) {
        navigate("/login");
      }
    }
  }, [isAuthenticated, user, navigate, location.pathname]);

  const handleLoginSuccess = () => {
    setAuthMode("login");
  };

  const handleRegisterSuccess = () => {
    // After successful registration, redirect to login
    navigate("/login");
  };

  const handleSwitchToRegister = () => {
    navigate("/register");
  };

  const handleSwitchToLogin = () => {
    navigate("/login");
  };

  const handleLegacyMode = () => {
    setShowLegacyMode(true);
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user chooses legacy mode, render the original video conference app
  if (showLegacyMode) {
    return children;
  }

  // If authenticated, let React Router handle the routing
  if (isAuthenticated && user) {
    return children;
  }

  // Show authentication forms
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Invitation Banner */}
        {invitationData && invitationData.meeting && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              You're invited to join a meeting!
            </h3>
            <div className="text-sm text-blue-700">
              <p className="font-medium">{invitationData.meeting.title}</p>
              <p className="mt-1">{invitationData.meeting.description}</p>
              <p className="mt-2 text-xs">
                📅{" "}
                {new Date(
                  invitationData.meeting.scheduled_start,
                ).toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-3">
              {authMode === "register"
                ? "Create an account to join the meeting"
                : "Sign in to join the meeting"}
            </p>
          </div>
        )}

        {authMode === "login" ? (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={handleSwitchToRegister}
            invitationToken={invitationToken}
          />
        ) : (
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={handleSwitchToLogin}
            invitationToken={invitationToken}
            invitationData={invitationData}
          />
        )}

        {/* Legacy Mode Option */}
        <div className="mt-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-muted text-muted-foreground">or</span>
            </div>
          </div>

          {/* <div className="mt-6">
            <button
              onClick={handleLegacyMode}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              Continue with Legacy Video Conference (No Login Required)
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default AuthWrapper;
