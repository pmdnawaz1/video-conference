import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // Authentication state
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      
      // Loading states
      isLoading: false,
      isRegistering: false,
      isLoggingIn: false,
      
      // Error states
      error: null,
      
      // Actions
      setAuth: (user, accessToken, refreshToken) => {
        set({
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
          error: null
        });
      },
      
      setUser: (user) => {
        set({ user });
      },
      
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
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
      
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          error: null,
          isLoading: false
        });
        // Force navigation to login page
        window.location.href = '/login';
      },
      
      // API call actions
      login: async (email, password) => {
        set({ isLoggingIn: true, error: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            const { access_token, refresh_token, user } = result.data;
            get().setAuth(user, access_token, refresh_token);
            return { success: true };
          } else {
            set({ error: result.error || 'Login failed' });
            return { success: false, error: result.error || 'Login failed' };
          }
        } catch (error) {
          const errorMessage = 'Network error - please check if the enterprise backend is running';
          set({ error: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isLoggingIn: false });
        }
      },
      
      register: async (userData) => {
        set({ isRegistering: true, error: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            return { success: true, user: result.data };
          } else {
            set({ error: result.error || 'Registration failed' });
            return { success: false, error: result.error || 'Registration failed' };
          }
        } catch (error) {
          const errorMessage = 'Network error - please check if the enterprise backend is running';
          set({ error: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isRegistering: false });
        }
      },
      
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            const { access_token, refresh_token, user } = result.data;
            get().setAuth(user, access_token, refresh_token);
            return true;
          } else {
            get().logout();
            return false;
          }
        } catch (error) {
          get().logout();
          return false;
        }
      },
      
      updateProfile: async (profileData) => {
        const { accessToken } = get();
        if (!accessToken) return { success: false, error: 'Not authenticated' };
        
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/me`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(profileData),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            set({ user: result.data });
            return { success: true };
          } else {
            set({ error: result.error || 'Profile update failed' });
            return { success: false, error: result.error || 'Profile update failed' };
          }
        } catch (error) {
          const errorMessage = 'Network error';
          set({ error: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isLoading: false });
        }
      },
      
      changePassword: async (oldPassword, newPassword) => {
        const { accessToken } = get();
        if (!accessToken) return { success: false, error: 'Not authenticated' };
        
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/me/password`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            return { success: true };
          } else {
            set({ error: result.error || 'Password change failed' });
            return { success: false, error: result.error || 'Password change failed' };
          }
        } catch (error) {
          const errorMessage = 'Network error';
          set({ error: errorMessage });
          return { success: false, error: errorMessage };
        } finally {
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'enterprise-auth',
      partialize: (state) => ({
        // Only persist essential auth data
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure non-persisted state is initialized
        if (state) {
          state.isLoading = false;
          state.isRegistering = false;
          state.isLoggingIn = false;
          state.error = null;
        }
      },
    }
  )
);

export default useAuthStore;