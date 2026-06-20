/**
 * Unit tests for the access-control boundaries in
 * `src/app/api/patient/documents/route.ts`.
 *
 * The patient-documents endpoint lets a patient register, list and delete
 * `patient_files` rows that point at their own encrypted R2 objects. Two
 * pure boundary functions are the primary defense:
 *
 *   1. `isSafeKey()` — input gate for caller-supplied R2 object keys
 *      (path traversal / control chars / key smuggling).
 *   2. `keyBelongsToClinic()` — cross-tenant guard scoping each caller to
 *      their own `clinics/{clinicId}/` prefix, so a patient cannot claim a
 *      row that points at another clinic's object.
 *
 * `normalizeDocType()` is covered too since it sanitizes the caller-supplied
 * document category before it is persisted.
 *
 * The handlers themselves (auth, patient_id ownership, R2 delete, audit) are
 * integration-level; here we lock down the pure boundaries so a regression in
 * traversal/tenant logic is caught by `npm run test`.
 */
import { describe, it, expect } from "vitest";
import { isSafeKey, keyBelongsToClinic, normalizeDocType } from "@/app/api/patient/documents/route";

const CLINIC_A = "11111111-1111-1111-1111-111111111111";
const CLINIC_B = "22222222-2222-2222-2222-222222222222";

describe("isSafeKey", () => {
  it("accepts a well-formed tenant-scoped key", () => {
    expect(isSafeKey(`clinics/${CLINIC_A}/patient_files/1700000000-abcd.pdf`)).toBe(true);
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

describe("keyBelongsToClinic", () => {
  it("accepts a key under the caller's own clinic prefix", () => {
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}/patient_files/x.pdf`, CLINIC_A)).toBe(true);
  });

  it("rejects a key under another clinic's prefix (cross-tenant)", () => {
    expect(keyBelongsToClinic(`clinics/${CLINIC_B}/patient_files/x.pdf`, CLINIC_A)).toBe(false);
  });

  it("rejects a clinic id used as a substring rather than a path prefix", () => {
    // `clinics/{A}-evil/...` must not satisfy the `clinics/{A}/` prefix.
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}-evil/x.pdf`, CLINIC_A)).toBe(false);
  });

  it("rejects an unsafe key even when the prefix would match", () => {
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}/../${CLINIC_A}/x.pdf`, CLINIC_A)).toBe(false);
  });

  it("rejects when the caller has no clinic context", () => {
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}/x.pdf`, null)).toBe(false);
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}/x.pdf`, undefined)).toBe(false);
    expect(keyBelongsToClinic(`clinics/${CLINIC_A}/x.pdf`, "")).toBe(false);
  });
});

describe("normalizeDocType", () => {
  it("passes through the known document categories", () => {
    for (const t of ["analysis", "radiology", "insurance", "other"]) {
      expect(normalizeDocType(t)).toBe(t);
    }
  });

  it("folds unknown / malformed values to 'other'", () => {
    expect(normalizeDocType("prescription")).toBe("other");
    expect(normalizeDocType("")).toBe("other");
    expect(normalizeDocType(null)).toBe("other");
    expect(normalizeDocType(42)).toBe("other");
    expect(normalizeDocType({ doc_type: "analysis" })).toBe("other");
  });
});
