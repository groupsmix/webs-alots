/**
 * Cross-Tenant API Smoke Tests (Phase 2.4)
 *
 * Verifies that RLS policies enforce complete tenant isolation across
 * all CRUD operations using a live Supabase instance.
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

// Unique UUIDs for this test suite to avoid conflicts with others
const CLINIC_X_ID = "11110000-1111-1111-1111-111100001111";
const CLINIC_Y_ID = "22220000-2222-2222-2222-222200002222";
const DOCTOR_X_ID = "33330000-3333-3333-3333-333300003333";
const DOCTOR_Y_ID = "44440000-4444-4444-4444-444400004444";
const PATIENT_X_ID = "55550000-5555-5555-5555-555500005555";
const PATIENT_Y_ID = "66660000-6666-6666-6666-666600006666";
const SERVICE_X_ID = "77770000-7777-7777-7777-777700007777";
const SERVICE_Y_ID = "88880000-8888-8888-8888-888800008888";

function clientForClinic(clinicId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}

function adminClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe.skipIf(SKIP)("Cross-Tenant API Smoke Tests", () => {
  beforeAll(async () => {
    const admin = adminClient();

    // 1. Seed two clinics
    await admin.from("clinics").upsert(
      [
        {
          id: CLINIC_X_ID,
          name: "Clinic X (Smoke Test)",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
        {
          id: CLINIC_Y_ID,
          name: "Clinic Y (Smoke Test)",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
      ],
      { onConflict: "id" },
    );

    // 2. Seed doctors and patients
    await admin.from("users").upsert(
      [
        {
          id: DOCTOR_X_ID,
          clinic_id: CLINIC_X_ID,
          role: "doctor",
          name: "Doctor X",
          email: "doctor-x@oltigo-test.local",
        },
        {
          id: DOCTOR_Y_ID,
          clinic_id: CLINIC_Y_ID,
          role: "doctor",
          name: "Doctor Y",
          email: "doctor-y@oltigo-test.local",
        },
        {
          id: PATIENT_X_ID,
          clinic_id: CLINIC_X_ID,
          role: "patient",
          name: "Patient X",
          email: "patient-x@oltigo-test.local",
        },
        {
          id: PATIENT_Y_ID,
          clinic_id: CLINIC_Y_ID,
          role: "patient",
          name: "Patient Y",
          email: "patient-y@oltigo-test.local",
        },
      ],
      { onConflict: "id" },
    );

    // 3. Seed services
    await admin.from("services").upsert(
      [
        {
          id: SERVICE_X_ID,
          clinic_id: CLINIC_X_ID,
          name: "Service X",
          duration_minutes: 30,
        },
        {
          id: SERVICE_Y_ID,
          clinic_id: CLINIC_Y_ID,
          name: "Service Y",
          duration_minutes: 30,
        },
      ],
      { onConflict: "id" },
    );
  });

  it("Cross-tenant SELECT — services: Clinic X anon client reads services filtered by clinic_id=Y → must get 0 rows", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);
    const { data, error } = await clientX
      .from("services")
      .select("id, clinic_id")
      .eq("clinic_id", CLINIC_Y_ID);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Cross-tenant SELECT — users: Clinic X anon client reads users filtered by clinic_id=Y → must get 0 rows", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);
    const { data, error } = await clientX
      .from("users")
      .select("id, clinic_id")
      .eq("clinic_id", CLINIC_Y_ID);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("Cross-tenant INSERT — appointments: Clinic X anon client inserts an appointment with clinic_id=Y → must fail", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    const { error } = await clientX.from("appointments").insert({
      id: "f8f8f8f8-f8f8-f8f8-f8f8-f8f8f8f8f8f8",
      clinic_id: CLINIC_Y_ID,
      patient_id: PATIENT_Y_ID,
      service_id: SERVICE_Y_ID,
      slot_start: futureDate,
      slot_end: new Date(Date.now() + 86400000 * 5 + 1800000).toISOString(),
      status: "pending",
    } as Record<string, unknown>);

    // RLS should deny insertion or block it
    if (error) {
      expect(error.message).toMatch(/policy|permission|violates|denied/i);
    }

    // Double check with admin that the record was not created
    const admin = adminClient();
    const { data } = await admin
      .from("appointments")
      .select("id")
      .eq("id", "f8f8f8f8-f8f8-f8f8-f8f8-f8f8f8f8f8f8");
    expect(data ?? []).toHaveLength(0);
  });

  it("Cross-tenant INSERT — users: Clinic X anon client inserts a user with clinic_id=Y → must fail", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);

    const { error } = await clientX.from("users").insert({
      id: "f9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9",
      clinic_id: CLINIC_Y_ID,
      role: "patient",
      name: "Injected User",
      email: "injected-user@oltigo-test.local",
    });

    if (error) {
      expect(error.message).toMatch(/policy|permission|violates|denied/i);
    }

    const admin = adminClient();
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("id", "f9f9f9f9-f9f9-f9f9-f9f9-f9f9f9f9f9f9");
    expect(data ?? []).toHaveLength(0);
  });

  it("Cross-tenant UPDATE — user role escalation: Clinic X anon client tries to UPDATE Clinic Y user's role to 'clinic_admin' → must fail", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);

    const { error } = await clientX
      .from("users")
      .update({ role: "clinic_admin" } as Record<string, unknown>)
      .eq("id", DOCTOR_Y_ID);

    if (error) {
      expect(error.message).toMatch(/policy|permission|violates|denied/i);
    }

    // Admin verifies that the role remains 'doctor'
    const admin = adminClient();
    const { data } = await admin.from("users").select("role").eq("id", DOCTOR_Y_ID).single();
    expect(data?.role).toBe("doctor");
  });

  it("Cross-tenant DELETE — services: Clinic X anon client tries to DELETE Clinic Y's service → must fail", async () => {
    const clientX = clientForClinic(CLINIC_X_ID);

    const { error } = await clientX.from("services").delete().eq("id", SERVICE_Y_ID);

    if (error) {
      expect(error.message).toMatch(/policy|permission|violates|denied/i);
    }

    // Admin verifies the service still exists
    const admin = adminClient();
    const { data } = await admin.from("services").select("id").eq("id", SERVICE_Y_ID);
    expect(data ?? []).toHaveLength(1);
  });

  it("Admin client can read both tenants", async () => {
    const admin = adminClient();

    const { data: users, error: userError } = await admin
      .from("users")
      .select("id, name")
      .in("id", [DOCTOR_X_ID, DOCTOR_Y_ID]);

    expect(userError).toBeNull();
    expect(users ?? []).toHaveLength(2);
  });
});

describe("Cross-Tenant API Smoke Test Infrastructure", () => {
  it("test clinic IDs are valid and distinct", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(CLINIC_X_ID).toMatch(uuidRegex);
    expect(CLINIC_Y_ID).toMatch(uuidRegex);
    expect(CLINIC_X_ID).not.toEqual(CLINIC_Y_ID);
  });
});
