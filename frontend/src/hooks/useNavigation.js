import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useRoleCheck } from "../components/auth/RoleBasedAccess";
import useUserStore from "../stores/userStore";
import useAdminStore from "../stores/adminStore";

/**
 * Custom hook for managing navigation items with role-based access
 * Provides dynamic navigation items based on user role and permissions
 */
export const useNavigation = () => {
  const location = useLocation();
  const {
    user,
    hasRole,
    isAdmin,
    isSuperAdmin,
    canManageUsers,
    canManageGroups,
    canAccessAnalytics,
    canCreateMeetings,
    canInviteUsers,
  } = useRoleCheck();

  // Get dynamic counts for badges
  const { getUnreadNotificationsCount, getUpcomingMeetingsCount } =
    useUserStore();
  const { getSystemAlertsCount } = useAdminStore();

  // Dynamic badge counts
  const unreadNotifications = getUnreadNotificationsCount?.() || 0;
  const upcomingMeetings = getUpcomingMeetingsCount?.() || 0;
  const systemAlerts = getSystemAlertsCount?.() || 0;

  // Check if a path is currently active
  const isActivePath = useMemo(() => {
    return (path) => {
      if (path.includes("?tab=")) {
        const [basePath] = path.split("?tab=");
        return location.pathname === basePath;
      }
      return (
        location.pathname === path || location.pathname.startsWith(path + "/")
      );
    };
  }, [location.pathname]);

  // Get navigation items based on user role
  const navigationItems = useMemo(() => {
    const items = [];

    // User-level navigation
    if (hasRole("USER")) {
      items.push(
        {
          id: "dashboard",
          label: "Dashboard",
          path: "/dashboard",
          icon: "home",
          section: "main",
          badge: null,
          isActive: isActivePath("/dashboard"),
        },
        {
          id: "meetings",
          label: "My Meetings",
          path: "/dashboard?tab=meetings",
          icon: "video",
          section: "main",
          badge: upcomingMeetings > 0 ? upcomingMeetings : null,
          isActive:
            isActivePath("/dashboard") &&
            location.search.includes("tab=meetings"),
        },
        {
          id: "calendar",
          label: "Calendar",
          path: "/calendar",
          icon: "calendar",
          section: "main",
          badge: null,
          isActive: isActivePath("/calendar"),
        },
        // {
        //   id: 'history',
        //   label: 'Meeting History',
        //   path: '/dashboard?tab=history',
        //   icon: 'clock',
        //   section: 'main',
        //   badge: null,
        //   isActive: isActivePath('/dashboard') && location.search.includes('tab=history')
        // },
        {
          id: "analytics",
          label: "My Analytics",
          path: "/dashboard?tab=analytics",
          icon: "bar-chart",
          section: "main",
          badge: null,
          isActive:
            isActivePath("/dashboard") &&
            location.search.includes("tab=analytics"),
        },
      );
    }

    // Collaboration features
    if (canInviteUsers()) {
      items.push({
        id: "invite",
        label: "Invite Users",
        path: "/invite",
        icon: "user-plus",
        section: "collaboration",
        badge: null,
        isActive: isActivePath("/invite"),
      });
    }

    if (hasRole("USER")) {
      items.push(
        {
          id: "groups",
          label: "My Groups",
          path: "/groups",
          icon: "users",
          section: "collaboration",
          badge: null,
          isActive: isActivePath("/groups"),
        },
        {
          id: "messages",
          label: "Messages",
          path: "/messages",
          icon: "message-square",
          section: "collaboration",
          badge: null, // Could be dynamic based on unread messages
          isActive: isActivePath("/messages"),
        },
      );
    }

    // Admin navigation
    if (isAdmin) {
      items.push({
        id: "admin-dashboard",
        label: "Admin Dashboard",
        path: "/admin",
        icon: "shield",
        section: "admin",
        badge: systemAlerts > 0 ? systemAlerts : null,
        isActive: isActivePath("/admin"),
      });

      if (canManageUsers()) {
        items.push({
          id: "user-management",
          label: "User Management",
          path: "/admin/users",
          icon: "users",
          section: "admin",
          badge: null,
          isActive: isActivePath("/admin/users"),
        });
      }

      if (canManageGroups()) {
        items.push({
          id: "group-management",
          label: "Group Management",
          path: "/admin/groups",
          icon: "users",
          section: "admin",
          badge: null,
          isActive: isActivePath("/admin/groups"),
        });
      }

      if (canAccessAnalytics()) {
        items.push({
          id: "system-analytics",
          label: "System Analytics",
          path: "/admin/analytics",
          icon: "activity",
          section: "admin",
          badge: null,
          isActive: isActivePath("/admin/analytics"),
        });
      }

      items.push({
        id: "system-settings",
        label: "System Settings",
        path: "/admin/settings",
        icon: "settings",
        section: "admin",
        badge: null,
        isActive: isActivePath("/admin/settings"),
      });
    }

    // Super Admin
    if (isSuperAdmin) {
      items.push({
        id: "super-admin",
        label: "Super Admin",
        path: "/super-admin",
        icon: "award",
        section: "super-admin",
        badge: null,
        isActive: isActivePath("/super-admin"),
      });
    }

    // Settings and profile
    if (hasRole("USER")) {
      items.push(
        {
          id: "notifications",
          label: "Notifications",
          path: "/notifications",
          icon: "bell",
          section: "settings",
          badge: unreadNotifications > 0 ? unreadNotifications : null,
          isActive: isActivePath("/notifications"),
        },
        {
          id: "profile-settings",
          label: "Profile Settings",
          path: "/settings/profile",
          icon: "settings",
          section: "settings",
          badge: null,
          isActive: isActivePath("/settings"),
        },
      );
    }

    return items;
  }, [
    user,
    location,
    hasRole,
    isAdmin,
    isSuperAdmin,
    canManageUsers,
    canManageGroups,
    canAccessAnalytics,
    canInviteUsers,
    unreadNotifications,
    upcomingMeetings,
    systemAlerts,
    isActivePath,
  ]);

  // Group navigation items by section
  const groupedNavigation = useMemo(() => {
    return navigationItems.reduce((acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = [];
      }
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [navigationItems]);

  // Section configuration
  const sections = {
    main: {
      label: "Main",
      order: 1,
      collapsible: false,
    },
    collaboration: {
      label: "Collaboration",
      order: 2,
      collapsible: true,
    },
    admin: {
      label: "Administration",
      order: 3,
      collapsible: true,
      requiresRole: "ADMIN",
    },
    "super-admin": {
      label: "Super Admin",
      order: 4,
      collapsible: true,
      requiresRole: "SUPER_ADMIN",
    },
    settings: {
      label: "Settings",
      order: 5,
      collapsible: true,
    },
  };

  // Get breadcrumb for current path
  const getBreadcrumb = useMemo(() => {
    return () => {
      const activeItem = navigationItems.find((item) => item.isActive);
      if (!activeItem) return [];

      const breadcrumb = [];

      // Add section
      const section = sections[activeItem.section];
      if (section) {
        breadcrumb.push({
          label: section.label,
          path: null,
        });
      }

      // Add current page
      breadcrumb.push({
        label: activeItem.label,
        path: activeItem.path,
      });

      return breadcrumb;
    };
  }, [navigationItems, sections]);

  // Quick actions based on role
  const getQuickActions = useMemo(() => {
    return () => {
      const actions = [];

      if (canCreateMeetings()) {
        actions.push({
          id: "instant-meeting",
          label: "Start Instant Meeting",
          icon: "video",
          action: "start-instant-meeting",
        });

        actions.push({
          id: "schedule-meeting",
          label: "Schedule Meeting",
          icon: "calendar",
          action: "schedule-meeting",
        });
      }

      if (canInviteUsers()) {
        actions.push({
          id: "invite-user",
          label: "Invite User",
          icon: "user-plus",
          action: "invite-user",
        });
      }

      if (isAdmin) {
        actions.push({
          id: "system-overview",
          label: "System Overview",
          icon: "activity",
          action: "system-overview",
        });
      }

      return actions;
    };
  }, [canCreateMeetings, canInviteUsers, isAdmin]);

  return {
    navigationItems,
    groupedNavigation,
    sections,
    isActivePath,
    getBreadcrumb,
    getQuickActions,
    user,
    hasRole,
    isAdmin,
    isSuperAdmin,
  };
};

export default useNavigation;
