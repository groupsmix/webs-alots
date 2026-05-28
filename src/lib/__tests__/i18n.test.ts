import { describe, it, expect, afterEach, vi } from "vitest";
import { t } from "../i18n";

// Keys chosen from the committed locale files:
//   accounting.expenses → translated in en/fr/ar
//   about.aProposDeNotre → present in fr, empty in en and ar
const TRANSLATED_KEY = "accounting.expenses";
const FR_ONLY_KEY = "about.aProposDeNotre";
const FR_ONLY_VALUE = "À propos de notre cabinet";

describe("t() translation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the requested locale's value when present", () => {
    expect(t("en", TRANSLATED_KEY)).toBe("Expenses");
    expect(t("fr", TRANSLATED_KEY)).toBe("Dépenses");
  });

  it("silently falls back to French for empty en/ar keys outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(t("en", FR_ONLY_KEY)).toBe(FR_ONLY_VALUE);
    expect(t("ar", FR_ONLY_KEY)).toBe(FR_ONLY_VALUE);
  });

  it("prefixes a [MISSING] marker for French fallbacks in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(t("en", FR_ONLY_KEY)).toBe(`[MISSING:en:${FR_ONLY_KEY}] ${FR_ONLY_VALUE}`);
    expect(t("ar", FR_ONLY_KEY)).toBe(`[MISSING:ar:${FR_ONLY_KEY}] ${FR_ONLY_VALUE}`);
  });

  it("never marks French itself, even in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(t("fr", FR_ONLY_KEY)).toBe(FR_ONLY_VALUE);
  });

  it("does not mark keys that are translated in the requested locale", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(t("en", TRANSLATED_KEY)).toBe("Expenses");
  });
});
