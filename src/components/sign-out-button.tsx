"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

async function purgeServiceWorkerCaches(): Promise<void> {
  // F-04: Remove any cached authenticated content on logout.
  //
  // The current service worker never caches authenticated-route HTML or API
  // responses (see public/sw.js), so the only thing to clean up is potential
  // stale authenticated entries left by an older SW version.
  //
  // - If a service worker controls this page, hand the cleanup to it via
  //   PURGE_AUTHED: it removes only authenticated entries and keeps the
  //   public/offline cache intact (the SW wraps this in waitUntil so it
  //   completes even if the page navigates away).
  // - If there is no controlling SW to receive the message, clear caches
  //   directly so nothing from a previous session can persist.
  const controller = "serviceWorker" in navigator ? navigator.serviceWorker.controller : null;

  if (controller) {
    controller.postMessage({ type: "PURGE_AUTHED" });
    return;
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export function SignOutButton() {
  async function handleSignOut() {
    await purgeServiceWorkerCaches();
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
