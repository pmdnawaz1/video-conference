import React from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import AdminDashboard from "../components/admin/AdminDashboard";
import { AdminOnly } from "../components/auth/RoleBasedAccess";

const AdminDashboardPage = () => {
  return (
    <AdminOnly
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              Access Denied
            </h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      }
    >
      <DashboardLayout
        title="Admin Dashboard"
        subtitle="Manage users, meetings, and system settings"
      >
        <AdminDashboard />
      </DashboardLayout>
    </AdminOnly>
  );
};

export default AdminDashboardPage;
