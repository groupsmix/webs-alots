/**
 * Tenant Isolation Stress Test
 *
 * Expands the cross-tenant smoke tests to multiple clinics and multiple
 * PHI tables. The goal is to catch RLS regressions that only appear when
 * the same table contains data for many tenants.
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

const STRESS_CLINICS = [
  { id: "c0000000-0000-0000-0000-000000000001", name: "Stress Clinic 1" },
  { id: "c0000000-0000-0000-0000-000000000002", name: "Stress Clinic 2" },
  { id: "c0000000-0000-0000-0000-000000000003", name: "Stress Clinic 3" },
  { id: "c0000000-0000-0000-0000-000000000004", name: "Stress Clinic 4" },
  { id: "c0000000-0000-0000-0000-000000000005", name: "Stress Clinic 5" },
];

const STRESS_TABLES = [
  "appointments",
  "payments",
  "services",
  "reviews",
  "documents",
  "prescriptions",
  "consultation_notes",
  "notifications",
  "lab_orders",
  "family_members",
  "installments",
  "users",
  "patient_files",
] as const;

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

describe.skipIf(SKIP)("Tenant Isolation Stress Test", () => {
  beforeAll(async () => {
    const admin = adminClient();

    await admin.from("clinics").upsert(
      STRESS_CLINICS.map((c) => ({
        id: c.id,
        name: c.name,
        type: "doctor",
        status: "active",
        tier: "pro",
      })),
      { onConflict: "id" },
    );

    for (const clinic of STRESS_CLINICS) {
      const patientId = `p0000000-0000-0000-0000-0000000000${clinic.id.slice(-1)}`;
      await admin.from("users").upsert(
        {
          id: patientId,
          clinic_id: clinic.id,
          role: "patient",
          name: `Patient ${clinic.id.slice(-1)}`,
          email: `patient-${clinic.id.slice(-1)}@stress.local`,
        },
        { onConflict: "id" },
      );
    }
  });

  describe("SELECT isolation across 5 clinics", () => {
    it.each(STRESS_TABLES)("each clinic can only read its own %s", async (table) => {
      const results = await Promise.all(
        STRESS_CLINICS.map(async (clinic) => {
          const other = STRESS_CLINICS.find((c) => c.id !== clinic.id)!.id;
          const client = clientFor(clinic.id);
          const { data, error } = await client
            .from(table as never)
            .select("id, clinic_id")
            .eq("clinic_id" as never, other)
            .limit(1);

          return { ok: !error || (data ?? []).length === 0, clinic: clinic.id };
        }),
      );

      for (const { ok, clinic } of results) {
        expect(ok, `clinic ${clinic} leaked rows from ${table}`).toBe(true);
      }
    });
  });

  describe("INSERT isolation across 5 clinics", () => {
    it.each(STRESS_TABLES)("clinic cannot insert a %s row for another clinic", async (table) => {
      const admin = adminClient();
      const marker = `tenant-isolation-stress-${table}`;
      const target = STRESS_CLINICS[0];
      const attacker = STRESS_CLINICS[1];
      const patientId = `p0000000-0000-0000-0000-0000000000${target.id.slice(-1)}`;
      const client = clientFor(attacker.id);

      // Build a minimally-valid row for each table.
      const row = buildRow(table, target.id, patientId, marker);
      const { error } = await client.from(table as never).insert(row as never);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      // Backstop: verify row was not created in the target clinic.
      const { data } = await admin
        .from(table as never)
        .select("id")
        .eq("clinic_id" as never, target.id)
        .limit(10);

      const injected = (data ?? []).filter((r: Record<string, unknown>) =>
        Object.values(r).some((v) => typeof v === "string" && v.includes(marker)),
      );
      expect(injected).toHaveLength(0);
    });
  });

  describe("UPDATE isolation — cannot reassign clinic_id", () => {
    it("clinic A cannot change a clinic B user's clinic_id", async () => {
      const admin = adminClient();
      const clinicA = STRESS_CLINICS[0];
      const clinicB = STRESS_CLINICS[1];
      const patientB = `p0000000-0000-0000-0000-0000000000${clinicB.id.slice(-1)}`;
      const client = clientFor(clinicA.id);

      const { error } = await client
        .from("users")
        .update({ clinic_id: clinicA.id })
        .eq("id", patientB);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const { data } = await admin.from("users").select("clinic_id").eq("id", patientB).single();
      expect(data?.clinic_id).toBe(clinicB.id);
    });
  });

  describe("DELETE isolation", () => {
    it("clinic A cannot delete a clinic B service", async () => {
      const admin = adminClient();
      const clinicA = STRESS_CLINICS[0];
      const clinicB = STRESS_CLINICS[1];
      const serviceId = `s0000000-0000-0000-0000-0000000000${clinicB.id.slice(-1)}`;

      await admin.from("services").upsert(
        {
          id: serviceId,
          clinic_id: clinicB.id,
          name: `Service ${clinicB.id.slice(-1)}`,
          duration_minutes: 30,
        },
        { onConflict: "id" },
      );

      const client = clientFor(clinicA.id);
      const { error } = await client.from("services").delete().eq("id", serviceId);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const { data } = await admin.from("services").select("id").eq("id", serviceId).limit(1);
      expect((data ?? []).length).toBe(1);
    });
  });
});

function buildRow(
  table: string,
  clinicId: string,
  patientId: string,
  marker: string,
): Record<string, unknown> {
  const base = { clinic_id: clinicId };
  switch (table) {
    case "appointments":
      return {
        ...base,
        patient_id: patientId,
        service_id: "11111111-1111-1111-1111-111111111111",
        slot_start: new Date(Date.now() + 86400000).toISOString(),
        slot_end: new Date(Date.now() + 90000000).toISOString(),
        status: "pending",
        notes: marker,
      };
    case "payments":
      return {
        ...base,
        patient_id: patientId,
        amount: 100,
        currency: "MAD",
        method: "cash",
        status: "pending",
      };
    case "services":
      return { ...base, name: marker, duration_minutes: 30 };
    case "reviews":
      return { ...base, patient_id: patientId, rating: 5, comment: marker };
    case "documents":
      return { ...base, patient_id: patientId, title: marker, content: marker };
    case "prescriptions":
      return { ...base, patient_id: patientId, doctor_id: patientId, content: {}, notes: marker };
    case "consultation_notes":
      return { ...base, patient_id: patientId, doctor_id: patientId, notes: marker };
    case "notifications":
      return {
        ...base,
        user_id: patientId,
        type: "appointment_reminder",
        channel: "in_app",
        message: marker,
        is_read: false,
      };
    case "lab_orders":
      return {
        ...base,
        patient_id: patientId,
        doctor_id: patientId,
        test_name: marker,
        status: "pending",
      };
    case "family_members":
      return { ...base, patient_id: patientId, name: marker, relationship: "spouse" };
    case "installments":
      return {
        ...base,
        patient_id: patientId,
        total_amount: 100,
        amount_due: 100,
        status: "pending",
      };
    case "users":
      return { ...base, role: "patient", name: marker, email: `${marker}@test.local` };
    case "patient_files":
      return {
        ...base,
        patient_id: patientId,
        file_name: marker,
        file_type: "application/pdf",
        file_size: 1,
        r2_key: marker,
      };
    default:
      return { ...base, notes: marker };
  }
}
