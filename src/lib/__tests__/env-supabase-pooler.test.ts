import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceSupabasePoolerConfigured, getSupabasePoolerUrl } from "../env";

describe("getSupabasePoolerUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns undefined when SUPABASE_POOLER_URL is unset", () => {
    vi.stubEnv("SUPABASE_POOLER_URL", "");
    expect(getSupabasePoolerUrl()).toBeUndefined();
  });

  it("normalizes whitespace-only SUPABASE_POOLER_URL to undefined", () => {
    vi.stubEnv("SUPABASE_POOLER_URL", "   ");
    expect(getSupabasePoolerUrl()).toBeUndefined();
  });

  it("returns the trimmed pooler URL when configured", () => {
    vi.stubEnv(
      "SUPABASE_POOLER_URL",
      "  postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres  ",
    );

    expect(getSupabasePoolerUrl()).toBe(
      "postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    );
  });
});

describe("enforceSupabasePoolerConfigured", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when SUPABASE_POOLER_URL is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_POOLER_URL", "");

    expect(() => enforceSupabasePoolerConfigured()).toThrow(/SUPABASE_POOLER_URL is required/i);
  });

  it("does not throw in production when SUPABASE_POOLER_URL is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "SUPABASE_POOLER_URL",
      "postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    );

    expect(() => enforceSupabasePoolerConfigured()).not.toThrow();
  });

  it("does not throw outside production when SUPABASE_POOLER_URL is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_POOLER_URL", "");

    expect(() => enforceSupabasePoolerConfigured()).not.toThrow();
  });
});
