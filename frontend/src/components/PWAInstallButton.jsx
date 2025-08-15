import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, X } from 'lucide-react';
import { Button } from './ui/button';

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    // Check if already installed
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
      setIsStandalone(standalone);
    };

    // Detect platform
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('android')) {
        setPlatform('android');
      } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        setPlatform('ios');
      } else if (userAgent.includes('windows')) {
        setPlatform('windows');
      } else if (userAgent.includes('mac')) {
        setPlatform('mac');
      } else {
        setPlatform('desktop');
      }
    };

    checkStandalone();
    detectPlatform();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Don't show if already dismissed or already standalone
      const dismissedUntil = localStorage.getItem('pwa-install-dismissed-until');
      const now = new Date().getTime();
      const dismissedTime = dismissedUntil ? parseInt(dismissedUntil) : 0;
      
      if (!isStandalone && now > dismissedTime) {
        setShowInstallPrompt(true);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', checkStandalone);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Show manual install instructions
      setShowInstallPrompt(true);
      return;
    }

    try {
      // Trigger the install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setShowInstallPrompt(false);
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = (duration = 'session') => {
    setShowInstallPrompt(false);
    
    if (duration === 'session') {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    } else if (duration === 'week') {
      const oneWeek = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
      localStorage.setItem('pwa-install-dismissed-until', oneWeek.toString());
    }
  };

  const getInstallInstructions = () => {
    switch (platform) {
      case 'android':
        return {
          title: 'Install on Android',
          steps: [
            'Tap the menu button (⋮) in your browser',
            'Select "Add to Home screen" or "Install app"',
            'Tap "Add" to confirm'
          ]
        };
      case 'ios':
        return {
          title: 'Install on iOS',
          steps: [
            'Tap the Share button (□↗) in Safari',
            'Scroll and tap "Add to Home Screen"',
            'Tap "Add" to confirm'
          ]
        };
      case 'windows':
        return {
          title: 'Install on Windows',
          steps: [
            'Click the install button (⊞) in your browser address bar',
            'Or use Ctrl+Shift+A in Edge',
            'Click "Install" to confirm'
          ]
        };
      case 'mac':
        return {
          title: 'Install on Mac',
          steps: [
            'Click the install button in your browser address bar',
            'Or look for "Install Video Conference Platform" in the browser menu',
            'Click "Install" to confirm'
          ]
        };
      default:
        return {
          title: 'Install Desktop App',
          steps: [
            'Look for the install button in your browser address bar',
            'Or check your browser menu for "Install" option',
            'Click "Install" to add to your desktop'
          ]
        };
    }
  };

  // Don't show if already installed
  if (isStandalone) {
    return null;
  }

  const instructions = getInstallInstructions();
  const Icon = platform === 'android' || platform === 'ios' ? Smartphone : Monitor;

  return (
    <>
      {/* Floating Install Button */}
      {deferredPrompt && !showInstallPrompt && (
        <Button
          onClick={handleInstallClick}
          className="fixed bottom-20 right-4 z-50 rounded-full w-14 h-14 p-0 shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
          title="Install App"
        >
          <Download className="w-6 h-6" />
        </Button>
      )}

      {/* Install Banner */}
      {showInstallPrompt && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:max-w-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Icon className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Install Video Conference App
                </h3>
              </div>
              <button
                onClick={() => handleDismiss('session')}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Get quick access and work offline. Install as a native app on your device.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              {deferredPrompt ? (
                <Button onClick={handleInstallClick} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-2" />
                  Install Now
                </Button>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p className="font-medium">{instructions.title}:</p>
                  {instructions.steps.map((step, index) => (
                    <p key={index}>• {step}</p>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDismiss('session')}
                  className="text-xs"
                >
                  Not now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss('week')}
                  className="text-xs text-gray-500"
                >
                  Don't ask again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;