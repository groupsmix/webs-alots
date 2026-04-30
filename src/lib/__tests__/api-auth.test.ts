import { describe, it, expect, vi, beforeEach } from "vitest";
import { sha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { createClient } from "@/lib/supabase-server";
import { authenticateApiKey } from "../api-auth";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/crypto-utils", () => ({
  sha256Hex: vi.fn(),
  timingSafeEqual: vi.fn(),
}));

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

describe("authenticateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Authorization header", async () => {
    const req = createMockRequest();
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
  });

  it("returns null when Authorization is not Bearer format", async () => {
    const req = createMockRequest("Basic abc123");
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
  });

  it("returns null when Bearer token is empty", async () => {
    const req = createMockRequest("Bearer ");
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
  });

  it("returns null when no matching API keys found", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(sha256Hex).mockResolvedValue("hashed_key");

    const req = createMockRequest("Bearer test-api-key-12345678");
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
  });

  it("returns clinicId when API key matches", async () => {
    const mockUpdateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: vi.fn((cb) => cb({ error: null })),
      }),
    });
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "clinic_api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { clinic_id: "clinic-123", active: true, key_hash: "hashed_key" },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
            update: mockUpdateFn,
          };
        }
        return { select: vi.fn(), update: mockUpdateFn };
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(sha256Hex).mockResolvedValue("hashed_key");
    vi.mocked(timingSafeEqual).mockReturnValue(true);

    const req = createMockRequest("Bearer test-api-key-12345678");
    const result = await authenticateApiKey(req as never);
    // AUDIT-13: authenticateApiKey now returns scopes alongside clinicId
    expect(result).toEqual({ clinicId: "clinic-123", scopes: null });
  });

  it("returns null when key hash does not match any candidate", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { clinic_id: "clinic-123", active: true, key_hash: "different_hash" },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(sha256Hex).mockResolvedValue("hashed_key");
    vi.mocked(timingSafeEqual).mockReturnValue(false);

    const req = createMockRequest("Bearer test-api-key-12345678");
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
  });

  it("skips candidates without key_hash", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { clinic_id: "clinic-1", active: true, key_hash: null },
                  { clinic_id: "clinic-2", active: true, key_hash: "" },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(sha256Hex).mockResolvedValue("hashed_key");

    const req = createMockRequest("Bearer test-api-key-12345678");
    const result = await authenticateApiKey(req as never);
    expect(result).toBeNull();
    expect(timingSafeEqual).not.toHaveBeenCalled();
  });

  it("uses 8-character prefix for key lookup", async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqActive = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEqPrefix = vi.fn().mockReturnValue({ eq: mockEqActive });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEqPrefix,
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(sha256Hex).mockResolvedValue("hashed");

    const req = createMockRequest("Bearer abcdefgh-rest-of-key");
    await authenticateApiKey(req as never);

    expect(mockEqPrefix).toHaveBeenCalledWith("key_prefix", "abcdefgh");
  });
});
