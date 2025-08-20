import React from "react";
import { usePWA } from "./PWAProvider";

const PWATest = () => {
  const { isOnline, isPWA, showUpdatePrompt, updateReady } = usePWA();

  return (
    <div className="fixed bottom-4 left-4 p-4 bg-muted0 text-white rounded-lg shadow-lg text-xs max-w-xs z-50">
      <h3 className="font-bold text-green-400 mb-2">📱 PWA Status</h3>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Online:</span>
          <span className={isOnline ? "text-green-400" : "text-red-400"}>
            {isOnline ? "✅" : "❌"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>PWA Mode:</span>
          <span className={isPWA ? "text-green-400" : "text-yellow-400"}>
            {isPWA ? "✅" : "📱"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Service Worker:</span>
          <span className="text-green-400">
            {"serviceWorker" in navigator ? "✅" : "❌"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Update Ready:</span>
          <span
            className={updateReady ? "text-green-400" : "text-muted-foreground"}
          >
            {updateReady ? "✅" : "⏳"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Display Mode:</span>
          <span className="text-blue-400">
            {window.matchMedia("(display-mode: standalone)").matches
              ? "Standalone"
              : "Browser"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Platform:</span>
          <span className="text-blue-400">
            {/iPhone|iPad|iPod/.test(navigator.userAgent)
              ? "iOS"
              : /Android/.test(navigator.userAgent)
                ? "Android"
                : "Desktop"}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        💡 On mobile: Tap "Add to Home Screen"
      </div>
    </div>
  );
};

export default PWATest;
