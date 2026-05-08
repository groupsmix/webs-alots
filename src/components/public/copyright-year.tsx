"use client";

/**
 * Client component that renders the current year.
 *
 * Extracted so the server-rendered footer never caches a stale year
 * (e.g. under ISR/SSG). The year is always evaluated client-side.
 */
export function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}
