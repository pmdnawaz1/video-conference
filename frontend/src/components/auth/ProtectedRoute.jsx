import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../../stores/authStore";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useRoleCheck } from "./RoleBasedAccess";

const ProtectedRoute = ({
  children,
  requireAuth = true,
  allowGuest = false,
  requiredRole = null,
  requiredRoles = [],
  allowedRoles = [],
  deniedRoles = [],
}) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const { hasRole, hasAnyRole } = useRoleCheck();
  const location = useLocation();

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

  // If authentication is required
  if (requireAuth) {
    if (!isAuthenticated || !user) {
      // For meeting routes with /join, allow guest access if specified
      if (allowGuest && location.pathname.includes("/join")) {
        return children;
      }

      // Redirect to login, but preserve the intended destination
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check role-based access if user is authenticated
    if (isAuthenticated && user) {
      const userRole = user.role;

      // Role hierarchy levels for comparison
      const roleHierarchy = {
        GUEST: 0,
        USER: 1,
        ADMIN: 2,
        SUPER_ADMIN: 3,
      };

      // Check required role level
      if (requiredRole) {
        const userLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        if (userLevel < requiredLevel) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
              <div className="text-center max-w-md mx-auto p-6">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-red-600 mb-2">
                    Access Denied
                  </h1>
                  <p className="text-muted-foreground mb-4">
                    You don't have the required permissions to access this page.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Required role:{" "}
                    <span className="font-medium">{requiredRole}</span>
                    <br />
                    Your role: <span className="font-medium">{userRole}</span>
                  </p>
                  <button
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          );
        }
      }

      // Check required roles (must have one of these)
      if (requiredRoles.length > 0) {
        if (!requiredRoles.includes(userRole)) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
              <div className="text-center max-w-md mx-auto p-6">
                <h1 className="text-2xl font-bold text-red-600 mb-2">
                  Access Denied
                </h1>
                <p className="text-muted-foreground mb-4">
                  You don't have the required role to access this page.
                </p>
                <p className="text-sm text-muted-foreground">
                  Required roles: {requiredRoles.join(", ")}
                </p>
              </div>
            </div>
          );
        }
      }

      // Check allowed roles (whitelist)
      if (allowedRoles.length > 0) {
        if (!allowedRoles.includes(userRole)) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
              <div className="text-center max-w-md mx-auto p-6">
                <h1 className="text-2xl font-bold text-red-600 mb-2">
                  Access Denied
                </h1>
                <p className="text-muted-foreground mb-4">
                  Your role is not allowed to access this page.
                </p>
              </div>
            </div>
          );
        }
      }

      // Check denied roles (blacklist)
      if (deniedRoles.length > 0) {
        if (deniedRoles.includes(userRole)) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
              <div className="text-center max-w-md mx-auto p-6">
                <h1 className="text-2xl font-bold text-red-600 mb-2">
                  Access Denied
                </h1>
                <p className="text-muted-foreground mb-4">
                  Your role is restricted from accessing this page.
                </p>
              </div>
            </div>
          );
        }
      }
    }
  }

  // If route should only be accessible to non-authenticated users (like login/register)
  if (requireAuth === false && isAuthenticated && user) {
    // Redirect authenticated users away from login/register pages
    const from = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  // Render the protected content
  return children;
};

export default ProtectedRoute;
