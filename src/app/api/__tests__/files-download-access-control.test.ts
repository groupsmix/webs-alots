/**
 * Unit tests for the PHI download access-control helpers in
 * `src/app/api/files/download/route.ts`.
 *
 * These pure functions are the primary defense against two classes of
 * attack on an encrypted-PHI download endpoint:
 *
 *   1. Path traversal / key smuggling — `isSafeKey()` is the input gate
 *      for caller-supplied R2 object keys.
 *   2. Cross-tenant access — `expectedDownloadPrefixForProfile()` scopes
 *      each caller to their own `clinics/{clinicId}/` prefix (or all
 *      clinics for `super_admin`).
 *
 * `contentTypeForKey()` and `extractClinicIdFromKey()` are covered too
 * since the former enforces the "HTML is served as octet-stream" XSS
 * mitigation and the latter attributes super_admin downloads to the
 * owning clinic for the audit trail.
 *
 * The handler itself (auth, patient_files ownership, decrypt, audit) is
 * integration-level; here we lock down the pure boundary functions so a
 * regression in traversal/tenant logic is caught by `npm run test`.
 */
import { describe, it, expect } from "vitest";
import {
  isSafeKey,
  expectedDownloadPrefixForProfile,
  contentTypeForKey,
  extractClinicIdFromKey,
} from "@/app/api/files/download/route";
import type { UserRole } from "@/lib/types/database";

const CLINIC_A = "11111111-1111-1111-1111-111111111111";
const CLINIC_B = "22222222-2222-2222-2222-222222222222";

describe("isSafeKey", () => {
  it("accepts a well-formed tenant-scoped key", () => {
    expect(isSafeKey(`clinics/${CLINIC_A}/lab-reports/1700000000-abcd-ef.html`)).toBe(true);
  });

  it("rejects empty / missing keys", () => {
    expect(isSafeKey("")).toBe(false);
  });

  it("rejects path-traversal sequences", () => {
    expect(isSafeKey(`clinics/${CLINIC_A}/../${CLINIC_B}/secret.pdf`)).toBe(false);
    expect(isSafeKey("../../etc/passwd")).toBe(false);
  });

  it("rejects absolute paths (leading slash)", () => {
    expect(isSafeKey(`/clinics/${CLINIC_A}/file.pdf`)).toBe(false);
  });

  it("rejects Windows separators and encoded/raw NUL bytes", () => {
    expect(isSafeKey(`clinics\\${CLINIC_A}\\file.pdf`)).toBe(false);
    expect(isSafeKey(`clinics/${CLINIC_A}/file%00.pdf`)).toBe(false);
    expect(isSafeKey(`clinics/${CLINIC_A}/file\u0000.pdf`)).toBe(false);
  });

  it("rejects control characters", () => {
    expect(isSafeKey(`clinics/${CLINIC_A}/file\n.pdf`)).toBe(false);
    expect(isSafeKey(`clinics/${CLINIC_A}/file\u007f.pdf`)).toBe(false);
  });

  it("rejects characters outside the conservative R2-key alphabet", () => {
    expect(isSafeKey(`clinics/${CLINIC_A}/file name.pdf`)).toBe(false); // space
    expect(isSafeKey(`clinics/${CLINIC_A}/file?x=1.pdf`)).toBe(false); // query smuggling
    expect(isSafeKey(`clinics/${CLINIC_A}/résumé.pdf`)).toBe(false); // non-ASCII homoglyph
  });

  it("rejects absurdly long keys (DoS guard)", () => {
    expect(isSafeKey("a".repeat(1025))).toBe(false);
  });
});

describe("expectedDownloadPrefixForProfile", () => {
  it("scopes a clinic-bound user to their own clinic prefix", () => {
    expect(expectedDownloadPrefixForProfile("doctor", CLINIC_A)).toBe(`clinics/${CLINIC_A}/`);
    expect(expectedDownloadPrefixForProfile("patient", CLINIC_A)).toBe(`clinics/${CLINIC_A}/`);
    expect(expectedDownloadPrefixForProfile("clinic_admin", CLINIC_A)).toBe(`clinics/${CLINIC_A}/`);
  });

  it("grants super_admin access to all clinics", () => {
    expect(expectedDownloadPrefixForProfile("super_admin", null)).toBe("clinics/");
    expect(expectedDownloadPrefixForProfile("super_admin", CLINIC_A)).toBe("clinics/");
  });

  it("returns null for a non-super_admin without a clinic (cannot read anything)", () => {
    expect(expectedDownloadPrefixForProfile("doctor", null)).toBeNull();
    expect(expectedDownloadPrefixForProfile("patient", undefined)).toBeNull();
  });

  it("a clinic A user's prefix does NOT authorize a clinic B key", () => {
    const prefix = expectedDownloadPrefixForProfile("doctor", CLINIC_A);
    expect(prefix).not.toBeNull();
    const clinicBKey = `clinics/${CLINIC_B}/lab-reports/x.html`;
    expect(clinicBKey.startsWith(prefix as string)).toBe(false);
  });
});

describe("contentTypeForKey", () => {
  it("serves HTML/HTM as octet-stream to neutralize stored-XSS via uploaded HTML", () => {
    expect(contentTypeForKey("clinics/x/report.html")).toBe("application/octet-stream");
    expect(contentTypeForKey("clinics/x/report.HTM")).toBe("application/octet-stream");
  });

  it("maps known extensions to their MIME types", () => {
    expect(contentTypeForKey("a/b.pdf")).toBe("application/pdf");
    expect(contentTypeForKey("a/b.png")).toBe("image/png");
    expect(contentTypeForKey("a/b.jpg")).toBe("image/jpeg");
    expect(contentTypeForKey("a/b.jpeg")).toBe("image/jpeg");
    expect(contentTypeForKey("a/b.webp")).toBe("image/webp");
    expect(contentTypeForKey("a/b.json")).toBe("application/json; charset=utf-8");
    expect(contentTypeForKey("a/b.txt")).toBe("text/plain; charset=utf-8");
  });

  it("defaults unknown extensions to octet-stream", () => {
    expect(contentTypeForKey("a/b.bin")).toBe("application/octet-stream");
    expect(contentTypeForKey("a/b")).toBe("application/octet-stream");
  });
});

describe("extractClinicIdFromKey", () => {
  it("extracts the clinic UUID from a tenant-scoped key", () => {
    expect(extractClinicIdFromKey(`clinics/${CLINIC_A}/lab-reports/x.html`)).toBe(CLINIC_A);
  });

  it("returns null for keys that do not match the expected shape", () => {
    expect(extractClinicIdFromKey("uploads/x.html")).toBeNull();
    expect(extractClinicIdFromKey("clinics//x.html")).toBeNull();
    expect(extractClinicIdFromKey("clinics/not-a-uuid/x.html")).toBeNull();
  });

  it("round-trips with expectedDownloadPrefixForProfile for the same clinic", () => {
    const role: UserRole = "doctor";
    const key = `clinics/${CLINIC_A}/docs/report.pdf`;
    const prefix = expectedDownloadPrefixForProfile(role, CLINIC_A);
    expect(key.startsWith(prefix as string)).toBe(true);
    expect(extractClinicIdFromKey(key)).toBe(CLINIC_A);
  });
});
