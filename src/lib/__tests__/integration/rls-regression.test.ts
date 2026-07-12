/**
 * RLS Regression Tests
 *
 * Covers specific tenant-isolation regressions that have been fixed in the
 * past. These should fail loudly if any policy or middleware change reopens
 * a cross-tenant data path.
 *
 * Requires: SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY, SUPABASE_LOCAL_SERVICE_KEY
 * Skipped when env vars are absent (local dev without Docker).
 */
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";
import type { Database } from "@/lib/types/database";

const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ?? process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "";

const SKIP =
  process.env.SKIP_RLS === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY;

const CLINIC_A = "a1111111-1111-1111-1111-111111111111";
const CLINIC_B = "b2222222-2222-2222-2222-222222222222";
const PATIENT_A = "pa111111-1111-1111-1111-111111111111";
const PATIENT_B = "pb222222-2222-2222-2222-222222222222";
const DOCTOR_A = "da111111-1111-1111-1111-111111111111";
const SERVICE_A = "sa111111-1111-1111-1111-111111111111";

function clientFor(clinicId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}

function adminClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe.skipIf(SKIP)("RLS Regression Tests", () => {
  beforeAll(async () => {
    const admin = adminClient();

    await admin.from("clinics").upsert(
      [
        { id: CLINIC_A, name: "Reg Clinic A", type: "doctor", status: "active", tier: "pro" },
        { id: CLINIC_B, name: "Reg Clinic B", type: "doctor", status: "active", tier: "pro" },
      ],
      { onConflict: "id" },
    );

    await admin.from("users").upsert(
      [
        {
          id: PATIENT_A,
          clinic_id: CLINIC_A,
          role: "patient",
          name: "Patient A",
          email: "a@reg.local",
        },
        {
          id: PATIENT_B,
          clinic_id: CLINIC_B,
          role: "patient",
          name: "Patient B",
          email: "b@reg.local",
        },
        {
          id: DOCTOR_A,
          clinic_id: CLINIC_A,
          role: "doctor",
          name: "Doctor A",
          email: "dr-a@reg.local",
        },
      ],
      { onConflict: "id" },
    );

    await admin
      .from("services")
      .upsert(
        { id: SERVICE_A, clinic_id: CLINIC_A, name: "Reg Consult", duration_minutes: 30 },
        { onConflict: "id" },
      );
  });

  it("REG-01: patient cannot read another clinic's prescriptions by patient_id", async () => {
    const admin = adminClient();
    const apptId = "appt-01";
    await admin.from("appointments").upsert(
      {
        id: apptId,
        clinic_id: CLINIC_A,
        patient_id: PATIENT_A,
        service_id: SERVICE_A,
        slot_start: new Date(Date.now() + 86400000).toISOString(),
        slot_end: new Date(Date.now() + 90000000).toISOString(),
        status: "completed",
      } as never,
      { onConflict: "id" },
    );

    await admin.from("prescriptions").upsert(
      {
        id: "rx-01",
        clinic_id: CLINIC_A,
        patient_id: PATIENT_A,
        doctor_id: DOCTOR_A,
        appointment_id: apptId,
        content: { medications: ["paracetamol"] },
      } as never,
      { onConflict: "id" },
    );

    const client = clientFor(CLINIC_B);
    const { data } = await client
      .from("prescriptions")
      .select("id, content")
      .eq("patient_id" as never, PATIENT_A)
      .limit(1);

    expect(data ?? []).toHaveLength(0);
  });

  it("REG-02: user cannot update a row whose clinic_id is hidden by using a known id", async () => {
    const admin = adminClient();
    await admin
      .from("services")
      .upsert(
        { id: "svc-reg-02", clinic_id: CLINIC_B, name: "Target Service", duration_minutes: 15 },
        { onConflict: "id" },
      );

    const client = clientFor(CLINIC_A);
    const { error } = await client
      .from("services")
      .update({ name: "Pwned" })
      .eq("id", "svc-reg-02");

    if (error) {
      expect(error.message).toMatch(/permission|policy|denied/i);
    }

    const { data } = await admin.from("services").select("name").eq("id", "svc-reg-02").single();
    expect(data?.name).toBe("Target Service");
  });

  it("REG-03: anon client cannot list all users by omitting clinic_id filter", async () => {
    const client = clientFor(CLINIC_A);
    const { data } = await client.from("users").select("id, clinic_id").limit(1000);

    expect(data ?? []).toHaveLength(0);
  });

  it("REG-04: changing role column does not bypass RLS", async () => {
    const client = clientFor(CLINIC_B);
    const { error } = await client
      .from("users")
      .update({ role: "clinic_admin" })
      .eq("id", PATIENT_A);

    if (error) {
      expect(error.message).toMatch(/permission|policy|denied/i);
    }

    const admin = adminClient();
    const { data } = await admin.from("users").select("role").eq("id", PATIENT_A).single();
    expect(data?.role).toBe("patient");
  });

  it("REG-05: bulk UPDATE cannot change clinic_id en masse", async () => {
    const client = clientFor(CLINIC_A);
    const { error } = await client
      .from("users")
      .update({ clinic_id: CLINIC_A })
      .eq("clinic_id", CLINIC_B);

    if (error) {
      expect(error.message).toMatch(/permission|policy|denied/i);
    }

    const admin = adminClient();
    const { data } = await admin.from("users").select("id").eq("clinic_id", CLINIC_B).limit(1);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
