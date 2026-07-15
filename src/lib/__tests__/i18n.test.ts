import { describe, it, expect, afterEach, vi } from "vitest";
import { t, getDirection, isRTL, isSupportedLocale, LOCALES } from "../i18n";
import { MOROCCO_LOCALE_MAP } from "../utils";

// Mock en and ar locale modules so we have a synthetic empty key for
// fallback tests. The real locale files now have 100% coverage.
vi.mock("../../locales/en.json", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, string> };
  return { default: { ...real.default, "_test.frOnly": "" } };
});
vi.mock("../../locales/ar.json", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, string> };
  return { default: { ...real.default, "_test.frOnly": "" } };
});
vi.mock("../../locales/fr.json", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, string> };
  return { default: { ...real.default, "_test.frOnly": "Valeur de test FR" } };
});

const TRANSLATED_KEY = "accounting.expenses";
const FR_ONLY_KEY = "_test.frOnly";
const FR_ONLY_VALUE = "Valeur de test FR";

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

describe("isSupportedLocale", () => {
  it("accepts every supported locale", () => {
    for (const locale of LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
  });

  it("accepts fr, ar, en explicitly", () => {
    expect(isSupportedLocale("fr")).toBe(true);
    expect(isSupportedLocale("ar")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
  });

  // Guards the ?lang override path: untrusted query/header values that are not
  // a known locale must be rejected so they cannot influence the rendered dir.
  it.each([
    "FR",
    "ar-MA",
    "de",
    "",
    " ar",
    "javascript:alert(1)",
    "fr,ar",
    null,
    undefined,
    123,
    {},
    ["ar"],
  ])("rejects unsupported / malformed value %p", (value) => {
    expect(isSupportedLocale(value as unknown)).toBe(false);
  });
});

describe("locale direction and Morocco formatting", () => {
  it("uses RTL for Arabic and Darija", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("ary")).toBe(true);
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("ary")).toBe("rtl");
  });

  it("uses LTR for French and English", () => {
    expect(isRTL("fr")).toBe(false);
    expect(isRTL("en")).toBe(false);
    expect(getDirection("fr")).toBe("ltr");
    expect(getDirection("en")).toBe("ltr");
  });

  it("uses Morocco locale tags for all supported languages", () => {
    expect(MOROCCO_LOCALE_MAP).toEqual({
      fr: "fr-MA",
      ar: "ar-MA",
      en: "en-MA",
      ary: "ar-MA",
    });
  });
});
