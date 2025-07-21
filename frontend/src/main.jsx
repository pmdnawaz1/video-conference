import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import VideoConference from './components/meeting/VideoConference.jsx'
import MeetingDashboard from './components/meetings/MeetingDashboard.jsx'
import AuthWrapper from './components/auth/AuthWrapper.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthWrapper />} />
        <Route path="/login" element={<AuthWrapper />} />
        <Route path="/register" element={<AuthWrapper />} />
        <Route path="/join" element={<AuthWrapper />} />
        <Route path="/dashboard" element={<MeetingDashboard />} />
        <Route path="/meeting/:meetingId" element={<VideoConference />} />
        <Route path="/room/:roomId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
