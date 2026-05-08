/**
 * Regression tests for issue #10 — per-category upload size limits.
 *
 * Pre-fix: a single global `MAX_FILE_SIZE = 2 MB` rejected real clinical
 * payloads (PDFs, scanned scripts, lab reports, radiology). The route now
 * enforces `LIMITS_BY_CATEGORY` so each category gets a realistic cap and
 * unknown categories fall back to `DEFAULT_UPLOAD_LIMIT` (10 MB), bounded
 * by the middleware-level `MAX_BODY_BYTES` (25 MB).
 *
 * These tests exercise the pure helpers; the POST/PUT/GET handlers are
 * covered by `upload-confirm-headobject.test.ts` and
 * `upload-confirm-tenant-prefix.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  LIMITS_BY_CATEGORY,
  DEFAULT_UPLOAD_LIMIT,
  MAX_UPLOAD_BYTES,
  limitForCategory,
  normalizeCategory,
  categoryFromKey,
} from "@/app/api/upload/route";

describe("LIMITS_BY_CATEGORY", () => {
  it("matches the contract documented in issue #10", () => {
    expect(LIMITS_BY_CATEGORY.avatar).toBe(2 * 1024 * 1024);
    expect(LIMITS_BY_CATEGORY.clinic_logo).toBe(2 * 1024 * 1024);
    expect(LIMITS_BY_CATEGORY.lab_report).toBe(10 * 1024 * 1024);
    expect(LIMITS_BY_CATEGORY.radiology).toBe(25 * 1024 * 1024);
    expect(LIMITS_BY_CATEGORY.document).toBe(10 * 1024 * 1024);
  });

  it("never exceeds the global middleware body cap", () => {
    for (const limit of Object.values(LIMITS_BY_CATEGORY)) {
      expect(limit).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    }
  });
});

describe("normalizeCategory", () => {
  it("folds case and hyphens to the canonical lookup key", () => {
    expect(normalizeCategory("Lab-Report")).toBe("lab_report");
    expect(normalizeCategory("X-Rays")).toBe("x_rays");
    expect(normalizeCategory("  documents  ")).toBe("documents");
  });
});

describe("limitForCategory", () => {
  it("returns the configured limit for known categories", () => {
    expect(limitForCategory("avatar")).toBe(2 * 1024 * 1024);
    expect(limitForCategory("logos")).toBe(2 * 1024 * 1024);
    expect(limitForCategory("lab-report")).toBe(10 * 1024 * 1024);
    expect(limitForCategory("radiology")).toBe(25 * 1024 * 1024);
    expect(limitForCategory("X-RAYS")).toBe(25 * 1024 * 1024);
  });

  it("falls back to DEFAULT_UPLOAD_LIMIT for unknown categories", () => {
    expect(limitForCategory("unknown-thing")).toBe(DEFAULT_UPLOAD_LIMIT);
    expect(limitForCategory("uploads")).toBe(DEFAULT_UPLOAD_LIMIT);
  });
});

describe("categoryFromKey", () => {
  it("extracts the category segment from buildUploadKey() output", () => {
    expect(
      categoryFromKey("clinics/abc123/lab_report/2024-01/file.pdf"),
    ).toBe("lab_report");
    expect(
      categoryFromKey("clinics/abc123/radiology/scan.dcm"),
    ).toBe("radiology");
  });

  it("returns null for malformed or non-clinic keys", () => {
    expect(categoryFromKey("abc123/photos/file.png")).toBeNull();
    expect(categoryFromKey("clinics/abc123")).toBeNull();
    expect(categoryFromKey("")).toBeNull();
  });
});
