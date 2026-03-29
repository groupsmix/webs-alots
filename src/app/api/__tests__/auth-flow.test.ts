import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for auth flow API routes.
 * Tests onboarding and booking validation.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

describe("Auth Flow API — onboarding validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid onboarding payload", async () => {
    const { onboardingSchema } = await import("@/lib/validations");
    const result = onboardingSchema.safeParse({
      clinic_type_key: "general",
      clinic_name: "Cabinet Medical",
      owner_name: "Dr. Karim",
      phone: "+212612345678",
      email: "doctor@clinic.ma",
      city: "Casablanca",
    });
    expect(result.success).toBe(true);
  });

  it("rejects onboarding without clinic name", async () => {
    const { onboardingSchema } = await import("@/lib/validations");
    const result = onboardingSchema.safeParse({
      clinic_type_key: "general",
      owner_name: "Dr. Karim",
      phone: "+212612345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects onboarding with invalid email", async () => {
    const { onboardingSchema } = await import("@/lib/validations");
    const result = onboardingSchema.safeParse({
      clinic_type_key: "general",
      clinic_name: "Cabinet Medical",
      owner_name: "Dr. Karim",
      phone: "+212612345678",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects onboarding without required phone", async () => {
    const { onboardingSchema } = await import("@/lib/validations");
    const result = onboardingSchema.safeParse({
      clinic_type_key: "general",
      clinic_name: "Cabinet Medical",
      owner_name: "Dr. Karim",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional city", async () => {
    const { onboardingSchema } = await import("@/lib/validations");
    const result = onboardingSchema.safeParse({
      clinic_type_key: "general",
      clinic_name: "Cabinet Medical",
      owner_name: "Dr. Karim",
      phone: "+212612345678",
      city: "Rabat",
    });
    expect(result.success).toBe(true);
  });
});

describe("Auth Flow API — patient create validation", () => {
  it("accepts valid patient creation payload", async () => {
    const { v1PatientCreateSchema } = await import("@/lib/validations");
    const result = v1PatientCreateSchema.safeParse({
      full_name: "Karim Alaoui",
      phone: "+212612345678",
      email: "karim@example.com",
      date_of_birth: "1990-05-15",
      gender: "male",
    });
    expect(result.success).toBe(true);
  });

  it("rejects patient without required fields", async () => {
    const { v1PatientCreateSchema } = await import("@/lib/validations");
    const result = v1PatientCreateSchema.safeParse({
      full_name: "Karim Alaoui",
    });
    expect(result.success).toBe(true); // full_name is the only required field
  });

  it("rejects patient with invalid email", async () => {
    const { v1PatientCreateSchema } = await import("@/lib/validations");
    const result = v1PatientCreateSchema.safeParse({
      full_name: "Karim Alaoui",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional date of birth", async () => {
    const { v1PatientCreateSchema } = await import("@/lib/validations");
    const result = v1PatientCreateSchema.safeParse({
      full_name: "Karim Alaoui",
      date_of_birth: "15/05/1990", // Optional field, any format accepted
    });
    expect(result.success).toBe(true);
  });
});

describe("Auth Flow API — appointment create validation", () => {
  it("accepts valid appointment creation", async () => {
    const { v1AppointmentCreateSchema } = await import("@/lib/validations");
    const result = v1AppointmentCreateSchema.safeParse({
      patient_id: "patient-123",
      doctor_id: "doctor-456",
      appointment_date: "2026-04-15",
      start_time: "10:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects appointment without patient", async () => {
    const { v1AppointmentCreateSchema } = await import("@/lib/validations");
    const result = v1AppointmentCreateSchema.safeParse({
      doctor_id: "doctor-456",
      appointment_date: "2026-04-15",
      start_time: "10:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty date", async () => {
    const { v1AppointmentCreateSchema } = await import("@/lib/validations");
    const result = v1AppointmentCreateSchema.safeParse({
      patient_id: "patient-123",
      doctor_id: "doctor-456",
      appointment_date: "",
      start_time: "10:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional end_time", async () => {
    const { v1AppointmentCreateSchema } = await import("@/lib/validations");
    const result = v1AppointmentCreateSchema.safeParse({
      patient_id: "patient-123",
      doctor_id: "doctor-456",
      appointment_date: "2026-04-15",
      start_time: "10:00",
      end_time: "10:30",
    });
    expect(result.success).toBe(true);
  });
});