import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiHome,
  FiVideo,
  FiUsers,
  FiBarChart,
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiShield,
  FiUserPlus,
  FiCalendar,
  FiActivity,
  FiClock,
  FiMessageSquare,
  FiAward,
  FiBell,
} from "react-icons/fi";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import useAuthStore from "../../stores/authStore";
import { useRoleCheck } from "../auth/RoleBasedAccess";

/**
 * Main navigation menu with role-based access control
 * Supports both sidebar and mobile navigation layouts
 */
const NavigationMenu = ({
  variant = "sidebar", // 'sidebar', 'header', 'mobile'
  showLabels = true,
  isCollapsed = false,
  onToggleCollapse = () => {},
  className = "",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const {
    hasRole,
    isAdmin,
    isSuperAdmin,
    canManageUsers,
    canManageGroups,
    canAccessAnalytics,
    canCreateMeetings,
    canInviteUsers,
  } = useRoleCheck();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navigation items restructured per specifications
  const getNavigationItems = () => {
    const userRole = user?.role;

    if (userRole === "SUPER_ADMIN") {
      return [
        {
          id: "admin-dashboard",
          label: "Admin Dashboard",
          icon: FiShield,
          path: "/admin",
          section: "admin",
        },
        {
          id: "system-analytics",
          label: "System Analytics",
          icon: FiActivity,
          path: "/admin/analytics",
          section: "admin",
        },
        {
          id: "user-management",
          label: "Add Admins",
          icon: FiUserPlus,
          path: "/admin/users",
          section: "admin",
        },
      ];
    }

    if (userRole === "ADMIN") {
      return [
        {
          id: "user-management",
          label: "User Management",
          icon: FiUsers,
          path: "/admin/users",
          section: "admin",
        },
        {
          id: "group-management",
          label: "Group Management",
          icon: FiUsers,
          path: "/admin/groups",
          section: "admin",
        },
        {
          id: "messages",
          label: "Messages",
          icon: FiMessageSquare,
          path: "/messages",
          section: "main",
        },
        {
          id: "meetings",
          label: "Meetings",
          icon: FiVideo,
          path: "/dashboard?tab=meetings",
          section: "main",
        },
        // {
        //   id: 'history',
        //   label: 'Meeting History',
        //   icon: FiClock,
        //   path: '/dashboard?tab=history',
        //   section: 'main'
        // },
        {
          id: "calendar",
          label: "Calendar",
          icon: FiCalendar,
          path: "/calendar",
          section: "main",
        },
      ];
    }

    // USER role
    return [
      {
        id: "messages",
        label: "Messages",
        icon: FiMessageSquare,
        path: "/messages",
        section: "main",
      },
      {
        id: "meetings",
        label: "Meetings",
        icon: FiVideo,
        path: "/dashboard?tab=meetings",
        section: "main",
      },
      {
        id: "history",
        label: "Meeting History",
        icon: FiClock,
        path: "/dashboard?tab=history",
        section: "main",
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: FiCalendar,
        path: "/calendar",
        section: "main",
      },
    ];
  };

  const navigationItems = getNavigationItems();

  // Navigation items are already filtered by role in getNavigationItems()
  const filteredNavItems = navigationItems;

  // Group items by section
  const groupedNavItems = filteredNavItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

  const handleNavigation = (path, itemId) => {
    navigate(path);
    if (variant === "mobile") {
      setIsMobileMenuOpen(false);
    }

    // Handle special cases for dashboard tabs
    if (path.includes("?tab=")) {
      const [basePath, tab] = path.split("?tab=");
      navigate(basePath, { state: { activeTab: tab } });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActiveRoute = (path) => {
    if (path.includes("?tab=")) {
      const [basePath] = path.split("?tab=");
      return location.pathname === basePath;
    }
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  // Section headers
  const sectionHeaders = {
    main: "Main",
    collaboration: "Collaboration",
    admin: "Administration",
    "super-admin": "Super Admin",
    settings: "Settings",
  };

  // Navigation Item Component
  const NavItem = ({ item, isCollapsed = false }) => {
    const Icon = item.icon;
    const isActive = isActiveRoute(item.path);

    return (
      <button
        onClick={() => handleNavigation(item.path, item.id)}
        className={`
          w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
          ${
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }
          ${isCollapsed ? "justify-center px-2" : ""}
        `}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon
          className={`${isCollapsed ? "w-5 h-5" : "w-4 h-4"} flex-shrink-0`}
        />
        {!isCollapsed && showLabels && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </button>
    );
  };

  // Mobile Toggle Button
  const MobileToggle = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="lg:hidden"
    >
      {isMobileMenuOpen ? (
        <FiX className="w-5 h-5" />
      ) : (
        <FiMenu className="w-5 h-5" />
      )}
    </Button>
  );

  // Sidebar Variant
  if (variant === "sidebar") {
    return (
      <div
        className={`bg-card border-r border-border transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        } ${className}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b border-border ${isCollapsed ? "px-2" : ""}`}
        >
          {!isCollapsed ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground truncate">
                Video Platform
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <Badge variant="outline" className="text-xs mt-1">
                {user?.role}
              </Badge>
            </div>
          ) : (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <FiVideo className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {Object.entries(groupedNavItems).map(([section, items]) => (
            <div key={section}>
              {!isCollapsed && sectionHeaders[section] && (
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  {sectionHeaders[section]}
                </h3>
              )}
              <div
                className={`space-y-1 ${isCollapsed && section !== "main" ? "border-t pt-2" : ""}`}
              >
                {items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`w-full justify-start text-muted-foreground hover:text-foreground ${
              isCollapsed ? "px-2 justify-center" : ""
            }`}
            title={isCollapsed ? "Logout" : undefined}
          >
            <FiLogOut
              className={`${isCollapsed ? "w-5 h-5" : "w-4 h-4 mr-3"}`}
            />
            {!isCollapsed && "Logout"}
          </Button>

          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
            >
              <FiMenu className="w-4 h-4 mr-3" />
              Collapse
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Header Variant
  if (variant === "header") {
    return (
      <header className={`bg-card border-b border-border ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <FiVideo className="w-8 h-8 text-primary" />
                <span className="text-xl font-bold text-foreground hidden sm:block">
                  Video Platform
                </span>
              </div>

              <nav className="hidden lg:flex items-center space-x-1">
                {groupedNavItems.main?.map((item) => (
                  <NavItem key={item.id} item={item} />
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.role}</p>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <FiLogOut className="w-4 h-4" />
              </Button>

              <MobileToggle />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-card border-t border-border">
            <div className="px-4 py-4 space-y-4">
              {Object.entries(groupedNavItems).map(([section, items]) => (
                <div key={section}>
                  {sectionHeaders[section] && (
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {sectionHeaders[section]}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {items.map((item) => (
                      <NavItem key={item.id} item={item} />
                    ))}
                  </div>
                  {section !== "settings" && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
    );
  }

  // Mobile Variant (drawer/overlay)
  if (variant === "mobile") {
    return (
      <>
        <MobileToggle />
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/20"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-80 bg-card shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Navigation</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FiX className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                {Object.entries(groupedNavItems).map(([section, items]) => (
                  <div key={section}>
                    {sectionHeaders[section] && (
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {sectionHeaders[section]}
                      </h3>
                    )}
                    <div className="space-y-1">
                      {items.map((item) => (
                        <NavItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                >
                  <FiLogOut className="w-4 h-4 mr-3" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export default NavigationMenu;
