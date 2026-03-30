/**
 * WCAG 2.1 Color Contrast Utilities
 *
 * Provides functions for calculating color contrast ratios and
 * suggesting accessible color alternatives per WCAG 2.1 guidelines.
 *
 * @see https://www.w3.org/TR/WCAG21/#contrast-minimum
 */

/**
 * Calculate WCAG 2.1 relative luminance from a hex color.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function luminance(hex: string): number {
  const rgb = hex
    .replace(/^#/, "")
    .match(/.{2}/g)
    ?.map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  if (!rgb || rgb.length < 3) return 0;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * WCAG contrast ratio between two hex colors.
 * Returns a value between 1 and 21.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns true if the color pair meets WCAG AA contrast requirements.
 * Normal text: 4.5:1, large text (>=18pt or >=14pt bold): 3:1.
 */
export function meetsWCAG_AA(fg: string, bg: string, largeText = false): boolean {
  const threshold = largeText ? 3 : 4.5;
  return contrastRatio(fg, bg) >= threshold;
}

/**
 * Darken or lighten a hex color until it meets WCAG AA (4.5:1) against
 * the given background color. Iteratively adjusts by mixing toward black.
 */
export function suggestAccessibleColor(fg: string, bg: string): string {
  let r = parseInt(fg.slice(1, 3), 16);
  let g = parseInt(fg.slice(3, 5), 16);
  let b = parseInt(fg.slice(5, 7), 16);

  for (let i = 0; i < 100; i++) {
    const candidate = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    if (contrastRatio(bg, candidate) >= 4.5) {
      return candidate;
    }
    // Mix 5% toward black each step
    r = Math.round(r * 0.95);
    g = Math.round(g * 0.95);
    b = Math.round(b * 0.95);
  }
  return "#000000";
}

/** Default fallback colors that meet WCAG AA against white. */
export const WCAG_SAFE_DEFAULTS = {
  primary: "#1E4DA1",
  secondary: "#0F6E56",
} as const;
