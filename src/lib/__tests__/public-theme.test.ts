import { describe, it, expect } from "vitest";
import {
  buildPublicThemeStyle,
  publicCardClass,
  readableForeground,
  templateRadius,
} from "@/lib/public-theme";

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

  it("omits --radius when no borderRadius is provided", () => {
    const style = buildPublicThemeStyle(branding) as Record<string, string>;
    expect(style["--radius"]).toBeUndefined();
  });

  it("sets --radius from the template borderRadius token", () => {
    expect((buildPublicThemeStyle(branding, "none") as Record<string, string>)["--radius"]).toBe(
      "0rem",
    );
    expect((buildPublicThemeStyle(branding, "xl") as Record<string, string>)["--radius"]).toBe(
      "0.875rem",
    );
  });
});

describe("templateRadius", () => {
  it("maps every borderRadius token to a concrete rem value", () => {
    expect(templateRadius("none")).toBe("0rem");
    expect(templateRadius("sm")).toBe("0.25rem");
    expect(templateRadius("md")).toBe("0.375rem");
    expect(templateRadius("lg")).toBe("0.5rem");
    expect(templateRadius("xl")).toBe("0.875rem");
    expect(templateRadius("full")).toBe("1.5rem");
  });
});

describe("publicCardClass", () => {
  it("returns distinct, tailwind-merge-friendly classes per cardStyle", () => {
    expect(publicCardClass("bordered")).toContain("border-2");
    expect(publicCardClass("flat")).toContain("shadow-none");
    expect(publicCardClass("elevated")).toContain("shadow-lg");
    expect(publicCardClass("shadow")).toContain("shadow-sm");
  });

  it("gives each cardStyle a unique class string", () => {
    const styles = (["shadow", "bordered", "flat", "elevated"] as const).map(publicCardClass);
    expect(new Set(styles).size).toBe(4);
  });
});
