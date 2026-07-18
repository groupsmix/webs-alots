import { describe, it, expect } from "vitest";
import { buildPublicThemeStyle, readableForeground } from "@/lib/public-theme";

describe("readableForeground", () => {
  it("returns light (bone) text on dark brand colors", () => {
    expect(readableForeground("#005a3b")).toBe("#f4f1ea"); // dark green
    expect(readableForeground("#1E4DA1")).toBe("#f4f1ea"); // dark blue
    expect(readableForeground("#000000")).toBe("#f4f1ea");
  });

  it("returns dark (ink) text on light brand colors", () => {
    expect(readableForeground("#ffffff")).toBe("#0b0f0e");
    expect(readableForeground("#ffd54a")).toBe("#0b0f0e"); // bright yellow
  });

  it("supports 3-digit hex", () => {
    expect(readableForeground("#fff")).toBe("#0b0f0e");
    expect(readableForeground("#000")).toBe("#f4f1ea");
  });

  it("falls back to light text for invalid input", () => {
    expect(readableForeground("not-a-color")).toBe("#f4f1ea");
    expect(readableForeground("")).toBe("#f4f1ea");
  });
});

describe("buildPublicThemeStyle", () => {
  const branding = {
    primaryColor: "#1E4DA1",
    secondaryColor: "#0F6E56",
    headingFont: "Geist",
    bodyFont: "Geist",
  };

  it("re-maps shadcn theme tokens onto the clinic's brand colors", () => {
    const style = buildPublicThemeStyle(branding) as Record<string, string>;
    expect(style["--primary"]).toBe("#1E4DA1");
    expect(style["--ring"]).toBe("#1E4DA1");
    expect(style["--sidebar-primary"]).toBe("#1E4DA1");
    // dark brand → light foreground
    expect(style["--primary-foreground"]).toBe("#f4f1ea");
    expect(style["--sidebar-primary-foreground"]).toBe("#f4f1ea");
  });

  it("keeps raw brand + font custom properties", () => {
    const style = buildPublicThemeStyle(branding) as Record<string, string>;
    expect(style["--brand-primary"]).toBe("#1E4DA1");
    expect(style["--brand-secondary"]).toBe("#0F6E56");
    expect(style["--brand-heading-font"]).toBe("Geist");
    expect(style["--brand-body-font"]).toBe("Geist");
  });
});
