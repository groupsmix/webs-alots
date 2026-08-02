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
import type { TemplateDefinition } from "@/lib/templates";

const INK = "#0b0f0e"; // dark foreground (matches --ink)
const BONE = "#f4f1ea"; // light foreground (matches --bone)

/**
 * Base `--radius` value per template. Every Tailwind radius utility
 * (`rounded-sm` … `rounded-4xl`) is derived from `--radius` in
 * `globals.css`, so overriding this one variable scales the corner
 * roundness of the whole public subtree to match the chosen template.
 * `rounded-full` (9999px) is unaffected by design.
 */
const RADIUS_REM: Record<TemplateDefinition["borderRadius"], string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.875rem",
  full: "1.5rem",
};

/** Resolve a template's borderRadius token to a concrete `--radius` value. */
export function templateRadius(borderRadius: TemplateDefinition["borderRadius"]): string {
  return RADIUS_REM[borderRadius] ?? RADIUS_REM.lg;
}

/**
 * Tailwind classes that give a card the look of the template's `cardStyle`.
 * Written to be tailwind-merge friendly (these are appended after a card's
 * base classes, so the later utilities here win over the defaults).
 */
export function publicCardClass(cardStyle: TemplateDefinition["cardStyle"]): string {
  switch (cardStyle) {
    case "bordered":
      return "border-2 border-border shadow-none";
    case "flat":
      return "border-transparent bg-muted/40 shadow-none";
    case "elevated":
      return "border-0 shadow-lg";
    case "shadow":
    default:
      return "border border-border/60 shadow-sm";
  }
}

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
 *
 * When a `borderRadius` token is passed (from the clinic's chosen
 * template), `--radius` is overridden so the corner roundness of the
 * whole public subtree matches the template — sharp for "minimal",
 * generous for "elegant", etc.
 */
const TEMPLATE_PALETTES: Record<
  TemplateDefinition["id"],
  {
    background: string;
    foreground: string;
    card: string;
    muted: string;
    mutedForeground: string;
    border: string;
  }
> = {
  modern: {
    background: "#ffffff",
    foreground: INK,
    card: "#faf8f2",
    muted: "#f4f1ea",
    mutedForeground: "rgba(11, 15, 14, 0.66)",
    border: "rgba(11, 15, 14, 0.12)",
  },
  classic: {
    background: "#f0f9ff",
    foreground: INK,
    card: "#ffffff",
    muted: "#e0f2fe",
    mutedForeground: "rgba(11, 15, 14, 0.66)",
    border: "rgba(11, 15, 14, 0.12)",
  },
  elegant: {
    background: "#fff7f8",
    foreground: "#1f1a1b",
    card: "#ffffff",
    muted: "#ffe4e6",
    mutedForeground: "rgba(31, 26, 27, 0.66)",
    border: "rgba(31, 26, 27, 0.12)",
  },
  bold: {
    background: "#0b0f0e",
    foreground: BONE,
    card: "#1c2320",
    muted: "#232b28",
    mutedForeground: "rgba(244, 241, 234, 0.72)",
    border: "rgba(244, 241, 234, 0.22)",
  },
  minimal: {
    background: "#ffffff",
    foreground: INK,
    card: "#fafafa",
    muted: "#f5f5f5",
    mutedForeground: "rgba(11, 15, 14, 0.66)",
    border: "rgba(11, 15, 14, 0.12)",
  },
  arabic: {
    background: "#ffffff",
    foreground: INK,
    card: "#faf8f2",
    muted: "#f4f1ea",
    mutedForeground: "rgba(11, 15, 14, 0.66)",
    border: "rgba(11, 15, 14, 0.12)",
  },
};

/**
 * Build the inline style object that re-themes the public site to the
 * clinic's branding. Spread onto the public layout wrapper `<div>`.
 *
 * When a `template` is passed, the full palette (background, foreground,
 * card, muted, border) and the border radius are overridden so every
 * shadcn token (and therefore every component using bg-background,
 * text-foreground, bg-card, etc.) matches the chosen template.
 */
export function buildPublicThemeStyle(
  branding: PublicThemeBranding,
  template?: TemplateDefinition,
): CSSProperties {
  const primaryFg = readableForeground(branding.primaryColor);
  const secondaryColor = branding.secondaryColor || branding.primaryColor;
  const secondaryFg = readableForeground(secondaryColor);
  const palette = template
    ? (TEMPLATE_PALETTES[template.id] ?? TEMPLATE_PALETTES.modern)
    : undefined;

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
    "--secondary": secondaryColor,
    "--secondary-foreground": secondaryFg,
    "--ring": branding.primaryColor,
    "--sidebar-primary": branding.primaryColor,
    "--sidebar-primary-foreground": primaryFg,
    // Template-aware neutral palette so headers, footers, and cards feel
    // cohesive instead of always falling back to the app-wide bone theme.
    ...(palette
      ? {
          "--background": palette.background,
          "--foreground": palette.foreground,
          "--card": palette.card,
          "--muted": palette.muted,
          "--muted-foreground": palette.mutedForeground,
          "--border": palette.border,
          "--input": palette.border,
        }
      : {}),
    // Template corner roundness (drives all rounded-* utilities).
    ...(template ? { "--radius": templateRadius(template.borderRadius) } : {}),
  } as CSSProperties;
}
