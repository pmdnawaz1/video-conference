import { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Video, VideoOff, Mic, MicOff, Phone } from 'lucide-react'
import ChatInterface from '@/components/chat/ChatInterface.jsx'
import AuthWrapper from '@/components/auth/AuthWrapper.jsx'
import LoginForm from '@/components/auth/LoginForm.jsx'
import RegisterForm from '@/components/auth/RegisterForm.jsx'
import UserDashboard from '@/pages/UserDashboard.jsx'
import VideoConference from '@/components/meeting/VideoConference.jsx'
import UserInvitationLanding from '@/pages/UserInvitationLanding.jsx'
import PWAProvider from '@/components/PWAProvider.jsx'
import PWAInstallButton from '@/components/PWAInstallButton.jsx'
import useAppStore from '@/stores/appStore.js'
import useChatStore from '@/stores/chatStore.js'


function App() {
  return (
    <PWAProvider>
      <Router>
        <AuthWrapper>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/meeting/:meetingId" element={<VideoConference />} />
            <Route path="/meeting/:meetingId/join" element={<VideoConference allowGuest={true} />} />
            <Route path="/user-invitation/:token" element={<UserInvitationLanding />} />
            {/* Add other routes here */}
            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
          <PWAInstallButton />
        </AuthWrapper>
      </Router>
    </PWAProvider>
  );
}

export default App