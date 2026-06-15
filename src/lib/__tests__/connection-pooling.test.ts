import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPoolerEndpoint } from "../connection-pooling";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("verifyPoolerEndpoint", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers SUPABASE_POOLER_URL when configured", () => {
    vi.stubEnv(
      "SUPABASE_POOLER_URL",
      "postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(verifyPoolerEndpoint()).toEqual({
      isPooled: true,
      url: "postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
      recommendation: null,
    });
  });

  it("reports degraded when only the public Supabase URL is configured", () => {
    vi.stubEnv("SUPABASE_POOLER_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(verifyPoolerEndpoint()).toEqual({
      isPooled: true,
      url: "https://project.supabase.co",
      recommendation:
        "SUPABASE_POOLER_URL is not set; server code will fall back to the public Supabase URL",
    });
  });

  it("reports missing configuration when neither URL is set", () => {
    vi.stubEnv("SUPABASE_POOLER_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(verifyPoolerEndpoint()).toEqual({
      isPooled: false,
      url: undefined,
      recommendation: "Neither SUPABASE_POOLER_URL nor NEXT_PUBLIC_SUPABASE_URL is set",
    });
  });
});
