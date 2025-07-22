import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import VideoConference from './components/meeting/VideoConference.jsx'
import MeetingDashboard from './components/meetings/MeetingDashboard.jsx'
import AuthWrapper from './components/auth/AuthWrapper.jsx'
import useAuthStore from './stores/authStore'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <AuthWrapper />;
  }
  
  return children;
}

createRoot(document.getElementById('root')).render(
  // Temporarily disable StrictMode to fix double WebSocket connections
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthWrapper />} />
        <Route path="/login" element={<AuthWrapper />} />
        <Route path="/register" element={<AuthWrapper />} />
        <Route path="/join" element={<AuthWrapper />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <MeetingDashboard />
          </ProtectedRoute>
        } />
        <Route path="/meeting/:meetingId" element={
          <ProtectedRoute>
            <VideoConference />
          </ProtectedRoute>
        } />
        <Route path="/meeting/:meetingId/join" element={<VideoConference allowGuest={true} />} />
        <Route path="/room/:roomId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>,
)
