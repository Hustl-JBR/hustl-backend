/**
 * Service Worker for Hustl App
 * Provides offline support and caching
 */

const CACHE_NAME = 'hustl-v1';
const STATIC_CACHE = 'hustl-static-v1';
const API_CACHE = 'hustl-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app-core.js',
  '/mobile-core.js',
  '/api-integration.js',
  '/mobile-optimizations.css',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Failed to cache some assets:', err);
        // Don't fail installation if some assets fail
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (unless they're our API)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api')) {
    return;
  }

  // API requests - cache with network-first strategy
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/jobs') || 
      url.pathname.startsWith('/users') || url.pathname.startsWith('/messages')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Cache successful GET responses
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Network failed, try cache
            return cache.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline response
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'You are currently offline. Please check your connection.' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            });
          });
      })
    );
    return;
  }

  // Static assets - cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Sync queued messages when back online
  // This would integrate with your messaging system
  console.log('[Service Worker] Syncing messages...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Hustl', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

