/**
 * Regression tests for the upload confirmation route's tenant-prefix check.
 *
 * Pre-fix bug: keys produced by `buildUploadKey()` are
 *   clinics/{clinicId}/{category}/{filename}
 * but the PUT confirmation handler compared against `${clinicId}/`, which
 * never matches. Legitimate clinic uploads were rejected as forbidden,
 * leaving orphaned objects in R2.
 *
 * The fix lives in two layers and we test both:
 *
 *   1. `expectedKeyPrefixForProfile()` — pure helper exposed for unit tests.
 *   2. `PUT /api/upload` — full route handler exercised end-to-end with a
 *      mocked Supabase client and R2 layer, per the AGENTS.md test
 *      conventions ("schema tests are supplementary — always pair with
 *      route handler tests").
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildUploadKey } from "@/lib/r2";
import { expectedKeyPrefixForProfile } from "../upload/route";

// ── Helper-level tests ───────────────────────────────────────────────

describe("expectedKeyPrefixForProfile", () => {
  it("returns the clinic-scoped prefix for staff with a clinic_id", () => {
    expect(expectedKeyPrefixForProfile("clinic_admin", "abc123")).toBe(
      "clinics/abc123/",
    );
    expect(expectedKeyPrefixForProfile("doctor", "abc123")).toBe(
      "clinics/abc123/",
    );
    expect(expectedKeyPrefixForProfile("receptionist", "abc123")).toBe(
      "clinics/abc123/",
    );
  });

  it("returns the shared `clinics/` prefix for super_admin", () => {
    expect(expectedKeyPrefixForProfile("super_admin", null)).toBe("clinics/");
    expect(expectedKeyPrefixForProfile("super_admin", "abc123")).toBe(
      "clinics/",
    );
  });

  it("returns null for non-super-admin staff with no clinic_id", () => {
    expect(expectedKeyPrefixForProfile("doctor", null)).toBeNull();
    expect(expectedKeyPrefixForProfile("doctor", undefined)).toBeNull();
  });

  it("matches keys produced by buildUploadKey() for the same clinic", () => {
    const clinicId = "clinic-uuid-1234";
    const key = buildUploadKey(clinicId, "documents", "file.pdf");
    const prefix = expectedKeyPrefixForProfile("doctor", clinicId);

    expect(prefix).not.toBeNull();
    expect(key.startsWith(prefix as string)).toBe(true);
  });

  it("rejects a key that belongs to a different clinic", () => {
    const ownerClinic = "clinic-A";
    const otherClinic = "clinic-B";
    const otherClinicKey = buildUploadKey(otherClinic, "documents", "file.pdf");
    const prefix = expectedKeyPrefixForProfile("doctor", ownerClinic);

    expect(prefix).not.toBeNull();
    expect(otherClinicKey.startsWith(prefix as string)).toBe(false);
  });

  it("super_admin can confirm uploads from any clinic", () => {
    const key = buildUploadKey("clinic-X", "logos", "logo.png");
    const prefix = expectedKeyPrefixForProfile("super_admin", null);

    expect(prefix).not.toBeNull();
    expect(key.startsWith(prefix as string)).toBe(true);
  });
});

// ── Route-handler-level tests for PUT /api/upload ────────────────────
//
// These tests exercise the full request → auth → validation → handler
// chain so the tenant-prefix contract is enforced end-to-end (not just
// at the helper layer). Per AGENTS.md, schema-only tests are
// insufficient for security-critical multi-tenant boundaries.

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({
  // Profile-derived clinic_id carries the auth in this suite; no subdomain.
  getTenant: vi.fn(async () => null),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const readR2ObjectHeadMock = vi.fn<(...args: unknown[]) => unknown>();
const deleteFromR2Mock = vi.fn<(...args: unknown[]) => unknown>();
const getR2ObjectMetadataMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    ...actual,
    isR2Configured: vi.fn(() => true),
    readR2ObjectHead: (...args: unknown[]) => readR2ObjectHeadMock(...args),
    deleteFromR2: (...args: unknown[]) => deleteFromR2Mock(...args),
    getR2ObjectMetadata: (...args: unknown[]) =>
      getR2ObjectMetadataMock(...args),
  };
});

const OWNER_CLINIC_ID = "abc123";
const OTHER_CLINIC_ID = "other-clinic-999";

// PDF magic bytes (`%PDF`) — must match the route's MAGIC_BYTES table.
const PDF_HEAD = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function authedAs(
  role: "doctor" | "clinic_admin" | "receptionist" | "super_admin",
  clinicId: string | null,
) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "auth-user-1", email: "user@test.com" } },
    error: null,
  });
  // The first .single() call inside withAuth fetches the user's profile.
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

// HeadObject metadata that satisfies the route's size + content-type checks
// for the happy-path tests. Tests that exercise rejection paths can override
// this per-call.
const PDF_METADATA = {
  contentLength: 8,
  contentType: "application/pdf",
};

beforeEach(() => {
  vi.clearAllMocks();
  readR2ObjectHeadMock.mockReset();
  deleteFromR2Mock.mockReset();
  getR2ObjectMetadataMock.mockReset();
  getR2ObjectMetadataMock.mockResolvedValue(PDF_METADATA);
  mockChainable.single.mockReset();
  mockChainable.maybeSingle.mockReset();
});

describe("PUT /api/upload — tenant prefix enforcement", () => {
  it("confirms an upload when a clinic user owns the key (clinics/{clinicId}/...)", async () => {
    authedAs("clinic_admin", OWNER_CLINIC_ID);
    readR2ObjectHeadMock.mockResolvedValueOnce(PDF_HEAD);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        // AUDIT-14: Use non-PHI category since PHI categories are now
        // blocked from presigned upload confirmation.
        key: `clinics/${OWNER_CLINIC_ID}/photos/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, data: { valid: true } });

    // The R2 object must have been head-read (for magic-byte validation)
    // and never deleted on the happy path.
    expect(readR2ObjectHeadMock).toHaveBeenCalledTimes(1);
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("confirms an upload whose key was produced by buildUploadKey() for the caller's clinic", async () => {
    authedAs("doctor", OWNER_CLINIC_ID);
    readR2ObjectHeadMock.mockResolvedValueOnce(PDF_HEAD);

    // Use the production key builder so the test fails if the prefix
    // contract drifts on either side.
    // AUDIT-14: Use non-PHI category since PHI categories are now blocked.
    const realKey = buildUploadKey(OWNER_CLINIC_ID, "photos", "file.pdf");

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({ key: realKey, contentType: "application/pdf" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, data: { valid: true } });
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("rejects with 403 when a clinic user tries to confirm another clinic's key", async () => {
    authedAs("clinic_admin", OWNER_CLINIC_ID);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${OTHER_CLINIC_ID}/documents/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/does not belong to your clinic/i);

    // Forbidden requests must short-circuit before touching R2 — no
    // head-read, no deletion side effects.
    expect(readR2ObjectHeadMock).not.toHaveBeenCalled();
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the key uses a non-clinics/ prefix", async () => {
    authedAs("clinic_admin", OWNER_CLINIC_ID);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        // Pre-fix bug shape: bare `${clinicId}/...` without the `clinics/` root.
        key: `${OWNER_CLINIC_ID}/documents/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(readR2ObjectHeadMock).not.toHaveBeenCalled();
  });

  it("rejects non-super-admin staff with no clinic_id (no expected prefix)", async () => {
    authedAs("doctor", null);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${OWNER_CLINIC_ID}/documents/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(readR2ObjectHeadMock).not.toHaveBeenCalled();
  });

  it("allows super_admin to confirm a key from any clinic under clinics/", async () => {
    authedAs("super_admin", null);
    readR2ObjectHeadMock.mockResolvedValueOnce(PDF_HEAD);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        // AUDIT-14: Use non-PHI category since PHI categories are now blocked.
        key: `clinics/${OTHER_CLINIC_ID}/photos/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, data: { valid: true } });
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("rejects PHI category confirmation with 400 and deletes the unencrypted object", async () => {
    authedAs("clinic_admin", OWNER_CLINIC_ID);

    const { PUT } = await import("../upload/route");
    const response = await PUT(
      buildPutRequest({
        key: `clinics/${OWNER_CLINIC_ID}/documents/file.pdf`,
        contentType: "application/pdf",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/PHI/i);
    // The unencrypted object must be deleted from R2
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(1);
  });
});
