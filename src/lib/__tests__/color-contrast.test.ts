import { describe, it, expect } from "vitest";

/**
 * WCAG AA Color Contrast Audit for the Oltigo design system.
 *
 * WCAG 2.1 AA requires:
 * - Normal text (< 18pt / < 14pt bold): contrast ratio >= 4.5:1
 * - Large text (>= 18pt / >= 14pt bold): contrast ratio >= 3:1
 * - UI components and graphical objects: contrast ratio >= 3:1
 *
 * The design system uses OKLCH color values. This test suite converts
 * them to approximate sRGB and computes WCAG relative luminance to
 * verify compliance.
 */

// ── OKLCH to sRGB approximate conversion ────────────────────────────

/** Convert OKLCH string "oklch(L C H)" to approximate { r, g, b } in 0–255. */
function oklchToRgb(oklchStr: string): { r: number; g: number; b: number } {
  // Handle oklch with alpha: "oklch(1 0 0 / 10%)"
  const cleaned = oklchStr.replace(/\/.*$/, "").trim();
  const match = cleaned.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/,
  );
  if (!match) {
    // Achromatic shorthand like oklch(0.145 0 0)
    const achromatic = cleaned.match(
      /oklch\(\s*([\d.]+)\s+0\s+0\s*\)/,
    );
    if (achromatic) {
      // L in OKLCH ~ perceptual lightness; approximate sRGB gray
      const L = parseFloat(achromatic[1]);
      const gray = Math.round(oklchLightnessToGray(L) * 255);
      return { r: gray, g: gray, b: gray };
    }
    throw new Error(`Cannot parse OKLCH value: ${oklchStr}`);
  }

  const L = parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const H = parseFloat(match[3]);

  if (C === 0) {
    const gray = Math.round(oklchLightnessToGray(L) * 255);
    return { r: gray, g: gray, b: gray };
  }

  // Approximate OKLCH → sRGB via OKLab intermediate
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);

  // OKLab → linear sRGB (approximate matrix)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return {
    r: Math.round(clamp(linearToSrgb(rLin)) * 255),
    g: Math.round(clamp(linearToSrgb(gLin)) * 255),
    b: Math.round(clamp(linearToSrgb(bLin)) * 255),
  };
}

function oklchLightnessToGray(L: number): number {
  // OKLCH L=0 is black, L=1 is white. Approximate gamma curve.
  const linear = L * L * L; // rough cube approximation
  return clamp(linearToSrgb(linear));
}

function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── WCAG relative luminance & contrast ratio ────────────────────────

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Design system color tokens (from globals.css :root) ─────────────

const lightTheme = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.45 0 0)",
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
};

const darkTheme = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.75 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
};

// ── Tests ───────────────────────────────────────────────────────────

describe("WCAG AA Color Contrast Audit — Light Theme", () => {
  it("foreground on background meets AA for normal text (>= 4.5:1)", () => {
    const fg = oklchToRgb(lightTheme.foreground);
    const bg = oklchToRgb(lightTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("card foreground on card background meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(lightTheme.cardForeground);
    const bg = oklchToRgb(lightTheme.card);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("primary foreground on primary meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(lightTheme.primaryForeground);
    const bg = oklchToRgb(lightTheme.primary);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary foreground on secondary meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(lightTheme.secondaryForeground);
    const bg = oklchToRgb(lightTheme.secondary);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("muted foreground on background meets AA for large text (>= 3:1)", () => {
    const fg = oklchToRgb(lightTheme.mutedForeground);
    const bg = oklchToRgb(lightTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it("accent foreground on accent meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(lightTheme.accentForeground);
    const bg = oklchToRgb(lightTheme.accent);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive on background meets AA for large text (>= 3:1)", () => {
    const fg = oklchToRgb(lightTheme.destructive);
    const bg = oklchToRgb(lightTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

describe("WCAG AA Color Contrast Audit — Dark Theme", () => {
  it("foreground on background meets AA for normal text (>= 4.5:1)", () => {
    const fg = oklchToRgb(darkTheme.foreground);
    const bg = oklchToRgb(darkTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("card foreground on card background meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(darkTheme.cardForeground);
    const bg = oklchToRgb(darkTheme.card);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("primary foreground on primary meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(darkTheme.primaryForeground);
    const bg = oklchToRgb(darkTheme.primary);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary foreground on secondary meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(darkTheme.secondaryForeground);
    const bg = oklchToRgb(darkTheme.secondary);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("muted foreground on background meets AA for large text (>= 3:1)", () => {
    const fg = oklchToRgb(darkTheme.mutedForeground);
    const bg = oklchToRgb(darkTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it("accent foreground on accent meets AA (>= 4.5:1)", () => {
    const fg = oklchToRgb(darkTheme.accentForeground);
    const bg = oklchToRgb(darkTheme.accent);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive on dark background meets AA for large text (>= 3:1)", () => {
    const fg = oklchToRgb(darkTheme.destructive);
    const bg = oklchToRgb(darkTheme.background);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

describe("WCAG AA — OKLCH conversion sanity checks", () => {
  it("pure white oklch(1 0 0) converts to rgb(255,255,255)", () => {
    const { r, g, b } = oklchToRgb("oklch(1 0 0)");
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  it("pure black oklch(0 0 0) converts to rgb(0,0,0)", () => {
    const { r, g, b } = oklchToRgb("oklch(0 0 0)");
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("white-on-black has maximum contrast (21:1)", () => {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const ratio = contrastRatio(white, black);
    expect(ratio).toBeCloseTo(21, 0);
  });
});
