/**
 * Regression tests for the upload confirmation route's tenant-prefix check.
 *
 * Pre-fix bug: keys produced by `buildUploadKey()` are
 *   clinics/{clinicId}/{category}/{filename}
 * but the PUT confirmation handler compared against `${clinicId}/`, which
 * never matches. Legitimate clinic uploads were rejected as forbidden,
 * leaving orphaned objects in R2.
 */
import { describe, it, expect } from "vitest";
import { buildUploadKey } from "@/lib/r2";
import { expectedKeyPrefixForProfile } from "../upload/route";

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
