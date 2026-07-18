/**
 * Public-site theming.
 *
 * Maps a clinic's chosen branding colors onto the shadcn theme tokens
 * (`--primary`, `--ring`, `--secondary`, …) so the *public* clinic site
 * actually renders in the clinic's colors instead of the shared Oltigo
 * green. This is applied as an inline style on the public layout wrapper,
 * so the override is scoped to public pages only — admin, clinical, and
 * auth surfaces keep the app-wide palette.
 *
 * Without this, `--brand-primary` was set but never consumed, and every
 * clinic rendered with the hardcoded `--primary: var(--oltigo-green)`.
 */

import type { CSSProperties } from "react";

const INK = "#0b0f0e"; // dark foreground (matches --ink)
const BONE = "#f4f1ea"; // light foreground (matches --bone)

/** Parse a #rgb / #rrggbb string into [r, g, b] (0–255), or null if invalid. */
function parseHex(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Relative luminance (WCAG) of an sRGB color, 0 (black) … 1 (white). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Choose a readable foreground (ink or bone) for text/icons placed on top
 * of `bgHex`. Falls back to bone (light) for unparseable input, matching
 * the previous green-on-bone default.
 */
export function readableForeground(bgHex: string): string {
  const rgb = parseHex(bgHex);
  if (!rgb) return BONE;
  return relativeLuminance(rgb) > 0.5 ? INK : BONE;
}

export interface PublicThemeBranding {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
}

/**
 * Build the inline style object that re-themes the public site to the
 * clinic's branding. Spread onto the public layout wrapper `<div>`.
 */
export function buildPublicThemeStyle(branding: PublicThemeBranding): CSSProperties {
  const primaryFg = readableForeground(branding.primaryColor);
  return {
    // Raw brand values (kept for any component reading them directly).
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor,
    "--brand-heading-font": branding.headingFont,
    "--brand-body-font": branding.bodyFont,
    // Re-map the shadcn theme tokens so bg-primary / text-primary / ring etc.
    // pick up the clinic's colors across the whole public subtree.
    "--primary": branding.primaryColor,
    "--primary-foreground": primaryFg,
    "--ring": branding.primaryColor,
    "--sidebar-primary": branding.primaryColor,
    "--sidebar-primary-foreground": primaryFg,
  } as CSSProperties;
}
