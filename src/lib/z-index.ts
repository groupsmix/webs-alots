/**
 * Centralized z-index scale (Issue 35).
 *
 * All z-index values used by overlay/fixed components should reference
 * this file to avoid conflicts when multiple overlays appear simultaneously.
 *
 * Scale (lowest → highest):
 *   header           40   — sticky headers / top bars
 *   mobileSidebar    50   — mobile sidebar overlays
 *   demoBanner       60   — demo environment banner
 *   offline          70   — offline indicator
 *   cookieConsent    75   — cookie consent bottom bar
 *   toast            80   — toast notifications
 *   sessionTimeout   90   — session timeout modal
 *   swUpdate         90   — service worker update prompt
 *   skipLink        100   — skip-to-content focus link
 *   commandPalette  200   — command palette (top-most)
 */

export const Z_INDEX = {
  header: "z-40",
  mobileSidebar: "z-50",
  demoBanner: "z-[60]",
  offline: "z-[70]",
  cookieConsent: "z-[75]",
  toast: "z-[80]",
  sessionTimeout: "z-[90]",
  swUpdate: "z-[90]",
  skipLink: "z-[100]",
  commandPalette: "z-[200]",
} as const;
