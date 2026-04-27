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
