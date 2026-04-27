/**
 * Service Worker for PWA offline support.
 *
 * Strategies:
 * - Static assets (JS, CSS, images, fonts): cache-first, update in background
 * - API calls (/api/*): never cached (PHI safety)
 * - HTML pages: network-first with offline fallback — only PUBLIC routes cached
 * - Push notifications for appointment reminders
 *
 * F-04: Only cache public marketing/booking HTML routes. Authenticated
 * routes (/admin/*, /doctor/*, /receptionist/*, /patient/*, /super-admin/*)
 * are never cached. On logout, clients post PURGE_AUTHED to clear any
 * stale authenticated content.
 */

const CACHE_NAME = "oltigo-v3";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/", "/offline.html"];

/** Routes that are safe to cache (public, no auth required). */
const PUBLIC_CACHE_ALLOWLIST = [
  "/",
  "/blog",
  "/book",
  "/about",
  "/services",
  "/contact",
  "/reviews",
  "/how-to-book",
  "/location",
  "/testimonials",
  "/privacy",
  "/annuaire",
  "/doctor-profile",
  "/offline.html",
];

/** Authenticated route prefixes — never cache these. */
const AUTHED_PREFIXES = [
  "/admin",
  "/doctor",
  "/receptionist",
  "/patient",
  "/super-admin",
];

function isPublicRoute(pathname) {
  // Exact match or starts with a public prefix
  for (const route of PUBLIC_CACHE_ALLOWLIST) {
    if (pathname === route || pathname === route + "/" || pathname.startsWith(route + "/")) {
      return true;
    }
  }
  return false;
}

function isAuthedRoute(pathname) {
  for (const prefix of AUTHED_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

// ---- Install ----

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ---- Activate ----

self.addEventListener("activate", (event) => {
  const KEEP = new Set([CACHE_NAME]);
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

// ---- Message handler ----

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // F-04: Purge authenticated content from cache on logout
  if (event.data?.type === "PURGE_AUTHED") {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        for (const request of keys) {
          const url = new URL(request.url);
          if (isAuthedRoute(url.pathname)) {
            cache.delete(request);
          }
        }
      });
    });
  }
});

// ---- Fetch ----

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST bookings, etc.)
  if (request.method !== "GET") return;

  // Never cache API responses — they may contain PHI that must not persist
  // in browser storage after logout or role switch.
  if (url.pathname.startsWith("/api/")) return;

  // Never cache authenticated routes
  if (isAuthedRoute(url.pathname)) return;

  // Respect Cache-Control: no-store from authenticated layouts
  if (request.headers.get("cache-control")?.includes("no-store")) return;

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
  // F-04: Only cache HTML for public routes
  if (request.headers.get("accept")?.includes("text/html")) {
    if (!isPublicRoute(url.pathname)) return; // don't cache non-public HTML

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
