import { randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyCronSecret } from "../cron-auth";

function createMockRequest(authHeader?: string): { headers: { get: (name: string) => string | null } } {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "authorization") return authHeader ?? null;
        return null;
      },
    },
  };
}

const TEST_SECRET = randomBytes(32).toString("hex");

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when CRON_SECRET is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = createMockRequest("Bearer some-token");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns null (authorized) when token matches", () => {
    vi.stubEnv("CRON_SECRET", TEST_SECRET);
    const req = createMockRequest(`Bearer ${TEST_SECRET}`);
    const result = verifyCronSecret(req as never);
    expect(result).toBeNull();
  });

  it("returns 401 when token does not match", () => {
    vi.stubEnv("CRON_SECRET", TEST_SECRET);
    const req = createMockRequest("Bearer wrong-secret");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when no Authorization header", () => {
    vi.stubEnv("CRON_SECRET", TEST_SECRET);
    const req = createMockRequest();
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when Authorization header is not Bearer format", () => {
    vi.stubEnv("CRON_SECRET", TEST_SECRET);
    const req = createMockRequest("Basic some-token");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 for empty Bearer token", () => {
    vi.stubEnv("CRON_SECRET", TEST_SECRET);
    const req = createMockRequest("Bearer ");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
