"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

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

/**
 * A56.10: Issue a server-side Clear-Site-Data flush via a dedicated API
 * route before the Supabase signOut redirect.
 *
 * The browser enforces Clear-Site-Data: "cookies", "storage" only on a
 * response header — it cannot be set from a server action's redirect.
 * We fire a lightweight GET to /api/auth/clear-site that returns the
 * header, then proceed with signOut (which will redirect to /).
 *
 * Best-effort: if the request fails (offline, CORS, etc.) we still sign out.
 */
async function clearSiteData(): Promise<void> {
  try {
    await fetch("/api/auth/clear-site", { credentials: "include" });
  } catch {
    // Intentionally swallowed — logout must proceed regardless
  }
}

export function SignOutButton() {
  async function handleSignOut() {
    await Promise.allSettled([purgeServiceWorkerCaches(), clearSiteData()]);
    await signOut();
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
