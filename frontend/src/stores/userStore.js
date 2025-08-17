import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useAuthStore from './authStore';

const useUserStore = create(
  persist(
    (set, get) => ({
      // User profile data
      profile: null,
      preferences: {
        notifications: {
          email: true,
          browser: true,
          mobile: true,
          meetingReminders: true,
          meetingInvites: true,
          chatMessages: true,
          systemUpdates: false
        },
        meeting: {
          defaultAudio: true,
          defaultVideo: false,
          autoJoin: false,
          backgroundBlur: false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          joinEarlyMinutes: 5
        },
        privacy: {
          showOnlineStatus: true,
          allowDirectMessages: true,
          shareParticipationStats: true,
          dataCollection: false
        }
      },
      
      // User analytics and engagement
      analytics: {
        totalMeetings: 0,
        totalMinutes: 0,
        averageParticipation: 0,
        engagementScore: 0,
        lastActivity: null,
        weeklyStats: {},
        monthlyStats: {},
        participationTrends: []
      },
      
      // Meeting history and bookmarks
      meetingHistory: [],
      bookmarkedMoments: [],
      savedRecordings: [],
      sharedResources: [],
      
      // User dashboard data
      dashboardData: {
        upcomingMeetings: [],
        todaysMeetings: [],
        recentActivity: [],
        notifications: [],
        quickStats: null
      },
      
      // Social features
      contacts: [],
      recentContacts: [],
      blockedUsers: [],
      
      // Device and connectivity
      devicePreferences: {
        camera: null,
        microphone: null,
        speaker: null,
        bandwidth: 'auto',
        quality: 'auto'
      },
      
      // Learning and onboarding
      onboardingStatus: {
        profileCompleted: false,
        firstMeetingJoined: false,
        featuresIntroduced: [],
        helpSeen: false
      },
      
      // Loading states
      isLoading: false,
      isDashboardLoading: false,
      isAnalyticsLoading: false,
      isHistoryLoading: false,
      isProfileUpdating: false,
      
      // Error states
      error: null,
      dashboardError: null,
      analyticsError: null,
      historyError: null,
      profileError: null,
      
      // Helper function for authenticated requests
      getAuthHeaders: () => {
        const { accessToken } = useAuthStore.getState();
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        };
      },
      
      // Profile management
      updateProfile: async (profileData) => {
        set({ isProfileUpdating: true, profileError: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
            method: 'PUT',
            headers: get().getAuthHeaders(),
            body: JSON.stringify(profileData),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set({ profile: result.user || result.data });
            return { success: true };
          } else {
            set({ profileError: result.error || 'Failed to update profile' });
            return { success: false, error: result.error };
          }
        } catch (error) {
          const errorMessage = 'Network error - profile update failed';
          set({ profileError: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isProfileUpdating: false });
        }
      },
      
      // Preferences management
      updatePreferences: async (preferences) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/preferences`, {
            method: 'PUT',
            headers: get().getAuthHeaders(),
            body: JSON.stringify(preferences),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set((state) => ({
              preferences: { ...state.preferences, ...preferences }
            }));
            return { success: true };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },
      
      // Dashboard data fetching
      fetchDashboardData: async () => {
        set({ isDashboardLoading: true, dashboardError: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/dashboard`, {
            headers: get().getAuthHeaders(),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set({ dashboardData: result.dashboard || result.data });
            return { success: true };
          } else {
            set({ dashboardError: result.error || 'Failed to fetch dashboard data' });
            return { success: false, error: result.error };
          }
        } catch (error) {
          const errorMessage = 'Network error - dashboard unavailable';
          set({ dashboardError: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isDashboardLoading: false });
        }
      },
      
      // Analytics data fetching
      fetchAnalytics: async (timeframe = 'month') => {
        set({ isAnalyticsLoading: true, analyticsError: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/analytics?timeframe=${timeframe}`, {
            headers: get().getAuthHeaders(),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set({ analytics: result.analytics || result.data });
            return { success: true };
          } else {
            set({ analyticsError: result.error || 'Failed to fetch analytics' });
            return { success: false, error: result.error };
          }
        } catch (error) {
          const errorMessage = 'Network error - analytics unavailable';
          set({ analyticsError: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isAnalyticsLoading: false });
        }
      },
      
      // Meeting history management
      fetchMeetingHistory: async (page = 1, limit = 20, filters = {}) => {
        set({ isHistoryLoading: true, historyError: null });
        
        try {
          const queryParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...filters
          });
          
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/meetings/history?${queryParams}`, {
            headers: get().getAuthHeaders(),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            const meetings = result.meetings || result.data?.meetings || [];
            if (page === 1) {
              set({ meetingHistory: meetings });
            } else {
              set((state) => ({
                meetingHistory: [...state.meetingHistory, ...meetings]
              }));
            }
            return { success: true, hasMore: result.hasMore || result.data?.hasMore || false };
          } else {
            set({ historyError: result.error || 'Failed to fetch meeting history' });
            return { success: false, error: result.error };
          }
        } catch (error) {
          const errorMessage = 'Network error - history unavailable';
          set({ historyError: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isHistoryLoading: false });
        }
      },
      
      // Bookmarks management
      bookmarkMoment: async (meetingId, timestamp, note = '') => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/bookmarks`, {
            method: 'POST',
            headers: get().getAuthHeaders(),
            body: JSON.stringify({
              meeting_id: meetingId,
              timestamp,
              note
            }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set((state) => ({
              bookmarkedMoments: [result.data, ...state.bookmarkedMoments]
            }));
            return { success: true, bookmark: result.data };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },
      
      removeBookmark: async (bookmarkId) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/bookmarks/${bookmarkId}`, {
            method: 'DELETE',
            headers: get().getAuthHeaders(),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set((state) => ({
              bookmarkedMoments: state.bookmarkedMoments.filter(b => b.id !== bookmarkId)
            }));
            return { success: true };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },
      
      // Contacts management
      addContact: async (userId) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/contacts`, {
            method: 'POST',
            headers: get().getAuthHeaders(),
            body: JSON.stringify({ user_id: userId }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set((state) => ({
              contacts: [result.data, ...state.contacts]
            }));
            return { success: true, contact: result.data };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },
      
      removeContact: async (contactId) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/contacts/${contactId}`, {
            method: 'DELETE',
            headers: get().getAuthHeaders(),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set((state) => ({
              contacts: state.contacts.filter(c => c.id !== contactId)
            }));
            return { success: true };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: 'Network error' };
        }
      },
      
      // Onboarding management
      completeOnboardingStep: (step) => {
        set((state) => {
          const newStatus = { ...state.onboardingStatus };
          if (step === 'profile') {
            newStatus.profileCompleted = true;
          } else if (step === 'firstMeeting') {
            newStatus.firstMeetingJoined = true;
          } else if (step === 'help') {
            newStatus.helpSeen = true;
          }
          return { onboardingStatus: newStatus };
        });
      },
      
      markFeatureIntroduced: (feature) => {
        set((state) => ({
          onboardingStatus: {
            ...state.onboardingStatus,
            featuresIntroduced: [...state.onboardingStatus.featuresIntroduced, feature]
          }
        }));
      },
      
      // Device preferences
      updateDevicePreferences: (devices) => {
        set((state) => ({
          devicePreferences: { ...state.devicePreferences, ...devices }
        }));
      },
      
      // Error management
      setError: (error, type = 'error') => {
        set({ [type]: error });
      },
      
      clearError: (type = 'error') => {
        set({ [type]: null });
      },
      
      clearAllErrors: () => {
        set({
          error: null,
          dashboardError: null,
          analyticsError: null,
          historyError: null,
          profileError: null
        });
      },
      
      // Utility functions
      getEngagementLevel: () => {
        const { engagementScore } = get().analytics;
        if (engagementScore >= 80) return 'high';
        if (engagementScore >= 60) return 'medium';
        if (engagementScore >= 40) return 'low';
        return 'very-low';
      },
      
      getParticipationTrend: () => {
        const { participationTrends } = get().analytics;
        if (participationTrends.length < 2) return 'stable';
        
        const recent = participationTrends.slice(-2);
        const change = recent[1].value - recent[0].value;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
      },
      
      getTodaysMeetingsCount: () => {
        return get().dashboardData.todaysMeetings?.length || 0;
      },
      
      getUpcomingMeetingsCount: () => {
        return get().dashboardData.upcomingMeetings?.length || 0;
      },
      
      getUnreadNotificationsCount: () => {
        return get().dashboardData.notifications?.filter(n => !n.read).length || 0;
      },
      
      isOnboardingComplete: () => {
        const { onboardingStatus } = get();
        return onboardingStatus.profileCompleted && 
               onboardingStatus.firstMeetingJoined && 
               onboardingStatus.helpSeen;
      },
      
      hasFeatureBeenIntroduced: (feature) => {
        return get().onboardingStatus.featuresIntroduced.includes(feature);
      },
      
      // Reset user data (logout cleanup)
      resetUserData: () => {
        set({
          profile: null,
          analytics: {
            totalMeetings: 0,
            totalMinutes: 0,
            averageParticipation: 0,
            engagementScore: 0,
            lastActivity: null,
            weeklyStats: {},
            monthlyStats: {},
            participationTrends: []
          },
          meetingHistory: [],
          bookmarkedMoments: [],
          savedRecordings: [],
          sharedResources: [],
          dashboardData: {
            upcomingMeetings: [],
            todaysMeetings: [],
            recentActivity: [],
            notifications: [],
            quickStats: null
          },
          contacts: [],
          recentContacts: [],
          error: null,
          dashboardError: null,
          analyticsError: null,
          historyError: null,
          profileError: null
        });
      }
    }),
    {
      name: 'enterprise-user',
      partialize: (state) => ({
        preferences: state.preferences,
        devicePreferences: state.devicePreferences,
        onboardingStatus: state.onboardingStatus,
        recentContacts: state.recentContacts.slice(0, 10),
        bookmarkedMoments: state.bookmarkedMoments
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.isDashboardLoading = false;
          state.isAnalyticsLoading = false;
          state.isHistoryLoading = false;
          state.isProfileUpdating = false;
          state.error = null;
          state.dashboardError = null;
          state.analyticsError = null;
          state.historyError = null;
          state.profileError = null;
        }
      }
    }
  )
);

export default useUserStore;