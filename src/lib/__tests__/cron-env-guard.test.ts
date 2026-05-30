import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertCronAllowedInThisEnv } from "../cron-env-guard";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("assertCronAllowedInThisEnv (audit-4 F-13)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when WORKER_ENV is unset (local dev / preview / tests)", () => {
    vi.stubEnv("WORKER_ENV", "");
    expect(assertCronAllowedInThisEnv("billing")).toBeNull();
  });

  it("returns null when WORKER_ENV is production", () => {
    vi.stubEnv("WORKER_ENV", "production");
    expect(assertCronAllowedInThisEnv("gdpr-purge")).toBeNull();
  });

  it("returns a 503 NextResponse when WORKER_ENV is staging with no opt-in", async () => {
    vi.stubEnv("WORKER_ENV", "staging");
    vi.stubEnv("ALLOW_STAGING_DESTRUCTIVE_CRONS", "");
    const result = assertCronAllowedInThisEnv("billing");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(503);
    const body = await result!.json();
    expect(body.error).toMatch(/Destructive cron disabled in staging/i);
    expect(body.cron).toBe("billing");
  });

  it("returns null in staging when ALLOW_STAGING_DESTRUCTIVE_CRONS=true", () => {
    vi.stubEnv("WORKER_ENV", "staging");
    vi.stubEnv("ALLOW_STAGING_DESTRUCTIVE_CRONS", "true");
    expect(assertCronAllowedInThisEnv("stripe-reconcile")).toBeNull();
  });

  it('treats anything other than the literal string "true" as off', () => {
    vi.stubEnv("WORKER_ENV", "staging");
    for (const value of ["1", "yes", "on", "TRUE", "True"]) {
      vi.stubEnv("ALLOW_STAGING_DESTRUCTIVE_CRONS", value);
      const result = assertCronAllowedInThisEnv("dedup-purge");
      expect(result, `value="${value}" should NOT bypass the guard`).not.toBeNull();
      expect(result?.status).toBe(503);
    }
  });

  it("blocks each of the four destructive cron names independently", async () => {
    vi.stubEnv("WORKER_ENV", "staging");
    vi.stubEnv("ALLOW_STAGING_DESTRUCTIVE_CRONS", "");
    for (const name of [
      "billing",
      "gdpr-purge",
      "stripe-reconcile",
      "dedup-purge",
    ] as const) {
      const result = assertCronAllowedInThisEnv(name);
      expect(result?.status).toBe(503);
      const body = await result!.json();
      expect(body.cron).toBe(name);
    }
  });
});
