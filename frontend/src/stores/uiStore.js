import { create } from "zustand";
import { persist } from "zustand/middleware";

const useUIStore = create(
  persist(
    (set, get) => ({
      // Theme and appearance
      theme: "light",
      sidebarCollapsed: false,
      compactMode: false,
      highContrast: false,
      fontSize: "medium",

      // Layout preferences
      videoLayout: "grid",
      participantsPanelOpen: true,
      chatPanelOpen: true,
      controlsVisible: true,
      fullscreenMode: false,

      // Notification preferences
      notifications: {
        desktop: true,
        sound: true,
        participantJoin: true,
        participantLeave: false,
        chat: true,
        handRaises: true,
        permissions: true,
        meetingReminders: true,
      },

      // Device preferences
      devices: {
        preferredCamera: null,
        preferredMicrophone: null,
        preferredSpeaker: null,
        autoJoinAudio: true,
        autoJoinVideo: false,
        echoCancellation: true,
        noiseSuppression: true,
        backgroundBlur: false,
      },

      // Meeting preferences
      meetingPreferences: {
        defaultMuted: true,
        defaultVideoOff: true,
        alwaysShowCaptions: false,
        recordingConsent: false,
        joinEarly: 5,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },

      // Modal and dialog states
      modals: {
        settingsOpen: false,
        deviceSettingsOpen: false,
        inviteParticipantsOpen: false,
        meetingDetailsOpen: false,
        profileOpen: false,
        aboutOpen: false,
      },

      // Loading states for UI components
      loading: {
        deviceCheck: false,
        settingsUpdate: false,
        themeChange: false,
      },

      // Error states for UI feedback
      errors: {
        deviceAccess: null,
        settingsUpdate: null,
        connection: null,
      },

      // Recent activity for quick access
      recentMeetings: [],
      recentContacts: [],
      pinnedMeetings: [],

      // Accessibility preferences
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        screenReader: false,
        keyboardNavigation: true,
        focusIndicators: true,
      },

      // Actions
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute("data-theme", theme);
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setVideoLayout: (layout) => {
        set({ videoLayout: layout });
      },

      togglePanel: (panel) => {
        set((state) => ({
          [`${panel}PanelOpen`]: !state[`${panel}PanelOpen`],
        }));
      },

      setFullscreen: (fullscreen) => {
        set({ fullscreenMode: fullscreen });
      },

      updateNotificationSettings: (settings) => {
        set((state) => ({
          notifications: { ...state.notifications, ...settings },
        }));
      },

      updateDeviceSettings: (settings) => {
        set((state) => ({
          devices: { ...state.devices, ...settings },
        }));
      },

      updateMeetingPreferences: (preferences) => {
        set((state) => ({
          meetingPreferences: { ...state.meetingPreferences, ...preferences },
        }));
      },

      updateAccessibilitySettings: (settings) => {
        set((state) => ({
          accessibility: { ...state.accessibility, ...settings },
        }));
      },

      openModal: (modalName) => {
        set((state) => ({
          modals: { ...state.modals, [modalName]: true },
        }));
      },

      closeModal: (modalName) => {
        set((state) => ({
          modals: { ...state.modals, [modalName]: false },
        }));
      },

      closeAllModals: () => {
        const closedModals = Object.keys(get().modals).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {});
        set({ modals: closedModals });
      },

      setLoading: (key, loading) => {
        set((state) => ({
          loading: { ...state.loading, [key]: loading },
        }));
      },

      setError: (key, error) => {
        set((state) => ({
          errors: { ...state.errors, [key]: error },
        }));
      },

      clearError: (key) => {
        set((state) => ({
          errors: { ...state.errors, [key]: null },
        }));
      },

      clearAllErrors: () => {
        const clearedErrors = Object.keys(get().errors).reduce((acc, key) => {
          acc[key] = null;
          return acc;
        }, {});
        set({ errors: clearedErrors });
      },

      addRecentMeeting: (meeting) => {
        set((state) => ({
          recentMeetings: [
            meeting,
            ...state.recentMeetings
              .filter((m) => m.id !== meeting.id)
              .slice(0, 9),
          ],
        }));
      },

      addRecentContact: (contact) => {
        set((state) => ({
          recentContacts: [
            contact,
            ...state.recentContacts
              .filter((c) => c.id !== contact.id)
              .slice(0, 9),
          ],
        }));
      },

      pinMeeting: (meetingId) => {
        set((state) => ({
          pinnedMeetings: [...state.pinnedMeetings, meetingId],
        }));
      },

      unpinMeeting: (meetingId) => {
        set((state) => ({
          pinnedMeetings: state.pinnedMeetings.filter((id) => id !== meetingId),
        }));
      },

      // Keyboard shortcuts handling
      keyboardShortcuts: {
        "ctrl+m": "toggleMute",
        "ctrl+d": "toggleVideo",
        "ctrl+shift+a": "toggleAudio",
        "ctrl+shift+v": "toggleVideo",
        "ctrl+shift+s": "toggleScreenShare",
        "ctrl+shift+c": "toggleChat",
        "ctrl+shift+p": "toggleParticipants",
        "ctrl+shift+r": "raiseHand",
        escape: "exitFullscreen",
      },

      updateKeyboardShortcuts: (shortcuts) => {
        set((state) => ({
          keyboardShortcuts: { ...state.keyboardShortcuts, ...shortcuts },
        }));
      },

      // Toast notifications management
      toasts: [],

      addToast: (toast) => {
        const newToast = {
          id: Date.now() + Math.random(),
          type: "info",
          duration: 5000,
          ...toast,
        };

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }));

        if (newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(newToast.id);
          }, newToast.duration);
        }
      },

      removeToast: (toastId) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toastId),
        }));
      },

      clearAllToasts: () => {
        set({ toasts: [] });
      },

      // Utility functions
      getLayoutClass: () => {
        const { videoLayout } = get();
        const layoutClasses = {
          grid: "grid-layout",
          speaker: "speaker-layout",
          sidebar: "sidebar-layout",
          fullscreen: "fullscreen-layout",
        };
        return layoutClasses[videoLayout] || "grid-layout";
      },

      isModalOpen: (modalName) => {
        return get().modals[modalName] || false;
      },

      hasError: (key) => {
        return get().errors[key] !== null;
      },

      isLoading: (key) => {
        return get().loading[key] || false;
      },

      getThemeColors: () => {
        const { theme, highContrast } = get();

        if (highContrast) {
          return theme === "dark"
            ? { primary: "#ffffff", secondary: "#000000", accent: "#ffff00" }
            : { primary: "#000000", secondary: "#ffffff", accent: "#0000ff" };
        }

        return theme === "dark"
          ? { primary: "#ffffff", secondary: "#1f2937", accent: "#3b82f6" }
          : { primary: "#1f2937", secondary: "#ffffff", accent: "#3b82f6" };
      },

      // Initialize UI based on system preferences
      initializeFromSystem: () => {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        set((state) => ({
          theme:
            state.theme === "system"
              ? prefersDark
                ? "dark"
                : "light"
              : state.theme,
          accessibility: {
            ...state.accessibility,
            reduceMotion: prefersReducedMotion,
          },
        }));
      },
    }),
    {
      name: "enterprise-ui",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        compactMode: state.compactMode,
        highContrast: state.highContrast,
        fontSize: state.fontSize,
        videoLayout: state.videoLayout,
        notifications: state.notifications,
        devices: state.devices,
        meetingPreferences: state.meetingPreferences,
        accessibility: state.accessibility,
        recentMeetings: state.recentMeetings,
        recentContacts: state.recentContacts,
        pinnedMeetings: state.pinnedMeetings,
        keyboardShortcuts: state.keyboardShortcuts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.modals = Object.keys(state.modals || {}).reduce((acc, key) => {
            acc[key] = false;
            return acc;
          }, {});
          state.loading = Object.keys(state.loading || {}).reduce(
            (acc, key) => {
              acc[key] = false;
              return acc;
            },
            {},
          );
          state.errors = Object.keys(state.errors || {}).reduce((acc, key) => {
            acc[key] = null;
            return acc;
          }, {});
          state.toasts = [];

          state.initializeFromSystem?.();
        }
      },
    },
  ),
);

export default useUIStore;
