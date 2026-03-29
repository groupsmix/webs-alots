/**
 * Service Worker for PWA offline support.
 *
 * Strategies:
 * - Static assets (JS, CSS, images, fonts): cache-first, update in background
 * - API calls (/api/*): network-first with cached fallback (offline viewing)
 * - HTML pages: network-first with offline fallback page
 * - Push notifications for appointment reminders
 */

const CACHE_NAME = "oltigo-v2";
const API_CACHE_NAME = "oltigo-api-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/", "/offline.html"];

// ---- Install ----

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ---- Activate ----

self.addEventListener("activate", (event) => {
  const KEEP = new Set([CACHE_NAME, API_CACHE_NAME]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !KEEP.has(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch ----

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST bookings, etc.)
  if (request.method !== "GET") return;

  // --- API calls: network-first with cached fallback ---
  // This enables offline appointment viewing when the network is unavailable.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: "You are offline. Showing cached data." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          })
        )
    );
    return;
  }

  // --- Static assets: cache-first, update in background ---
  if (
    url.pathname.match(
      /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/
    )
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Return cached version immediately if available
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // --- HTML pages: network-first with offline fallback ---
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }
});

// ---- Push Notifications ----

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Oltigo", body: event.data.text() };
  }

  const title = payload.title || "Rappel de rendez-vous";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "appointment-reminder",
    data: payload.data || {},
    actions: payload.actions || [
      { action: "view", title: "Voir" },
      { action: "dismiss", title: "Fermer" },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- Notification Click ----

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  if (event.action === "dismiss") return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if one is open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
