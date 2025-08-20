import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.jsx";
import { Video, VideoOff, Mic, MicOff, Phone } from "lucide-react";
import AuthWrapper from "@/components/auth/AuthWrapper.jsx";
import ProtectedRoute from "@/components/auth/ProtectedRoute.jsx";
import LoginForm from "@/components/auth/LoginForm.jsx";
import RegisterForm from "@/components/auth/RegisterForm.jsx";
import UserDashboardWithLayout from "@/pages/UserDashboardWithLayout.jsx";
import AdminDashboardPage from "@/pages/AdminDashboardPage.jsx";
import VideoConference from "@/components/meeting/VideoConference.jsx";
import UserInvitationLanding from "@/pages/UserInvitationLanding.jsx";
import VerifyEmail from "@/pages/VerifyEmail.jsx";
import CalendarPage from "@/pages/CalendarPage.jsx";
import InvitePage from "@/pages/InvitePage.jsx";
import GroupsPage from "@/pages/GroupsPage.jsx";
import MessagesPage from "@/pages/MessagesPage.jsx";
import SuperAdminPage from "@/pages/SuperAdminPage.jsx";
import EmailVerificationPending from "@/components/auth/EmailVerificationPending.jsx";
import PWAProvider from "@/components/PWAProvider.jsx";
import PWAInstallButton from "@/components/PWAInstallButton.jsx";
import GroupManagement from "@/components/admin/GroupManagement.jsx";
import UserManagement from "@/components/admin/UserManagement.jsx";
import SystemAnalytics from "@/components/admin/SystemAnalytics.jsx";
import SystemSettings from "@/components/admin/SystemSettings.jsx";
import DashboardLayout from "@/components/layout/DashboardLayout.jsx";
import { AdminOnly, UserOrHigher } from "@/components/auth/RoleBasedAccess.jsx";
import useAppStore from "@/stores/appStore.js";
import useChatStore from "@/stores/chatStore.js";

function App() {
  return (
    <PWAProvider>
      <Router>
        <AuthWrapper>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/login" />} />
            <Route
              path="/login"
              element={
                <ProtectedRoute requireAuth={false}>
                  <LoginForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute requireAuth={false}>
                  <RegisterForm />
                </ProtectedRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <UserDashboardWithLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invite"
              element={
                <ProtectedRoute>
                  <InvitePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meeting/:meetingId"
              element={
                <ProtectedRoute>
                  <VideoConference />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <DashboardLayout
                    title="Group Management"
                    subtitle="Manage user groups and permissions"
                  >
                    <GroupManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <DashboardLayout
                    title="User Management"
                    subtitle="Manage user accounts and permissions"
                  >
                    <UserManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <DashboardLayout
                    title="System Analytics"
                    subtitle="System-wide analytics and reporting"
                  >
                    <SystemAnalytics />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <DashboardLayout
                    title="System Settings"
                    subtitle="Configure system-wide settings"
                  >
                    <SystemSettings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Super Admin routes */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute requiredRole="SUPER_ADMIN">
                  <SuperAdminPage />
                </ProtectedRoute>
              }
            />

            {/* User settings routes */}
            <Route
              path="/settings/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout
                    title="Profile Settings"
                    subtitle="Manage your profile information"
                  >
                    <div className="p-6 text-center">
                      <h2 className="text-2xl font-bold mb-4 text-primary">
                        Profile Settings
                      </h2>
                      <p className="text-muted">
                        Profile settings will be implemented here.
                      </p>
                    </div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <DashboardLayout
                    title="Notifications"
                    subtitle="Manage your notification preferences"
                  >
                    <div className="p-6 text-center">
                      <h2 className="text-2xl font-bold mb-4 text-primary">Notifications</h2>
                      <p className="text-muted">
                        Notifications center will be implemented here.
                      </p>
                    </div>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Guest-allowed meeting routes */}
            <Route
              path="/meeting/:meetingId/join"
              element={
                <ProtectedRoute allowGuest={true}>
                  <VideoConference allowGuest={true} />
                </ProtectedRoute>
              }
            />

            {/* Email verification routes */}
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/email-verification-pending"
              element={<EmailVerificationPending />}
            />

            {/* Other routes */}
            <Route
              path="/user-invitation/:token"
              element={<UserInvitationLanding />}
            />
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">
                      404 - Page Not Found
                    </h1>
                    <p className="text-muted mt-2">
                      The page you're looking for doesn't exist.
                    </p>
                  </div>
                </div>
              }
            />
          </Routes>
          <PWAInstallButton />
        </AuthWrapper>
      </Router>
    </PWAProvider>
  );
}

export default App;
