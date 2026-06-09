/**
 * Tests for upload-policy.ts — DB-backed upload size limit resolver.
 *
 * Tests:
 *   - clinicIdFromKey() parsing
 *   - limitForClinicCategory() — DB hit returns override
 *   - limitForClinicCategory() — DB miss falls back to platform default
 *   - limitForClinicCategory() — DB error fails open to platform default
 *   - limitForClinicCategory() — clamps to MAX_UPLOAD_BYTES_CEILING
 *   - limitForClinicCategory() — empty clinicId returns platform default
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock createAdminClient before importing the module under test
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helper to wire up the fluent chain
// ---------------------------------------------------------------------------
function setupChain(resolvedValue: unknown) {
  mockMaybeSingle.mockResolvedValue(resolvedValue);
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("clinicIdFromKey", () => {
  it("extracts the clinic ID from a valid key", async () => {
    const { clinicIdFromKey } = await import("../upload-policy");
    expect(clinicIdFromKey("clinics/abc-123/photos/file.jpg")).toBe("abc-123");
  });

  it("returns null for a key that does not start with 'clinics'", async () => {
    const { clinicIdFromKey } = await import("../upload-policy");
    expect(clinicIdFromKey("public/file.jpg")).toBeNull();
  });

  it("returns null for a key with fewer than 4 segments", async () => {
    const { clinicIdFromKey } = await import("../upload-policy");
    expect(clinicIdFromKey("clinics/abc/photos")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const { clinicIdFromKey } = await import("../upload-policy");
    expect(clinicIdFromKey("")).toBeNull();
  });
});

describe("limitForClinicCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the platform default when clinicId is empty", async () => {
    const { limitForClinicCategory } = await import("../upload-policy");
    const result = await limitForClinicCategory("", "photos", 5_000_000);
    expect(result).toBe(5_000_000);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the DB override when found", async () => {
    setupChain({ data: { max_upload_bytes: 10_000_000 }, error: null });
    const { limitForClinicCategory } = await import("../upload-policy");
    const result = await limitForClinicCategory("clinic-uuid", "photos", 5_000_000);
    expect(result).toBe(10_000_000);
  });

  it("falls back to platform default when no policy row exists (data is null)", async () => {
    setupChain({ data: null, error: null });
    const { limitForClinicCategory } = await import("../upload-policy");
    const result = await limitForClinicCategory("clinic-uuid", "photos", 5_000_000);
    expect(result).toBe(5_000_000);
  });

  it("falls back to platform default on DB error", async () => {
    setupChain({ data: null, error: { message: "connection error" } });
    const { limitForClinicCategory } = await import("../upload-policy");
    const result = await limitForClinicCategory("clinic-uuid", "photos", 5_000_000);
    expect(result).toBe(5_000_000);
  });

  it("clamps to MAX_UPLOAD_BYTES_CEILING if DB row exceeds it", async () => {
    const { limitForClinicCategory, MAX_UPLOAD_BYTES_CEILING } = await import("../upload-policy");
    // DB row claims 100 MiB — should be clamped to ceiling (25 MiB)
    setupChain({ data: { max_upload_bytes: 104_857_600 }, error: null });
    const result = await limitForClinicCategory("clinic-uuid", "photos", 5_000_000);
    expect(result).toBe(MAX_UPLOAD_BYTES_CEILING);
    expect(result).toBeLessThanOrEqual(26_214_400); // 25 MiB
  });

  it("falls back to platform default when an exception is thrown", async () => {
    mockMaybeSingle.mockRejectedValue(new Error("unexpected DB failure"));
    mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { limitForClinicCategory } = await import("../upload-policy");
    const result = await limitForClinicCategory("clinic-uuid", "photos", 5_000_000);
    expect(result).toBe(5_000_000);
  });
});
