import { create } from 'zustand';
import useAuthStore from './authStore';

const useAdminStore = create((set, get) => ({
  // Admin Dashboard State
  dashboardData: {
    overview: null,
    meetingStats: null,
    recentMeetings: [],
    upcomingMeetings: [],
    userGroups: [],
    systemMetrics: null
  },
  
  // Organization Management
  organizations: [],
  currentOrganization: null,
  
  // Admin Management
  admins: [],
  adminInvitations: [],
  
  // User Management
  users: [],
  userInvitations: [],
  userGroups: [],
  
  // System Analytics
  systemHealth: null,
  usageReports: [],
  performanceMetrics: null,
  
  // Loading States
  isLoading: false,
  isDashboardLoading: false,
  isOrganizationLoading: false,
  isUsersLoading: false,
  isAdminsLoading: false,
  
  // Error States
  error: null,
  dashboardError: null,
  organizationError: null,
  usersError: null,
  adminsError: null,
  
  // Actions
  setDashboardData: (data) => {
    set(state => ({ 
      dashboardData: { ...state.dashboardData, ...data } 
    }));
  },
  
  setOrganizations: (organizations) => {
    set({ organizations });
  },
  
  setCurrentOrganization: (organization) => {
    set({ currentOrganization: organization });
  },
  
  setAdmins: (admins) => {
    set({ admins });
  },
  
  setUsers: (users) => {
    set({ users });
  },
  
  setUserGroups: (userGroups) => {
    set({ userGroups });
  },
  
  setSystemHealth: (systemHealth) => {
    set({ systemHealth });
  },
  
  setError: (error, type = 'error') => {
    set({ [type]: error });
  },
  
  clearError: (type = 'error') => {
    set({ [type]: null });
  },
  
  // Helper function for authenticated requests
  getAuthHeaders: () => {
    const { accessToken } = useAuthStore.getState();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  },
  
  // Dashboard API calls
  fetchDashboardOverview: async () => {
    set({ isDashboardLoading: true, dashboardError: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/dashboard/overview`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        get().setDashboardData({ overview: result.data });
        return { success: true };
      } else {
        set({ dashboardError: result.error || 'Failed to fetch dashboard overview' });
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
  
  fetchMeetingStats: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/dashboard/meeting-stats`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        get().setDashboardData({ meetingStats: result.data });
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  },
  
  fetchRecentMeetings: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/dashboard/recent-meetings`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        get().setDashboardData({ recentMeetings: result.data });
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  },
  
  fetchUpcomingMeetings: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/dashboard/upcoming-meetings`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        get().setDashboardData({ upcomingMeetings: result.data });
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  },
  
  // User Management API calls
  fetchAllUsers: async () => {
    set({ isUsersLoading: true, usersError: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/users`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ users: result.data });
        return { success: true };
      } else {
        set({ usersError: result.error || 'Failed to fetch users' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - users unavailable';
      set({ usersError: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isUsersLoading: false });
    }
  },
  
  inviteUser: async (invitationData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/users/invite`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(invitationData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Add invitation to list
        set(state => ({
          userInvitations: [result.data, ...state.userInvitations]
        }));
        return { success: true, invitation: result.data };
      } else {
        set({ error: result.error || 'Failed to send invitation' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Group Management API calls
  fetchUserGroups: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/groups`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ userGroups: result.data });
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  },
  
  createUserGroup: async (groupData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/groups`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(groupData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set(state => ({
          userGroups: [result.data, ...state.userGroups]
        }));
        return { success: true, group: result.data };
      } else {
        set({ error: result.error || 'Failed to create group' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Meeting Management API calls
  createInstantMeeting: async (meetingData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/meetings/instant`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(meetingData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, meeting: result.data };
      } else {
        set({ error: result.error || 'Failed to create meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  createScheduledMeeting: async (meetingData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/meetings/scheduled`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(meetingData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return { success: true, meeting: result.data };
      } else {
        set({ error: result.error || 'Failed to create meeting' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Super Admin API calls (for super admin users)
  fetchAllOrganizations: async () => {
    set({ isOrganizationLoading: true, organizationError: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/organizations`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ organizations: result.data });
        return { success: true };
      } else {
        set({ organizationError: result.error || 'Failed to fetch organizations' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error - organizations unavailable';
      set({ organizationError: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isOrganizationLoading: false });
    }
  },
  
  createOrganization: async (organizationData) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/organizations`, {
        method: 'POST',
        headers: get().getAuthHeaders(),
        body: JSON.stringify(organizationData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set(state => ({
          organizations: [result.data, ...state.organizations]
        }));
        return { success: true, organization: result.data };
      } else {
        set({ error: result.error || 'Failed to create organization' });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Network error';
      set({ error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchSystemHealth: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/system/health`, {
        headers: get().getAuthHeaders(),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        set({ systemHealth: result.data });
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  },
  
  // Utility functions
  getUsersCount: () => {
    const { users } = get();
    return users.length;
  },
  
  getActiveUsersCount: () => {
    const { users } = get();
    return users.filter(user => user.status === 'active').length;
  },
  
  getAdminsCount: () => {
    const { users } = get();
    return users.filter(user => user.role === 'admin' || user.role === 'super_admin').length;
  },
  
  getGroupsCount: () => {
    const { userGroups } = get();
    return userGroups.length;
  }
}));

export default useAdminStore;