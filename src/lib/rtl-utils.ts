/**
 * RTL Support Utilities
 *
 * Helper functions for verifying and managing RTL (right-to-left) support
 * in the Moroccan healthcare context (French LTR + Arabic RTL).
 */

/** Check if the current document direction is RTL */
export function isRtl(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dir === "rtl";
}

/** Get the logical start direction based on current text direction */
export function logicalStart(): "left" | "right" {
  return isRtl() ? "right" : "left";
}

/** Get the logical end direction based on current text direction */
export function logicalEnd(): "left" | "right" {
  return isRtl() ? "left" : "right";
}

/**
 * Return CSS logical properties that work in both LTR and RTL contexts.
 * Useful for inline styles where Tailwind logical utilities aren't available.
 */
export function logicalMargin(start: string, end: string): Record<string, string> {
  return {
    marginInlineStart: start,
    marginInlineEnd: end,
  };
}

/**
 * Return CSS logical padding properties.
 */
export function logicalPadding(start: string, end: string): Record<string, string> {
  return {
    paddingInlineStart: start,
    paddingInlineEnd: end,
  };
}

/**
 * Mapping of common Tailwind directional utilities to their logical equivalents.
 * Use these as a reference when auditing components for RTL compatibility.
 *
 * Physical → Logical:
 * - ml-* → ms-*  (margin-inline-start)
 * - mr-* → me-*  (margin-inline-end)
 * - pl-* → ps-*  (padding-inline-start)
 * - pr-* → pe-*  (padding-inline-end)
 * - left-* → start-*  (inset-inline-start)
 * - right-* → end-*   (inset-inline-end)
 * - text-left → text-start
 * - text-right → text-end
 * - rounded-l-* → rounded-s-*
 * - rounded-r-* → rounded-e-*
 * - border-l-* → border-s-*
 * - border-r-* → border-e-*
 */
export const RTL_CLASS_MAP: Record<string, string> = {
  "ml-": "ms-",
  "mr-": "me-",
  "pl-": "ps-",
  "pr-": "pe-",
  "text-left": "text-start",
  "text-right": "text-end",
};
