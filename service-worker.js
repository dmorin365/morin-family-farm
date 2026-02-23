// ============================================================
//  Morin Family Farm — Service Worker
//  Handles: offline caching, push notifications, geofence alerts
// ============================================================

const CACHE_NAME = 'morin-farm-v2';
const FARM_LAT = 34.39917;   // Morin Family Farm
const FARM_LNG = -82.94344;
const GEOFENCE_RADIUS_MILES = 0.5;

const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: cache core assets ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────
self.addEventListener('fetch', event => {
  // Don't intercept external requests (e.g. Google Apps Script, fonts, APIs)
  // iOS Safari will fail if the service worker tries to proxy cross-origin fetches
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Morin Family Farm', {
      body: data.body || "You're near the farm — want to file a report?",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'farm-arrival',
      renotify: true,
      data: { url: '/index.html' }
    })
  );
});

// ── Notification click: open app ───────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/index.html');
    })
  );
});

// ── Geofence check (triggered by main app via postMessage) ─────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_GEOFENCE') {
    const { lat, lng } = event.data;
    const dist = haversineDistance(lat, lng, FARM_LAT, FARM_LNG);
    if (dist <= GEOFENCE_RADIUS_MILES) {
      self.registration.showNotification('🌾 Welcome to Morin Family Farm!', {
        body: "You've arrived! Tap to open the app and file your visit report.",
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'farm-arrival',
        renotify: false,
        data: { url: '/index.html' }
      });
    }
    // Reply to main thread with distance
    event.source.postMessage({ type: 'GEOFENCE_RESULT', distanceMiles: dist });
  }
});

// ── Haversine distance (miles) ─────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function toRad(deg) { return deg * Math.PI / 180; }
