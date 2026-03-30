"use client";

/**
 * Client component that renders the current year.
 * Ensures the copyright year is always correct even with heavy caching (issue #32).
 */
export function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}
