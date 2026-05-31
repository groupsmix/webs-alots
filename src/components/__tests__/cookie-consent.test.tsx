import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_VERSION,
  getConsentStatus,
  getStoredCookiePreferences,
  persistConsent,
} from "../cookie-consent";

const STORAGE_KEY = "cookie-consent";

const DEFAULT_PREFERENCES = {
  functional: true,
  analytics: false,
  marketing: false,
} as const;

const ALL_ACCEPTED = {
  functional: true,
  analytics: true,
  marketing: true,
} as const;

describe("cookie-consent storage layer (A64)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe("getConsentStatus", () => {
    it("returns missing when nothing is stored", () => {
      expect(getConsentStatus()).toEqual({ kind: "missing" });
    });

    it("returns missing for unparseable JSON", () => {
      localStorage.setItem(STORAGE_KEY, "{not valid json");
      expect(getConsentStatus()).toEqual({ kind: "missing" });
    });

    it("returns missing for an object with unknown shape", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
      expect(getConsentStatus()).toEqual({ kind: "missing" });
    });

    it("migrates legacy 'accepted' string to a fresh envelope", () => {
      localStorage.setItem(STORAGE_KEY, "accepted");
      const status = getConsentStatus();
      expect(status.kind).toBe("fresh");
      if (status.kind === "fresh") {
        expect(status.preferences).toEqual(ALL_ACCEPTED);
      }
    });

    it("migrates legacy 'declined' string to a fresh envelope with defaults", () => {
      localStorage.setItem(STORAGE_KEY, "declined");
      const status = getConsentStatus();
      expect(status.kind).toBe("fresh");
      if (status.kind === "fresh") {
        expect(status.preferences).toEqual(DEFAULT_PREFERENCES);
      }
    });

    it("returns stale-version for a bare CookiePreferences object (v0 schema)", () => {
      // Pre-A64 banner persisted the bare preferences object without a version.
      // We force re-prompt so the user sees the current copy / processor list.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ functional: true, analytics: true, marketing: false }),
      );
      expect(getConsentStatus()).toEqual({ kind: "stale-version" });
    });

    it("returns stale-version when stored version is below CONSENT_VERSION", () => {
      const t = Date.now() - 1000;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION - 1,
          t,
          prefs: { functional: true, analytics: true, marketing: true },
        }),
      );
      expect(getConsentStatus()).toEqual({ kind: "stale-version" });
    });

    it("returns expired when stored more than CONSENT_MAX_AGE_MS ago", () => {
      const t = Date.now() - CONSENT_MAX_AGE_MS - 1;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          t,
          prefs: { functional: true, analytics: true, marketing: false },
        }),
      );
      expect(getConsentStatus()).toEqual({ kind: "expired" });
    });

    it("returns fresh for an in-window envelope at the current version", () => {
      const t = Date.now() - 1000;
      const prefs = { functional: true, analytics: true, marketing: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, t, prefs }));
      expect(getConsentStatus()).toEqual({ kind: "fresh", preferences: prefs, grantedAt: t });
    });

    it("treats consent exactly at the expiry boundary as fresh, one ms past as expired", () => {
      // Boundary: age === CONSENT_MAX_AGE_MS is still fresh.
      const now = 1_700_000_000_000;
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const tEdge = now - CONSENT_MAX_AGE_MS;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          t: tEdge,
          prefs: DEFAULT_PREFERENCES,
        }),
      );
      expect(getConsentStatus().kind).toBe("fresh");

      const tJustPast = now - CONSENT_MAX_AGE_MS - 1;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          t: tJustPast,
          prefs: DEFAULT_PREFERENCES,
        }),
      );
      expect(getConsentStatus().kind).toBe("expired");
    });

    it("ignores an envelope whose prefs field is missing or wrong shape", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: CONSENT_VERSION, t: Date.now(), prefs: { functional: true } }),
      );
      expect(getConsentStatus()).toEqual({ kind: "missing" });
    });
  });

  describe("getStoredCookiePreferences", () => {
    it("returns defaults when nothing is stored", () => {
      expect(getStoredCookiePreferences()).toEqual(DEFAULT_PREFERENCES);
    });

    it("returns defaults for a stale-version record (forces re-prompt path)", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ functional: true, analytics: true, marketing: true }),
      );
      expect(getStoredCookiePreferences()).toEqual(DEFAULT_PREFERENCES);
    });

    it("returns defaults for an expired record", () => {
      const t = Date.now() - CONSENT_MAX_AGE_MS - 60_000;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          t,
          prefs: { functional: true, analytics: true, marketing: true },
        }),
      );
      expect(getStoredCookiePreferences()).toEqual(DEFAULT_PREFERENCES);
    });

    it("returns stored preferences when status is fresh", () => {
      const prefs = { functional: true, analytics: true, marketing: false };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: CONSENT_VERSION, t: Date.now(), prefs }),
      );
      expect(getStoredCookiePreferences()).toEqual(prefs);
    });
  });

  describe("persistConsent", () => {
    it("writes a versioned envelope that round-trips to fresh status", () => {
      const now = 1_700_000_000_000;
      const prefs = { functional: true, analytics: true, marketing: true };
      persistConsent(prefs, now);

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string)).toEqual({ v: CONSENT_VERSION, t: now, prefs });

      vi.useFakeTimers();
      vi.setSystemTime(now + 1000);
      const status = getConsentStatus();
      expect(status).toEqual({ kind: "fresh", preferences: prefs, grantedAt: now });
    });

    it("overwrites any prior stored value", () => {
      localStorage.setItem(STORAGE_KEY, "accepted");
      const now = Date.now();
      persistConsent(DEFAULT_PREFERENCES, now);

      const status = getConsentStatus();
      expect(status.kind).toBe("fresh");
      if (status.kind === "fresh") {
        expect(status.preferences).toEqual(DEFAULT_PREFERENCES);
      }
    });
  });

  describe("CONSENT_MAX_AGE_MS", () => {
    it("equals 12 months in milliseconds (ICO + CNIL guidance)", () => {
      expect(CONSENT_MAX_AGE_MS).toBe(365 * 24 * 60 * 60 * 1000);
    });
  });
});
