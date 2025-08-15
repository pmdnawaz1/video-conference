// Service Worker for Video Conference PWA
const CACHE_NAME = 'video-conference-v1';
const STATIC_CACHE_NAME = 'video-conference-static-v1';

// Critical assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Assets to cache on first access
const DYNAMIC_CACHE_PATTERNS = [
  /^https:\/\/fonts\.googleapis\.com/,
  /^https:\/\/fonts\.gstatic\.com/,
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/
];

// Network-first patterns (always try network first)
const NETWORK_FIRST_PATTERNS = [
  /^http.*\/api\//,
  /^ws.*:\/\//,
  /^wss.*:\/\//,
  /\/meeting\//,
  /\/dashboard/
];

self.addEventListener('install', event => {
  console.log('SW: Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('SW: Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('SW: Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('SW: Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('SW: Service worker activated');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except fonts
  if (url.origin !== self.location.origin && 
      !DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return;
  }

  // Network-first strategy for API calls and real-time features
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('SW: Serving from cache:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      console.log('SW: Caching new resource:', request.url);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('SW: Cache-first failed:', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    console.log('SW: Network-first for:', request.url);
    const networkResponse = await fetch(request);
    
    // Don't cache API responses or WebSocket connections
    return networkResponse;
  } catch (error) {
    console.error('SW: Network-first failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Handle background sync
self.addEventListener('sync', event => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  console.log('SW: Performing background sync...');
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
  console.log('SW: Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'general',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Video Conference', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('SW: Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log('SW: Service worker script loaded');