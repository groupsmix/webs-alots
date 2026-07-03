# 🕵️ Public Directory Audit Report

This report contains the findings from the comprehensive audit of the `public/` directory (static assets and service workers) for Oltigo Health.

## 1. BUGS & ERRORS

> [!WARNING]
> **High Priority: Service Worker Background Updates Terminated Early**

- **File:** [`sw.js`](file:///c:/webs-alots/public/sw.js#L133-L152)
- **What's wrong:** The "stale-while-revalidate" caching strategy for static assets fetches from the network to update the cache in the background, but fails to use `event.waitUntil()` to keep the service worker alive during the fetch.
- **Why it's a problem:** When `event.respondWith()` resolves (e.g., returning the cached response), the browser considers the event complete. The browser can and often will terminate the service worker thread immediately, killing the background `fetch()` before the cache is updated. Users may get stuck with stale static assets indefinitely.
- **Suggested fix:** Pass the background fetch promise into `event.waitUntil()`.

  ```javascript
  // Current:
  // return cached || networkFetch;

  // Suggested Fix:
  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }
  return networkFetch;
  ```

## 2. SECURITY ISSUES

> [!CAUTION]
> **Medium Priority: Unvalidated External URLs in Push Notifications**

- **File:** [`sw.js`](file:///c:/webs-alots/public/sw.js#L205-L224)
- **What's wrong:** The `notificationclick` handler extracts a URL directly from the push payload (`event.notification.data?.url`) and uses it in `self.clients.openWindow(url)` without validation.
- **Why it's a problem:** Even though push payloads must be signed by the server using VAPID keys (making this difficult to exploit), if an attacker spoofs a notification or compromises the server pushing the notifications, they could send an arbitrary external URL (e.g., `https://evil-phishing-site.com`). The PWA would blindly open this URL upon user interaction.
- **Suggested fix:** Validate that the provided URL is a relative path or matches the expected origin before opening the window.
  ```javascript
  const url = event.notification.data?.url || "/";
  if (!url.startsWith("/") && !url.startsWith(self.location.origin)) {
    console.warn("Invalid notification URL:", url);
    return;
  }
  ```

## 3. BLOCKERS

> [!TIP]
> **No blockers found**

- No syntax errors, broken dependencies, or build-breaking configuration issues were found in the `public` directory. Assets are static, and the `sw.js` is syntactically correct and will not block a build.

## 4. PERFORMANCE & CODE QUALITY

> [!NOTE]
> **Low Priority: Unreachable/Misleading Cache Header Rule**

- **File:** [`_headers`](file:///c:/webs-alots/public/_headers#L16-L19)
- **What's wrong:** There is a cache-control rule defined for `/_next/image/*`.
- **Why it's a problem:** Cloudflare static `_headers` files apply _only_ to static files served directly by the static assets binding. Next.js image optimization is a dynamic API/worker route (typically accessed via query params like `/_next/image?url=...`), not a static file. Therefore, this rule is unreachable and will be ignored by Cloudflare Pages/Workers static routing, leading to a false sense of security regarding image caching.
- **Suggested fix:** Remove this rule from `_headers`. Cache control for optimized images should be handled within the Next.js `next.config.ts` or the OpenNext image optimization worker directly.

> [!NOTE]
> **Low Priority: Redundant Cache Purge Logic**

- **File:** [`sw.js`](file:///c:/webs-alots/public/sw.js#L96-L112)
- **What's wrong:** The `PURGE_AUTHED` message iterates over the cache and deletes items matching `isAuthedRoute`.
- **Why it's a problem:** The `fetch` listener explicitly skips caching any route where `isAuthedRoute` is true (line 128). Unless a previous buggy version of the service worker cached these routes, this purge logic is effectively a no-op. While harmless as a defense-in-depth measure, it adds unnecessary processing.
- **Suggested fix:** Document this as a defense-in-depth measure (since the `activate` handler handles version bumps), or remove the iteration logic to save client-side CPU cycles on logout.
