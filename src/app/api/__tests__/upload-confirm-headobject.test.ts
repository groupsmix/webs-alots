/**
 * Regression tests for finding #2 (CRITICAL): the upload confirmation route
 * must perform a HeadObject cross-check on every confirmed direct upload and
 * delete the object when the actual size or Content-Type does not match the
 * declared values.
 *
 * The presigned POST policy is the primary defence (R2 enforces
 * `content-length-range` + `eq $Content-Type` at upload time, see
 * src/lib/__tests__/r2-presigned-post.test.ts). This route-level check is
 * defence-in-depth — without it, a stale or relaxed policy could silently
 * promote an oversized / wrong-type object into the database.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come before importing the route) ─────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: { getUser: vi.fn() },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({ getTenant: vi.fn(async () => null) }));
vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const getR2ObjectMetadataMock = vi.fn<(key: string) => unknown>();
const readR2ObjectHeadMock = vi.fn<(key: string, bytes?: number) => unknown>();
const deleteFromR2Mock = vi.fn<(key: string) => Promise<void>>(async () => undefined);
const getPresignedUploadPostMock = vi.fn<(...args: unknown[]) => unknown>();

vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    ...actual,
    isR2Configured: vi.fn(() => true),
    getR2ObjectMetadata: (key: string) => getR2ObjectMetadataMock(key),
    readR2ObjectHead: (key: string, bytes?: number) => readR2ObjectHeadMock(key, bytes),
    deleteFromR2: (key: string) => deleteFromR2Mock(key),
    getPresignedUploadPost: (...args: unknown[]) => getPresignedUploadPostMock(...args),
    // Real buildUploadKey is preserved via `...actual` so route logic that
    // depends on the `clinics/{id}/...` shape keeps matching.
  };
});

// ── Helpers ──────────────────────────────────────────────────────────

const CLINIC_ID = "11111111-1111-1111-1111-111111111111";

function authedAs(role: string, clinicId: string | null) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "u@test.com" } },
    error: null,
  });
  mockChainable.single.mockResolvedValue({
    data: { id: "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

function buildPutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://t.test/api/upload", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getR2ObjectMetadataMock.mockReset();
  readR2ObjectHeadMock.mockReset();
  deleteFromR2Mock.mockReset();
  deleteFromR2Mock.mockResolvedValue(undefined);
});

// PNG magic bytes (89 50 4E 47 0D 0A 1A 0A) — used by validateFileContent.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ── Tests ────────────────────────────────────────────────────────────

describe("PUT /api/upload — HeadObject confirmation cross-check", () => {
  it("rejects and deletes an upload that exceeds MAX_FILE_SIZE", async () => {
    authedAs("clinic_admin", CLINIC_ID);

    // The pre-signed POST policy is supposed to bound this at 2 MB, but if
    // the policy was stale or relaxed the route must still catch it.
    getR2ObjectMetadataMock.mockResolvedValueOnce({
      contentLength: 5 * 1024 * 1024, // 5 MB
      contentType: "image/png",
    });

    const { PUT } = await import("@/app/api/upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${CLINIC_ID}/photos/file.png`,
        contentType: "image/png",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/too large/i);
    expect(deleteFromR2Mock).toHaveBeenCalledWith(
      `clinics/${CLINIC_ID}/photos/file.png`,
    );
    // The magic-byte fallback must not even be reached when size fails.
    expect(readR2ObjectHeadMock).not.toHaveBeenCalled();
  });

  it("rejects and deletes an upload whose Content-Type does not match the declared type", async () => {
    authedAs("clinic_admin", CLINIC_ID);

    getR2ObjectMetadataMock.mockResolvedValueOnce({
      contentLength: 1024,
      contentType: "text/html", // attacker-supplied via stale presigned URL
    });

    const { PUT } = await import("@/app/api/upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${CLINIC_ID}/photos/file.png`,
        contentType: "image/png",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/content type/i);
    expect(deleteFromR2Mock).toHaveBeenCalledWith(
      `clinics/${CLINIC_ID}/photos/file.png`,
    );
  });

  it("returns 404 when the object cannot be read via HeadObject", async () => {
    authedAs("clinic_admin", CLINIC_ID);
    getR2ObjectMetadataMock.mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${CLINIC_ID}/photos/file.png`,
        contentType: "image/png",
      }),
    );

    expect(response.status).toBe(404);
    // We did not write anything to delete.
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("succeeds when HeadObject confirms a legitimate upload", async () => {
    authedAs("clinic_admin", CLINIC_ID);

    getR2ObjectMetadataMock.mockResolvedValueOnce({
      contentLength: 1024,
      contentType: "image/png",
    });
    readR2ObjectHeadMock.mockResolvedValueOnce(PNG_HEADER);

    const { PUT } = await import("@/app/api/upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${CLINIC_ID}/photos/file.png`,
        contentType: "image/png",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ valid: true });
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant key prefixes before touching R2", async () => {
    authedAs("clinic_admin", CLINIC_ID);

    const { PUT } = await import("@/app/api/upload/route");
    const response = await PUT(
      buildPutRequest({
        key: "clinics/some-other-clinic/photos/file.png",
        contentType: "image/png",
      }),
    );

    expect(response.status).toBe(403);
    expect(getR2ObjectMetadataMock).not.toHaveBeenCalled();
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });
});
