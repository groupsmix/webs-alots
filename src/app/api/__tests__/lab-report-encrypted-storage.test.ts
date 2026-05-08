/**
 * Regression tests for finding #3 (CRITICAL): lab report storage must use
 * the encrypted PHI path and must only be served via an authenticated
 * download route — never via a public R2 URL.
 *
 * These tests exercise the actual route handlers (POST /api/lab/report-html
 * and GET /api/files/download) with mocked Supabase / R2 / encryption
 * dependencies, asserting:
 *
 *   1. report-html invokes encryptAndUpload (not the plain uploadToR2)
 *   2. The R2 key it writes to is tenant-scoped under
 *      `clinics/{clinicId}/lab-reports/`.
 *   3. The route response and the persisted pdf_url reference the
 *      authenticated download route, not a public/presigned URL.
 *   4. /api/files/download requires authentication.
 *   5. /api/files/download enforces the caller's clinic prefix
 *      (cross-tenant download attempts are rejected with 403).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come before importing the route handlers) ────────────

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
  // No subdomain-derived tenant — let the profile.clinic_id carry the auth.
  getTenant: vi.fn(async () => null),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

const logAuditEventMock = vi.fn(async () => undefined);
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...(args as [])),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const encryptAndUploadMock = vi.fn<(...args: unknown[]) => unknown>();
const downloadAndDecryptMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock("@/lib/r2-encrypted", () => ({
  encryptAndUpload: (...args: unknown[]) => encryptAndUploadMock(...args),
  downloadAndDecrypt: (...args: unknown[]) => downloadAndDecryptMock(...args),
}));

const isEncryptionConfiguredMock = vi.fn<() => boolean>();
vi.mock("@/lib/encryption", () => ({
  isEncryptionConfigured: () => isEncryptionConfiguredMock(),
  encryptBuffer: vi.fn(),
  decryptBuffer: vi.fn(),
}));

const uploadToR2Mock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    ...actual,
    uploadToR2: (...args: unknown[]) => uploadToR2Mock(...args),
    isR2Configured: vi.fn(() => true),
  };
});

const updateLabOrderPdfUrlMock = vi.fn<(...args: unknown[]) => Promise<boolean>>();
vi.mock("@/lib/data/server", () => ({
  updateLabOrderPdfUrl: (...args: unknown[]) => updateLabOrderPdfUrlMock(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────

const CLINIC_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CLINIC_ID = "22222222-2222-2222-2222-222222222222";

function authedAs(role: "doctor" | "clinic_admin" | "patient" | "super_admin", clinicId: string | null) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "auth-user-1", email: "user@test.com" } },
    error: null,
  });
  // The first .single() call inside withAuth fetches the user profile.
  mockChainable.single.mockResolvedValue({
    data: { id: "user-1", role, clinic_id: clinicId },
    error: null,
  });
}

function buildJsonRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

const validReportBody = {
  orderId: "order-1",
  patientName: "Jane Doe",
  orderNumber: "LAB-001",
  results: [
    {
      testName: "Glucose",
      value: "95",
      unit: "mg/dL",
      referenceMin: 70,
      referenceMax: 100,
      flag: "normal",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  encryptAndUploadMock.mockReset();
  downloadAndDecryptMock.mockReset();
  uploadToR2Mock.mockReset();
  updateLabOrderPdfUrlMock.mockReset();
  updateLabOrderPdfUrlMock.mockResolvedValue(true);
  isEncryptionConfiguredMock.mockReset();
  // Default to "encryption configured" for the happy paths; individual
  // tests opt out by overriding the mock.
  isEncryptionConfiguredMock.mockReturnValue(true);
  logAuditEventMock.mockReset();
  logAuditEventMock.mockResolvedValue(undefined);
  mockChainable.single.mockReset();
  mockChainable.maybeSingle.mockReset();
});

// ── POST /api/lab/report-html ────────────────────────────────────────

describe("POST /api/lab/report-html — encrypted PHI storage", () => {
  it("writes through encryptAndUpload (not uploadToR2) under a clinic-scoped key", async () => {
    authedAs("doctor", CLINIC_ID);
    // Order lookup (.maybeSingle) returns the matching tenant-scoped order.
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "order-1", clinic_id: CLINIC_ID, patient_id: "patient-1" },
      error: null,
    });
    encryptAndUploadMock.mockResolvedValueOnce("https://r2.example/clinics/x/lab-reports/abc.html.enc");

    const { POST } = await import("@/app/api/lab/report-html/route");
    const response = await POST(buildJsonRequest("http://t.test/api/lab/report-html", validReportBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);

    // The dangerous helper must NOT be called.
    expect(uploadToR2Mock).not.toHaveBeenCalled();

    // Encrypted upload must be invoked exactly once with a tenant-scoped key.
    expect(encryptAndUploadMock).toHaveBeenCalledTimes(1);
    const [key, buffer, contentType, metadata] = encryptAndUploadMock.mock.calls[0];

    expect(typeof key).toBe("string");
    expect(key as string).toMatch(new RegExp(`^clinics/${CLINIC_ID}/lab-reports/`));
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(contentType).toBe("text/html");
    expect(metadata).toMatchObject({
      clinicId: CLINIC_ID,
      category: "lab-reports",
      patientId: "patient-1",
    });
  });

  it("returns only an authenticated download URL (never the public R2 URL)", async () => {
    authedAs("doctor", CLINIC_ID);
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "order-1", clinic_id: CLINIC_ID, patient_id: "patient-1" },
      error: null,
    });
    const publicR2Url = "https://r2.public.example/clinics/x/lab-reports/abc.html.enc";
    encryptAndUploadMock.mockResolvedValueOnce(publicR2Url);

    const { POST } = await import("@/app/api/lab/report-html/route");
    const response = await POST(buildJsonRequest("http://t.test/api/lab/report-html", validReportBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);

    // The R2 URL must not appear in the response.
    expect(JSON.stringify(json.data)).not.toContain(publicR2Url);
    expect(JSON.stringify(json.data)).not.toContain("r2.public.example");

    // The download URL must be an authenticated route, not a presigned URL.
    expect(json.data.downloadUrl).toMatch(/^\/api\/files\/download\?key=/);
    expect(json.data.pdfUrl).toBe(json.data.downloadUrl);

    // The persisted pdf_url must be the auth route too.
    expect(updateLabOrderPdfUrlMock).toHaveBeenCalledTimes(1);
    const [, persistedUrl] = updateLabOrderPdfUrlMock.mock.calls[0];
    expect(persistedUrl).toMatch(/^\/api\/files\/download\?key=/);
    expect(persistedUrl).not.toContain("https://");
  });

  it("rejects when the lab order does not belong to the caller's clinic", async () => {
    authedAs("doctor", CLINIC_ID);
    // Order lookup is filtered by clinic_id, so a cross-tenant order returns null.
    mockChainable.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import("@/app/api/lab/report-html/route");
    const response = await POST(buildJsonRequest("http://t.test/api/lab/report-html", validReportBody));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(encryptAndUploadMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it("refuses up-front when PHI encryption is not configured (no plaintext upload)", async () => {
    authedAs("doctor", CLINIC_ID);
    isEncryptionConfiguredMock.mockReturnValue(false);
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "order-1", clinic_id: CLINIC_ID, patient_id: "patient-1" },
      error: null,
    });

    const { POST } = await import("@/app/api/lab/report-html/route");
    const response = await POST(buildJsonRequest("http://t.test/api/lab/report-html", validReportBody));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("ENCRYPTION_NOT_CONFIGURED");
    // The dev plaintext fallback inside encryptAndUpload must NEVER be
    // exercised through this route — it would leave the report unreadable
    // to the auth-only download endpoint and (in prod) leak unencrypted PHI.
    expect(encryptAndUploadMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(updateLabOrderPdfUrlMock).not.toHaveBeenCalled();
  });

  it("fails closed (no data: URL fallback) when encrypted storage is unavailable", async () => {
    authedAs("doctor", CLINIC_ID);
    mockChainable.maybeSingle.mockResolvedValueOnce({
      data: { id: "order-1", clinic_id: CLINIC_ID, patient_id: "patient-1" },
      error: null,
    });
    encryptAndUploadMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/lab/report-html/route");
    const response = await POST(buildJsonRequest("http://t.test/api/lab/report-html", validReportBody));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.ok).toBe(false);
    // Critically, no `data:` URL is leaked.
    expect(JSON.stringify(json)).not.toContain("data:text/html");
    expect(updateLabOrderPdfUrlMock).not.toHaveBeenCalled();
  });
});

// ── GET /api/files/download ──────────────────────────────────────────

describe("GET /api/files/download — auth and tenant scoping", () => {
  it("requires authentication", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=clinics/${CLINIC_ID}/lab-reports/x.html`),
    );

    expect(response.status).toBe(401);
    expect(downloadAndDecryptMock).not.toHaveBeenCalled();
  });

  it("rejects keys belonging to a different clinic with 403", async () => {
    authedAs("doctor", CLINIC_ID);

    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=clinics/${OTHER_CLINIC_ID}/lab-reports/x.html`),
    );

    expect(response.status).toBe(403);
    expect(downloadAndDecryptMock).not.toHaveBeenCalled();
  });

  it("rejects path-traversal keys with 400", async () => {
    authedAs("doctor", CLINIC_ID);

    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent("clinics/" + CLINIC_ID + "/../" + OTHER_CLINIC_ID + "/x.html")}`),
    );

    expect(response.status).toBe(400);
    expect(downloadAndDecryptMock).not.toHaveBeenCalled();
  });

  it("returns the decrypted file with HTML content-type and inline disposition for HTML keys", async () => {
    authedAs("doctor", CLINIC_ID);
    downloadAndDecryptMock.mockResolvedValueOnce(Buffer.from("<html>secret</html>", "utf-8"));

    const key = `clinics/${CLINIC_ID}/lab-reports/123-abc-def.html`;
    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent(key)}`),
    );

    expect(response.status).toBe(200);
    // A52.7: HTML files are now served as octet-stream with attachment
    // disposition to prevent XSS via uploaded HTML files.
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment/);
    expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
    // Defense-in-depth XSS hardening: decrypted HTML PHI must be served with a
    // strict per-response CSP, nosniff, and no-referrer so any future un-escaped
    // field cannot become an authenticated stored-XSS sink.
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain("script-src");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(downloadAndDecryptMock).toHaveBeenCalledWith(key);
    expect(await response.text()).toBe("<html>secret</html>");
  });

  it("does not attach a CSP for non-HTML downloads (e.g. PDF)", async () => {
    authedAs("doctor", CLINIC_ID);
    downloadAndDecryptMock.mockResolvedValueOnce(Buffer.from("%PDF-1.4", "utf-8"));

    const key = `clinics/${CLINIC_ID}/lab-reports/123.pdf`;
    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent(key)}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    // Non-HTML PHI is offered as an attachment so the browser doesn't render
    // it — a CSP would be a no-op here, so we don't attach one.
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment/);
    // A52.7: All PHI downloads now receive a strict CSP as defense-in-depth
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("super_admin can download from any clinic", async () => {
    authedAs("super_admin", null);
    downloadAndDecryptMock.mockResolvedValueOnce(Buffer.from("ok", "utf-8"));

    const key = `clinics/${OTHER_CLINIC_ID}/lab-reports/abc.html`;
    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent(key)}`),
    );

    expect(response.status).toBe(200);
    expect(downloadAndDecryptMock).toHaveBeenCalledWith(key);
  });

  it("audit-logs super_admin downloads against the clinic that owns the key", async () => {
    authedAs("super_admin", null);
    downloadAndDecryptMock.mockResolvedValueOnce(Buffer.from("ok", "utf-8"));

    const key = `clinics/${OTHER_CLINIC_ID}/lab-reports/audit.html`;
    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent(key)}`),
    );

    expect(response.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);

    const [params] = logAuditEventMock.mock.calls[0] as unknown as [
      {
        action: string;
        type: string;
        clinicId: string;
        actor: string | null | undefined;
        metadata: { key: string; role: string; crossTenant: boolean; callerClinicId: string | null };
      },
    ];
    expect(params.action).toBe("file_downloaded");
    expect(params.type).toBe("patient");
    // Clinic context comes from the key prefix because super_admin has clinic_id: null.
    expect(params.clinicId).toBe(OTHER_CLINIC_ID);
    expect(params.metadata.key).toBe(key);
    expect(params.metadata.role).toBe("super_admin");
    expect(params.metadata.crossTenant).toBe(true);
    expect(params.metadata.callerClinicId).toBeNull();
  });

  it("audit-logs in-clinic downloads with crossTenant=false", async () => {
    authedAs("doctor", CLINIC_ID);
    downloadAndDecryptMock.mockResolvedValueOnce(Buffer.from("ok", "utf-8"));

    const key = `clinics/${CLINIC_ID}/lab-reports/in-clinic.html`;
    const { GET } = await import("@/app/api/files/download/route");
    const response = await GET(
      buildGetRequest(`http://t.test/api/files/download?key=${encodeURIComponent(key)}`),
    );

    expect(response.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);

    const [params] = logAuditEventMock.mock.calls[0] as unknown as [
      { clinicId: string; metadata: { crossTenant: boolean; callerClinicId: string | null } },
    ];
    expect(params.clinicId).toBe(CLINIC_ID);
    expect(params.metadata.crossTenant).toBe(false);
    expect(params.metadata.callerClinicId).toBe(CLINIC_ID);
  });
});

// ── Pure-helper unit tests ───────────────────────────────────────────

describe("download route helpers", () => {
  it("expectedDownloadPrefixForProfile mirrors upload-side scoping", async () => {
    const { expectedDownloadPrefixForProfile } = await import("@/app/api/files/download/route");

    expect(expectedDownloadPrefixForProfile("doctor", CLINIC_ID)).toBe(`clinics/${CLINIC_ID}/`);
    expect(expectedDownloadPrefixForProfile("clinic_admin", CLINIC_ID)).toBe(`clinics/${CLINIC_ID}/`);
    expect(expectedDownloadPrefixForProfile("patient", CLINIC_ID)).toBe(`clinics/${CLINIC_ID}/`);
    expect(expectedDownloadPrefixForProfile("super_admin", null)).toBe("clinics/");
    expect(expectedDownloadPrefixForProfile("super_admin", CLINIC_ID)).toBe("clinics/");
    expect(expectedDownloadPrefixForProfile("doctor", null)).toBeNull();
  });

  it("extractClinicIdFromKey parses the clinic UUID out of a tenant-scoped key", async () => {
    const { extractClinicIdFromKey } = await import("@/app/api/files/download/route");
    expect(extractClinicIdFromKey(`clinics/${CLINIC_ID}/lab-reports/x.html`)).toBe(CLINIC_ID);
    expect(extractClinicIdFromKey(`clinics/${OTHER_CLINIC_ID}/photos/y.jpg`)).toBe(OTHER_CLINIC_ID);
    // Non-clinic prefixes and malformed UUIDs return null.
    expect(extractClinicIdFromKey("public/shared/x.html")).toBeNull();
    expect(extractClinicIdFromKey("clinics//x.html")).toBeNull();
    expect(extractClinicIdFromKey("clinics/not-a-uuid/x.html")).toBeNull();
    expect(extractClinicIdFromKey("")).toBeNull();
  });

  it("isSafeKey rejects traversal and absolute-path inputs", async () => {
    const { isSafeKey } = await import("@/app/api/files/download/route");
    expect(isSafeKey("")).toBe(false);
    expect(isSafeKey("/etc/passwd")).toBe(false);
    expect(isSafeKey("clinics/x/../../y")).toBe(false);
    expect(isSafeKey("clinics/x\0y")).toBe(false);
    expect(isSafeKey("clinics/abc/lab-reports/file.html")).toBe(true);
  });

  it("contentTypeForKey derives MIME from the key extension", async () => {
    const { contentTypeForKey } = await import("@/app/api/files/download/route");
    // A52.7: HTML files now return octet-stream to prevent XSS
    expect(contentTypeForKey("clinics/x/lab-reports/file.html")).toBe("application/octet-stream");
    expect(contentTypeForKey("clinics/x/lab-reports/file.pdf")).toBe("application/pdf");
    expect(contentTypeForKey("clinics/x/photos/file.jpg")).toBe("image/jpeg");
    expect(contentTypeForKey("clinics/x/files/unknown.xyz")).toBe("application/octet-stream");
  });
});
