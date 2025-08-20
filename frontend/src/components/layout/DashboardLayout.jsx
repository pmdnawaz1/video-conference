import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import NavigationMenu from "../navigation/NavigationMenu";
import { Button } from "../ui/button";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useRoleCheck } from "../auth/RoleBasedAccess";

/**
 * Dashboard Layout with role-based navigation
 * Provides consistent layout structure for authenticated pages
 */
const DashboardLayout = ({
  children,
  title,
  subtitle,
  headerActions = null,
  showSidebar = true,
  variant = "sidebar", // 'sidebar' or 'header'
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const { user, isAdmin } = useRoleCheck();

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-collapse sidebar on mobile navigation
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname, isMobile]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Header-only layout
  if (variant === "header" || !showSidebar) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationMenu variant="header" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {(title || subtitle || headerActions) && (
            <div className="mb-8">
              {title && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="text-muted-foreground mt-1">{subtitle}</p>
                    )}
                  </div>
                  {headerActions && (
                    <div className="mt-4 sm:mt-0 sm:ml-4">{headerActions}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    );
  }

  // Sidebar layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {showSidebar && (
        <>
          {/* Sidebar Overlay for Mobile */}
          {!isSidebarCollapsed && isMobile && (
            <div
              className="fixed inset-0 bg-black/20 z-40 lg:hidden"
              onClick={() => setIsSidebarCollapsed(true)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`
            fixed left-0 top-0 h-full z-50 lg:relative lg:z-auto
            transition-transform duration-300 ease-in-out
            ${isSidebarCollapsed && isMobile ? "-translate-x-full" : "translate-x-0"}
          `}
          >
            <NavigationMenu
              variant="sidebar"
              isCollapsed={isSidebarCollapsed && !isMobile}
              onToggleCollapse={handleToggleSidebar}
              className="h-full"
            />
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Page Header */}
        <div className="bg-card border-b border-border">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Sidebar Toggle Button */}
                {showSidebar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleSidebar}
                    className={`${isMobile ? "lg:hidden" : ""}`}
                  >
                    {isSidebarCollapsed ? (
                      <FiChevronRight className="w-4 h-4" />
                    ) : (
                      <FiChevronLeft className="w-4 h-4" />
                    )}
                  </Button>
                )}

                {/* Page Title */}
                <div>
                  {title && (
                    <h1 className="text-xl font-semibold text-foreground">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                  )}
                </div>
              </div>

              {/* Header Actions */}
              {headerActions && (
                <div className="flex items-center space-x-2">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

/**
 * Higher-order component for wrapping pages with dashboard layout
 */
export const withDashboardLayout = (Component, layoutProps = {}) => {
  const WrappedComponent = (props) => (
    <DashboardLayout {...layoutProps}>
      <Component {...props} />
    </DashboardLayout>
  );

  WrappedComponent.displayName = `withDashboardLayout(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export default DashboardLayout;
