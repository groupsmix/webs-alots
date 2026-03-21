/**
 * Responsive Utilities
 *
 * Provides hooks and helpers for responsive design across the application.
 * Covers breakpoint detection, mobile-first layout helpers, and
 * touch/scroll utilities for a mobile-responsive QA pass.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Breakpoints (matches Tailwind defaults) ----

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ---- Hooks ----

/**
 * Returns true when the viewport matches the given breakpoint or larger.
 * Uses matchMedia for accurate, SSR-safe detection.
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Returns true when the viewport is below the 'md' breakpoint (768px).
 * Useful for conditionally rendering mobile-specific UI.
 */
export function useIsMobile(): boolean {
  const isDesktop = useBreakpoint("md");
  return !isDesktop;
}

/**
 * Returns the current breakpoint name based on viewport width.
 */
export function useCurrentBreakpoint(): Breakpoint | "xs" {
  const [bp, setBp] = useState<Breakpoint | "xs">("xs");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w >= BREAKPOINTS["2xl"]) setBp("2xl");
      else if (w >= BREAKPOINTS.xl) setBp("xl");
      else if (w >= BREAKPOINTS.lg) setBp("lg");
      else if (w >= BREAKPOINTS.md) setBp("md");
      else if (w >= BREAKPOINTS.sm) setBp("sm");
      else setBp("xs");
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return bp;
}

/**
 * Returns viewport dimensions, updated on resize.
 */
export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

/**
 * Returns true when the user prefers reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return prefers;
}

/**
 * Lock body scroll (useful for modals, drawers on mobile).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (locked) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [locked]);
}

/**
 * Detect if the device supports touch.
 */
export function useIsTouchDevice(): boolean {
  const [isTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  });

  return isTouch;
}

// ---- Responsive Container Classes ----

/**
 * Returns a set of responsive container class names for consistent
 * padding and max-width across the app.
 */
export function getResponsiveContainerClasses(variant: "page" | "card" | "form" = "page"): string {
  switch (variant) {
    case "page":
      return "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";
    case "card":
      return "w-full max-w-2xl mx-auto px-4 sm:px-6";
    case "form":
      return "w-full max-w-lg mx-auto px-4 sm:px-6";
    default:
      return "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";
  }
}

/**
 * Returns responsive grid class names based on the desired column count.
 */
export function getResponsiveGridClasses(cols: 2 | 3 | 4 = 3): string {
  switch (cols) {
    case 2:
      return "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6";
    case 3:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6";
    case 4:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6";
    default:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6";
  }
}

/**
 * Clamp a value between min and max, useful for responsive calculations.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce a callback — useful for resize handlers.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Returns a callback that will only execute once within the given delay.
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
  const [lastRun, setLastRun] = useState(0);

  const throttled = useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      if (now - lastRun >= delay) {
        fn(...args);
        setLastRun(now);
      }
    },
    [fn, delay, lastRun],
  ) as T;

  return throttled;
}
