import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("verifyCronSecret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when CRON_SECRET is not set", () => {
    const req = createMockRequest("Bearer some-token");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns null (authorized) when token matches", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const req = createMockRequest("Bearer my-cron-secret");
    const result = verifyCronSecret(req as never);
    expect(result).toBeNull();
  });

  it("returns 401 when token does not match", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const req = createMockRequest("Bearer wrong-secret");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when no Authorization header", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const req = createMockRequest();
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when Authorization header is not Bearer format", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const req = createMockRequest("Basic some-token");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 for empty Bearer token", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const req = createMockRequest("Bearer ");
    const result = verifyCronSecret(req as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
