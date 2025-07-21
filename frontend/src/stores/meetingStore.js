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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ meetings: result.data });
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(meetingData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Add new meeting to the list
        set((state) => ({
          meetings: [result.data, ...state.meetings]
        }));
        return { success: true, meeting: result.data };
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings/${meetingId}`, {
        method: 'PUT',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(updateData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Update meeting in the list
        set((state) => ({
          meetings: state.meetings.map(m => 
            m.id === meetingId ? result.data : m
          ),
          currentMeeting: state.currentMeeting?.id === meetingId ? result.data : state.currentMeeting
        }));
        return { success: true, meeting: result.data };
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings/${meetingId}/start`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, data: result.data };
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, data: result.data };
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/meetings/${meetingId}`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ currentMeeting: result.data });
        return { success: true, meeting: result.data };
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
  }
}));

export default useMeetingStore;