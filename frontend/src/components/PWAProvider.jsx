import React, { createContext, useContext, useEffect, useState } from 'react';
import { Workbox } from 'workbox-window';

const PWAContext = createContext(null);

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

export const PWAProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [wb, setWb] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
      const isWindowControlsOverlay = window.matchMedia('(display-mode: window-controls-overlay)').matches;
      const isIOSStandalone = (window.navigator.standalone === true);
      const isPWAMode = isStandalone || isMinimalUI || isWindowControlsOverlay || isIOSStandalone;
      setIsPWA(isPWAMode);
      
      if (isPWAMode) {
        document.documentElement.classList.add('pwa-mode');
      }
      
      // Add specific display mode classes
      if (isWindowControlsOverlay) {
        document.documentElement.classList.add('window-controls-overlay');
      }
      if (isStandalone) {
        document.documentElement.classList.add('standalone');
      }
    };

    checkPWA();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWA);

    // Set up service worker with Workbox
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      const workbox = new Workbox('/sw.js');
      setWb(workbox);

      // Show prompt when new service worker is waiting
      workbox.addEventListener('waiting', () => {
        setShowUpdatePrompt(true);
        setUpdateReady(true);
      });

      // Automatically update when new service worker takes control
      workbox.addEventListener('controlling', () => {
        window.location.reload();
      });

      workbox.register();
    }

    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mediaQuery.removeEventListener('change', checkPWA);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateApp = () => {
    if (wb && updateReady) {
      wb.messageSkipWaiting();
      setShowUpdatePrompt(false);
    }
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  const value = {
    isOnline,
    isPWA,
    showUpdatePrompt,
    updateReady,
    updateApp,
    dismissUpdate
  };

  return (
    <PWAContext.Provider value={value}>
      {children}
      {showUpdatePrompt && <UpdatePrompt onUpdate={updateApp} onDismiss={dismissUpdate} />}
      {!isOnline && <OfflineBanner />}
    </PWAContext.Provider>
  );
};

const UpdatePrompt = ({ onUpdate, onDismiss }) => (
  <div className="fixed inset-x-0 bottom-0 z-50 p-4">
    <div className="mx-auto max-w-sm bg-blue-600 text-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium">App Update Available</h3>
          <p className="text-xs text-blue-100 mt-1">
            A new version is available. Update now?
          </p>
        </div>
        <div className="flex space-x-2 ml-4">
          <button
            onClick={onUpdate}
            className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            Update
          </button>
          <button
            onClick={onDismiss}
            className="bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  </div>
);

const OfflineBanner = () => (
  <div className="fixed inset-x-0 top-0 z-50 p-2">
    <div className="mx-auto max-w-sm bg-yellow-500 text-black rounded-lg shadow-lg p-2 text-center">
      <div className="flex items-center justify-center space-x-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">You're offline</span>
      </div>
    </div>
  </div>
);

export default PWAProvider;