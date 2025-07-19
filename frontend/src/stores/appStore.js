import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // Connection state
      isConnected: false,
      roomId: '',
      userId: '',
      isInRoom: false,
      
      // Media state
      isVideoEnabled: true,
      isAudioEnabled: true,
      
      // Room state
      connectedUsers: new Set(),
      
      // UI state (not persisted)
      isChatOpen: false,
      debugLogs: [],
      
      // Actions
      setConnectionState: (isConnected) => {
        set({ isConnected });
      },
      
      setRoomState: (roomId, userId, isInRoom) => {
        set({ roomId, userId, isInRoom });
      },
      
      setMediaState: (isVideoEnabled, isAudioEnabled) => {
        set({ isVideoEnabled, isAudioEnabled });
      },
      
      addConnectedUser: (userId) => {
        set((state) => ({
          connectedUsers: new Set(state.connectedUsers.add(userId))
        }));
      },
      
      removeConnectedUser: (userId) => {
        set((state) => {
          const newUsers = new Set(state.connectedUsers);
          newUsers.delete(userId);
          return { connectedUsers: newUsers };
        });
      },
      
      clearConnectedUsers: () => {
        set({ connectedUsers: new Set() });
      },
      
      setChatOpen: (isChatOpen) => {
        set({ isChatOpen });
      },
      
      addDebugLog: (message) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `${timestamp}: ${message}`;
        
        set((state) => ({
          debugLogs: [...state.debugLogs.slice(-9), logEntry]
        }));
      },
      
      clearDebugLogs: () => {
        set({ debugLogs: [] });
      },
      
      // Reset all state
      reset: () => {
        set({
          isConnected: false,
          roomId: '',
          userId: '',
          isInRoom: false,
          isVideoEnabled: true,
          isAudioEnabled: true,
          connectedUsers: new Set(),
          isChatOpen: false,
          debugLogs: []
        });
      },
      
      // Leave room but keep user data
      leaveRoom: () => {
        set({
          isInRoom: false,
          isConnected: false,
          connectedUsers: new Set(),
          isChatOpen: false
        });
      }
    }),
    {
      name: 'video-conference-app',
      partialize: (state) => ({
        // Only persist essential data
        roomId: state.roomId,
        userId: state.userId,
        isVideoEnabled: state.isVideoEnabled,
        isAudioEnabled: state.isAudioEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure non-persisted state is initialized
        if (state) {
          state.isConnected = false;
          state.isInRoom = false;
          state.connectedUsers = new Set();
          state.isChatOpen = false;
          state.debugLogs = [];
        }
      },
    }
  )
);

export default useAppStore;