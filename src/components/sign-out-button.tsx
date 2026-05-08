"use client";

import { LogOut } from "lucide-react";

async function purgeServiceWorkerCaches(): Promise<void> {
  // F-04: Post PURGE_AUTHED to the service worker so it removes
  // any cached authenticated HTML before we clear all caches.
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "PURGE_AUTHED" });
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export function SignOutButton() {
  async function handleSignOut() {
    // A53-01: Call the dedicated logout endpoint first so the browser
    // receives `Clear-Site-Data: "cache","cookies","storage"` and
    // atomically purges all origin-scoped PHI state before navigation.
    // The Server Action signOut() emits a 307 redirect which cannot
    // carry arbitrary response headers, so we handle logout here.
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        // Include cookies so the server can call supabase.auth.signOut()
        credentials: "same-origin",
      });
    } catch {
      // Fetch failed (offline, etc.) — still purge local state and redirect
    }

    // Purge service-worker caches and any remaining client-side storage
    await purgeServiceWorkerCaches();

    // Hard navigate to login so no SPA state persists after logout
    window.location.replace("/login");
  }

  return (
    <button
      onClick={() => handleSignOut()}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      {"Sign Out"}
    </button>
  );
}

