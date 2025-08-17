import { create } from 'zustand';
import useAuthStore from './authStore';

const useMeetingStore = create((set, get) => ({
  // Meeting state
  meetings: [],
  currentMeeting: null,
  isLoading: false,
  error: null,
  
  // Meeting creation/editing state
  isCreating: false,
  isUpdating: false,
  
  // Real-time meeting state
  participants: [],
  localStream: null,
  remoteStreams: new Map(),
  isConnected: false,
  connectionState: 'disconnected',
  
  // Meeting controls state
  isMuted: true,
  isVideoOn: false,
  isScreenSharing: false,
  isRecording: false,
  isHandRaised: false,
  
  // Meeting settings
  meetingSettings: {
    isLocked: false,
    allowChat: true,
    allowScreenShare: true,
    requirePermission: true,
    waitingRoomEnabled: false,
    recordingEnabled: false
  },
  
  // Permission states
  permissions: {
    audio: 'granted',
    video: 'granted',
    screenShare: 'pending'
  },
  
  // Chat state
  chatMessages: [],
  unreadCount: 0,
  
  // Waiting room
  waitingParticipants: [],
  
  // Admin controls
  isAdmin: false,
  adminNotifications: [],
  
  // WebSocket connection
  wsConnection: null,
  wsConnected: false,
  
  // Actions
  setMeetings: (meetings) => {
    set({ meetings });
  },
  
  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },
  
  setLoading: (isLoading) => {
    set({ isLoading });
  },
  
  setError: (error) => {
    set({ error });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  // API calls with authentication
  getAuthHeaders: () => {
    const { accessToken } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  },
  
  fetchMeetings: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ meetings: result.meetings || [] });
        return { success: true };
      } else {
        set({ error: result.error || 'Failed to fetch meetings' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  createMeeting: async (meetingData) => {
    set({ isCreating: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(meetingData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Add new meeting to the list
        set((state) => ({
          meetings: [result.meeting, ...state.meetings]
        }));
        return { success: true, meeting: result.meeting };
      } else {
        set({ error: result.error || 'Failed to create meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isCreating: false });
    }
  },
  
  updateMeeting: async (meetingId, updateData) => {
    set({ isUpdating: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/${meetingId}`, {
        method: 'PUT',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(updateData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Update meeting in the list
        set((state) => ({
          meetings: state.meetings.map(m => 
            m.id === meetingId ? result.meeting : m
          ),
          currentMeeting: state.currentMeeting?.id === meetingId ? result.meeting : state.currentMeeting
        }));
        return { success: true, meeting: result.meeting };
      } else {
        set({ error: result.error || 'Failed to update meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isUpdating: false });
    }
  },
  
  startMeeting: async (meetingId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/${meetingId}/start`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, data: result.meeting };
      } else {
        set({ error: result.error || 'Failed to start meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  endMeeting: async (meetingId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, data: result.meeting };
      } else {
        set({ error: result.error || 'Failed to end meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  getMeeting: async (meetingId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/${meetingId}`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ currentMeeting: result.meeting });
        return { success: true, meeting: result.meeting };
      } else {
        set({ error: result.error || 'Failed to get meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - please check backend connection';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Helper functions
  getUpcomingMeetings: () => {
    const { meetings } = get();
    const now = new Date();
    return meetings.filter(meeting => 
      new Date(meeting.scheduled_start) > now && meeting.status === 'scheduled'
    );
  },
  
  getActiveMeetings: () => {
    const { meetings } = get();
    return meetings.filter(meeting => meeting.status === 'active');
  },
  
  getPastMeetings: () => {
    const { meetings } = get();
    const now = new Date();
    return meetings.filter(meeting => 
      new Date(meeting.scheduled_end) < now || meeting.status === 'ended'
    );
  },
  
  // Real-time meeting actions
  setParticipants: (participants) => {
    set({ participants });
  },
  
  addParticipant: (participant) => {
    set((state) => ({
      participants: [...state.participants, participant]
    }));
  },
  
  removeParticipant: (participantId) => {
    set((state) => ({
      participants: state.participants.filter(p => p.id !== participantId)
    }));
  },
  
  updateParticipant: (participantId, updates) => {
    set((state) => ({
      participants: state.participants.map(p => 
        p.id === participantId ? { ...p, ...updates } : p
      )
    }));
  },
  
  // Meeting controls
  toggleMute: () => {
    const currentState = get().isMuted;
    set({ isMuted: !currentState });
    return !currentState;
  },
  
  toggleVideo: () => {
    const currentState = get().isVideoOn;
    set({ isVideoOn: !currentState });
    return !currentState;
  },
  
  toggleScreenShare: () => {
    const currentState = get().isScreenSharing;
    set({ isScreenSharing: !currentState });
    return !currentState;
  },
  
  toggleHandRaise: () => {
    const currentState = get().isHandRaised;
    set({ isHandRaised: !currentState });
    return !currentState;
  },
  
  // Meeting settings
  updateMeetingSettings: (settings) => {
    set((state) => ({
      meetingSettings: { ...state.meetingSettings, ...settings }
    }));
  },
  
  // Permission management
  updatePermissions: (permissions) => {
    set((state) => ({
      permissions: { ...state.permissions, ...permissions }
    }));
  },
  
  requestPermission: (type) => {
    set((state) => ({
      permissions: { ...state.permissions, [type]: 'pending' }
    }));
  },
  
  grantPermission: (type) => {
    set((state) => ({
      permissions: { ...state.permissions, [type]: 'granted' }
    }));
  },
  
  denyPermission: (type) => {
    set((state) => ({
      permissions: { ...state.permissions, [type]: 'denied' }
    }));
  },
  
  // Chat management
  addChatMessage: (message) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, { ...message, timestamp: new Date() }],
      unreadCount: state.unreadCount + 1
    }));
  },
  
  clearUnreadCount: () => {
    set({ unreadCount: 0 });
  },
  
  // Waiting room management
  addToWaitingRoom: (participant) => {
    set((state) => ({
      waitingParticipants: [...state.waitingParticipants, participant]
    }));
  },
  
  removeFromWaitingRoom: (participantId) => {
    set((state) => ({
      waitingParticipants: state.waitingParticipants.filter(p => p.id !== participantId)
    }));
  },
  
  admitFromWaitingRoom: (participantId) => {
    const participant = get().waitingParticipants.find(p => p.id === participantId);
    if (participant) {
      get().removeFromWaitingRoom(participantId);
      get().addParticipant(participant);
    }
  },
  
  // Admin controls
  setIsAdmin: (isAdmin) => {
    set({ isAdmin });
  },
  
  addAdminNotification: (notification) => {
    set((state) => ({
      adminNotifications: [...state.adminNotifications, {
        ...notification,
        id: Date.now() + Math.random(),
        timestamp: new Date()
      }]
    }));
  },
  
  removeAdminNotification: (notificationId) => {
    set((state) => ({
      adminNotifications: state.adminNotifications.filter(n => n.id !== notificationId)
    }));
  },
  
  clearAdminNotifications: () => {
    set({ adminNotifications: [] });
  },
  
  // WebSocket connection management
  setWsConnection: (connection) => {
    set({ wsConnection: connection });
  },
  
  setWsConnected: (connected) => {
    set({ wsConnected: connected });
  },
  
  sendMessage: (message) => {
    const { wsConnection, wsConnected } = get();
    if (wsConnection && wsConnected) {
      wsConnection.send(JSON.stringify(message));
      return true;
    }
    return false;
  },
  
  // Media stream management
  setLocalStream: (stream) => {
    set({ localStream: stream });
  },
  
  addRemoteStream: (participantId, stream) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.set(participantId, stream);
      return { remoteStreams: newStreams };
    });
  },
  
  removeRemoteStream: (participantId) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.delete(participantId);
      return { remoteStreams: newStreams };
    });
  },
  
  // Connection state management
  setConnectionState: (state) => {
    set({ connectionState: state, isConnected: state === 'connected' });
  },
  
  // Reset meeting state
  resetMeetingState: () => {
    set({
      participants: [],
      localStream: null,
      remoteStreams: new Map(),
      isConnected: false,
      connectionState: 'disconnected',
      isMuted: true,
      isVideoOn: false,
      isScreenSharing: false,
      isRecording: false,
      isHandRaised: false,
      chatMessages: [],
      unreadCount: 0,
      waitingParticipants: [],
      adminNotifications: [],
      wsConnection: null,
      wsConnected: false
    });
  },
  
  // Utility functions
  getParticipantById: (participantId) => {
    return get().participants.find(p => p.id === participantId);
  },
  
  getActiveParticipants: () => {
    return get().participants.filter(p => p.status === 'connected');
  },
  
  getSpeakingParticipants: () => {
    return get().participants.filter(p => p.isSpeaking);
  },
  
  getHandRaisedParticipants: () => {
    return get().participants.filter(p => p.handRaised).sort((a, b) => 
      new Date(a.handRaisedAt) - new Date(b.handRaisedAt)
    );
  },
  
  getPermissionStatus: (type) => {
    return get().permissions[type] || 'denied';
  },
  
  hasPermission: (type) => {
    return get().permissions[type] === 'granted';
  },
  
  isPendingPermission: (type) => {
    return get().permissions[type] === 'pending';
  }
}));

export default useMeetingStore;