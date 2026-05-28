import { describe, it, expect } from "vitest";
import { assertClinicId, assertTenantMatch } from "../assert-tenant";

describe("assertClinicId", () => {
  it("throws when clinic_id is null", () => {
    expect(() => assertClinicId(null, "appointments.insert")).toThrow(
      '[TENANT SAFETY] clinic_id is required for "appointments.insert" but was null',
    );
  });

  it("throws when clinic_id is undefined", () => {
    expect(() => assertClinicId(undefined, "users.update")).toThrow(
      '[TENANT SAFETY] clinic_id is required for "users.update" but was undefined',
    );
  });

  it("throws when clinic_id is empty string", () => {
    expect(() => assertClinicId("", "prescriptions.delete")).toThrow(
      '[TENANT SAFETY] clinic_id is required for "prescriptions.delete"',
    );
  });

  it("throws when clinic_id is not a valid UUID", () => {
    expect(() => assertClinicId("not-a-uuid", "bookings.select")).toThrow(
      '[TENANT SAFETY] Invalid clinic_id format for "bookings.select": "not-a-uuid"',
    );
  });

  it("does not throw for a valid UUID clinic_id", () => {
    expect(() =>
      assertClinicId("550e8400-e29b-41d4-a716-446655440000", "appointments.insert"),
    ).not.toThrow();
  });

  it("narrows type to string after assertion", () => {
    const clinicId: string | null = "550e8400-e29b-41d4-a716-446655440000";
    assertClinicId(clinicId, "test");
    const _verified: string = clinicId;
    expect(_verified).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("assertTenantMatch", () => {
  const validClinicId = "550e8400-e29b-41d4-a716-446655440000";
  const otherClinicId = "660e8400-e29b-41d4-a716-446655440001";

  it("throws when entity has no clinic_id (null)", () => {
    expect(() => assertTenantMatch(null, validClinicId, "doctor", "appointment.create")).toThrow(
      '[TENANT SAFETY] doctor has no clinic_id during "appointment.create"',
    );
  });

  it("throws when entity has no clinic_id (undefined)", () => {
    expect(() => assertTenantMatch(undefined, validClinicId, "service", "booking.update")).toThrow(
      '[TENANT SAFETY] service has no clinic_id during "booking.update"',
    );
  });

  it("throws when clinic_ids do not match (cross-tenant)", () => {
    expect(() =>
      assertTenantMatch(otherClinicId, validClinicId, "patient", "prescription.create"),
    ).toThrow(
      `[TENANT SAFETY] patient belongs to clinic "${otherClinicId}" but operation "prescription.create" is for clinic "${validClinicId}". Cross-tenant access blocked.`,
    );
  });

  it("does not throw when clinic_ids match", () => {
    expect(() =>
      assertTenantMatch(validClinicId, validClinicId, "doctor", "appointment.create"),
    ).not.toThrow();
  });
});
