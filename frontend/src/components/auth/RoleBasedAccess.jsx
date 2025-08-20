import React from "react";
import useAuthStore from "../../stores/authStore";

/**
 * Role-based access control component
 * Shows/hides content based on user roles and permissions
 */
const RoleBasedAccess = ({
  children,
  requiredRole = null,
  requiredRoles = [],
  allowedRoles = [],
  deniedRoles = [],
  fallback = null,
  checkPermission = null,
  showFallback = true,
}) => {
  const { user, isAuthenticated } = useAuthStore();

  // Not authenticated
  if (!isAuthenticated || !user) {
    return showFallback ? fallback : null;
  }

  const userRole = user.role;

  // Role hierarchy levels
  const roleHierarchy = {
    GUEST: 0,
    USER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  // Check if user has required role level or higher
  if (requiredRole) {
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return showFallback ? fallback : null;
    }
  }

  // Check if user has any of the required roles
  if (requiredRoles.length > 0) {
    if (!requiredRoles.includes(userRole)) {
      return showFallback ? fallback : null;
    }
  }

  // Check if user has any of the allowed roles
  if (allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return showFallback ? fallback : null;
    }
  }

  // Check if user is in denied roles
  if (deniedRoles.length > 0) {
    if (deniedRoles.includes(userRole)) {
      return showFallback ? fallback : null;
    }
  }

  // Custom permission check
  if (checkPermission && typeof checkPermission === "function") {
    if (!checkPermission(user)) {
      return showFallback ? fallback : null;
    }
  }

  // All checks passed, render children
  return children;
};

/**
 * Helper components for common role checks
 */
export const AdminOnly = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const SuperAdminOnly = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="SUPER_ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const AuthenticatedOnly = ({ children, fallback = null }) => (
  <RoleBasedAccess fallback={fallback}>{children}</RoleBasedAccess>
);

export const UserOrHigher = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="USER" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const GuestAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess
    allowedRoles={["GUEST", "USER", "ADMIN", "SUPER_ADMIN"]}
    fallback={fallback}
  >
    {children}
  </RoleBasedAccess>
);

// Feature-specific access components
export const ScheduleMeetingsAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const SystemAnalyticsAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="SUPER_ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const AddAdminsAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="SUPER_ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const UserManagementAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

export const GroupManagementAccess = ({ children, fallback = null }) => (
  <RoleBasedAccess requiredRole="ADMIN" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

/**
 * Hook for role-based logic in components
 */
export const useRoleCheck = () => {
  const { user, isAuthenticated } = useAuthStore();

  const hasRole = (role) => {
    if (!isAuthenticated || !user) {
      return false;
    }

    const roleHierarchy = {
      GUEST: 0,
      USER: 1,
      ADMIN: 2,
      SUPER_ADMIN: 3,
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[role] || 0;

    return userLevel >= requiredLevel;
  };

  const hasAnyRole = (roles) => {
    if (!isAuthenticated || !user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (checkFunc) => {
    if (!isAuthenticated || !user) return false;
    if (typeof checkFunc !== "function") return false;
    return checkFunc(user);
  };

  const canManageUsers = () => {
    return hasRole("ADMIN");
  };

  const canManageGroups = () => {
    return hasRole("ADMIN");
  };

  const canCreateMeetings = () => {
    return hasRole("USER");
  };

  const canScheduleMeetings = () => {
    return hasRole("ADMIN"); // Only admins can schedule meetings
  };

  const canModerate = (meetingId = null) => {
    // Basic moderation check - can be extended with meeting-specific logic
    return hasRole("ADMIN");
  };

  const canInviteUsers = () => {
    return hasRole("USER"); // Users can invite others
  };

  const canAccessAnalytics = () => {
    return hasRole("ADMIN");
  };

  const canAccessSystemAnalytics = () => {
    return hasRole("SUPER_ADMIN"); // Only super admins can see system analytics
  };

  const canAddAdmins = () => {
    return hasRole("SUPER_ADMIN"); // Only super admins can add other admins
  };

  const canAccessAdminDashboard = () => {
    return hasRole("SUPER_ADMIN"); // Super admin dashboard is restricted
  };

  const canAccessMessages = () => {
    return hasRole("USER"); // All authenticated users can access messages
  };

  const canAccessCalendar = () => {
    return hasRole("USER"); // All authenticated users can access calendar
  };

  const canAccessMeetingHistory = () => {
    return hasRole("USER"); // All authenticated users can access meeting history
  };

  return {
    user,
    isAuthenticated,
    hasRole,
    hasAnyRole,
    hasPermission,
    canManageUsers,
    canManageGroups,
    canCreateMeetings,
    canScheduleMeetings,
    canModerate,
    canInviteUsers,
    canAccessAnalytics,
    canAccessSystemAnalytics,
    canAddAdmins,
    canAccessAdminDashboard,
    canAccessMessages,
    canAccessCalendar,
    canAccessMeetingHistory,
    isGuest: user?.role === "GUEST",
    isUser: user?.role === "USER",
    isAdmin: user?.role === "ADMIN",
    isSuperAdmin: user?.role === "SUPER_ADMIN",
  };
};

export default RoleBasedAccess;
