import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiChevronRight, FiHome } from "react-icons/fi";
import useNavigation from "../../hooks/useNavigation";

/**
 * Breadcrumb navigation component with role-based awareness
 */
const Breadcrumb = ({ className = "", showHome = true }) => {
  const location = useLocation();
  const { getBreadcrumb } = useNavigation();

  const breadcrumbItems = getBreadcrumb();

  // Don't show breadcrumb if there's only one item or empty
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav
      className={`flex items-center space-x-1 text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {showHome && (
        <>
          <Link
            to="/dashboard"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Home"
          >
            <FiHome className="w-4 h-4" />
          </Link>
          <FiChevronRight className="w-4 h-4 text-muted-foreground" />
        </>
      )}

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;

        return (
          <React.Fragment key={item.label}>
            {item.path ? (
              <Link
                to={item.path}
                className={`transition-colors ${
                  isLast
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`${
                  isLast
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <FiChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
