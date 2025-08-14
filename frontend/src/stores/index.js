// Central export for all Zustand stores
export { default as useAuthStore } from './authStore';
export { default as useMeetingStore } from './meetingStore';
export { default as useAdminStore } from './adminStore';
export { default as useUIStore } from './uiStore';
export { default as useUserStore } from './userStore';

// Store initialization and synchronization utilities
import useAuthStore from './authStore';
import useMeetingStore from './meetingStore';
import useAdminStore from './adminStore';
import useUIStore from './uiStore';
import useUserStore from './userStore';

// Initialize stores on app startup
export const initializeStores = async () => {
  // Initialize UI from system preferences
  const uiStore = useUIStore.getState();
  if (uiStore.initializeFromSystem) {
    uiStore.initializeFromSystem();
  }
  
  // Check authentication status and refresh if needed
  const authStore = useAuthStore.getState();
  if (authStore.isAuthenticated && authStore.refreshToken) {
    try {
      await authStore.refreshAccessToken();
    } catch (error) {
      console.warn('Failed to refresh token on startup:', error);
    }
  }
  
  // Load user dashboard data if authenticated
  if (authStore.isAuthenticated) {
    const userStore = useUserStore.getState();
    try {
      await userStore.fetchDashboardData();
    } catch (error) {
      console.warn('Failed to load dashboard data on startup:', error);
    }
  }
};

// Cleanup stores on logout
export const cleanupStores = () => {
  const meetingStore = useMeetingStore.getState();
  const userStore = useUserStore.getState();
  const adminStore = useAdminStore.getState();
  const uiStore = useUIStore.getState();
  
  // Reset meeting state
  meetingStore.resetMeetingState();
  
  // Reset user data
  userStore.resetUserData();
  
  // Clear admin data (preserve state structure)
  adminStore.setDashboardData({
    overview: null,
    meetingStats: null,
    recentMeetings: [],
    upcomingMeetings: [],
    userGroups: [],
    systemMetrics: null
  });
  adminStore.setOrganizations([]);
  adminStore.setCurrentOrganization(null);
  adminStore.setAdmins([]);
  adminStore.setUsers([]);
  adminStore.clearError('error');
  adminStore.clearError('dashboardError');
  adminStore.clearError('organizationError');
  adminStore.clearError('usersError');
  adminStore.clearError('adminsError');
  
  // Clear UI modals and errors
  uiStore.closeAllModals();
  uiStore.clearAllErrors();
  uiStore.clearAllToasts();
};

// Store synchronization utilities
export const syncStores = {
  // Sync user authentication across stores
  syncAuth: (authData) => {
    const { user, isAuthenticated } = authData;
    
    if (!isAuthenticated) {
      cleanupStores();
      return;
    }
    
    // Update admin status in meeting store
    const meetingStore = useMeetingStore.getState();
    meetingStore.setIsAdmin(user?.role === 'admin' || user?.role === 'super_admin');
    
    // Update user profile in user store
    const userStore = useUserStore.getState();
    if (user && user !== userStore.profile) {
      userStore.updateProfile(user);
    }
  },
  
  // Sync meeting state across relevant stores
  syncMeeting: (meetingData) => {
    const { currentMeeting } = meetingData;
    const uiStore = useUIStore.getState();
    
    if (currentMeeting) {
      // Add to recent meetings
      uiStore.addRecentMeeting({
        id: currentMeeting.id,
        title: currentMeeting.title,
        date: new Date(),
        participants: currentMeeting.participants?.length || 0
      });
    }
  },
  
  // Sync UI preferences across stores
  syncUI: (uiData) => {
    const { theme, notifications, devices } = uiData;
    const userStore = useUserStore.getState();
    
    // Update user preferences to match UI settings
    if (notifications || devices) {
      userStore.updatePreferences({
        ...(notifications && { notifications }),
        ...(devices && { meeting: { ...userStore.preferences.meeting, ...devices } })
      });
    }
  }
};

// Store event listeners for cross-store communication
export const setupStoreListeners = () => {
  // Listen to auth store changes
  useAuthStore.subscribe((state, prevState) => {
    if (state.isAuthenticated !== prevState.isAuthenticated || 
        state.user !== prevState.user) {
      syncStores.syncAuth(state);
    }
  });
  
  // Listen to meeting store changes
  useMeetingStore.subscribe((state, prevState) => {
    if (state.currentMeeting !== prevState.currentMeeting) {
      syncStores.syncMeeting(state);
    }
  });
  
  // Listen to UI store changes
  useUIStore.subscribe((state, prevState) => {
    const uiChanged = state.theme !== prevState.theme ||
                     state.notifications !== prevState.notifications ||
                     state.devices !== prevState.devices;
    
    if (uiChanged) {
      syncStores.syncUI(state);
    }
  });
};

// Development utilities
export const devTools = {
  // Get all store states for debugging
  getAllStates: () => ({
    auth: useAuthStore.getState(),
    meeting: useMeetingStore.getState(),
    admin: useAdminStore.getState(),
    ui: useUIStore.getState(),
    user: useUserStore.getState()
  }),
  
  // Reset all stores to initial state
  resetAllStores: () => {
    // Clear persistence
    localStorage.removeItem('enterprise-auth');
    localStorage.removeItem('enterprise-ui');
    localStorage.removeItem('enterprise-user');
    
    // Reload to reinitialize
    window.location.reload();
  },
  
  // Export store data for backup/debugging
  exportStoreData: () => {
    const data = {
      timestamp: new Date().toISOString(),
      stores: devTools.getAllStates()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], 
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Type helpers for TypeScript (if needed later)
export const storeTypes = {
  AuthState: 'auth',
  MeetingState: 'meeting',
  AdminState: 'admin',
  UIState: 'ui',
  UserState: 'user'
};

// Store health check utility
export const checkStoreHealth = () => {
  const health = {
    auth: { healthy: true, issues: [] },
    meeting: { healthy: true, issues: [] },
    admin: { healthy: true, issues: [] },
    ui: { healthy: true, issues: [] },
    user: { healthy: true, issues: [] }
  };
  
  try {
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated && !authState.accessToken) {
      health.auth.healthy = false;
      health.auth.issues.push('Authenticated but missing access token');
    }
    
    const meetingState = useMeetingStore.getState();
    if (meetingState.isConnected && !meetingState.wsConnection) {
      health.meeting.healthy = false;
      health.meeting.issues.push('Connected but missing WebSocket connection');
    }
    
    const uiState = useUIStore.getState();
    if (uiState.toasts.length > 10) {
      health.ui.healthy = false;
      health.ui.issues.push('Too many active toasts');
    }
    
    return health;
  } catch (error) {
    return {
      error: 'Failed to check store health',
      details: error.message
    };
  }
};