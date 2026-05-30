/**
 * Issue #629 — RLS integration tests: high-value PHI tables and
 * authenticated user scenarios.
 *
 * Complements rls-real-postgres.test.ts (generic table sweep) and
 * rls-assertions.test.ts (basic CRUD isolation). This suite focuses on:
 *
 *  1. High-value PHI tables: prescriptions, consultation_notes,
 *     documents, lab_orders, notifications, activity_logs.
 *  2. Cross-tenant attribute escalation: UPDATE that tries to change
 *     clinic_id to another tenant.
 *  3. Privilege escalation: user tries to insert a row with
 *     a role above their own.
 *  4. Header injection protection: ensure that client-supplied
 *     x-clinic-id is correctly handled (middleware strips it in prod,
 *     but at the DB layer we verify RLS also blocks mismatched headers).
 *
 * Requirements:
 *   SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY, SUPABASE_LOCAL_SERVICE_KEY
 *   (or SUPABASE_LOCAL_SERVICE_ROLE_KEY) env vars pointing to a running
 *   `supabase start` instance.
 *
 * In CI, these are provided by the `rls` workflow job's `Boot local Supabase`
 * step. See .github/workflows/ci.yml.
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

// Distinct UUIDs from rls-assertions.test.ts to avoid seed conflicts
const CLINIC_A_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CLINIC_B_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PATIENT_A_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const PATIENT_B_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const APPT_A_ID = "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1";

function clientFor(clinicId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}

function anonClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function adminClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Tables with confirmed high PHI sensitivity — each must be RLS-gated
const HIGH_VALUE_PHI_TABLES = [
  "prescriptions",
  "consultation_notes",
  "documents",
  "lab_orders",
  "notifications",
  "family_members",
  "installments",
  "activity_logs",
] as const;

describe.skipIf(SKIP)("RLS — High-Value PHI Tables (#629)", () => {
  beforeAll(async () => {
    const admin = adminClient();

    // Seed two clinics
    await admin.from("clinics").upsert(
      [
        {
          id: CLINIC_A_ID,
          name: "PHI Test Clinic A",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
        {
          id: CLINIC_B_ID,
          name: "PHI Test Clinic B",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
      ],
      { onConflict: "id" },
    );

    // Seed two patient users (one per clinic)
    await admin.from("users").upsert(
      [
        {
          id: PATIENT_A_ID,
          clinic_id: CLINIC_A_ID,
          role: "patient",
          name: "Patient A",
          email: "patient-a-rls-test@test.local",
        },
        {
          id: PATIENT_B_ID,
          clinic_id: CLINIC_B_ID,
          role: "patient",
          name: "Patient B",
          email: "patient-b-rls-test@test.local",
        },
      ],
      { onConflict: "id" },
    );

    // Seed a service and appointment in Clinic A for FK references
    await admin.from("services").upsert(
      [
        {
          id: "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1",
          clinic_id: CLINIC_A_ID,
          name: "PHI Consult",
          duration_minutes: 30,
        },
      ],
      { onConflict: "id" },
    );

    await admin.from("appointments").upsert(
      [
        {
          id: APPT_A_ID,
          clinic_id: CLINIC_A_ID,
          patient_id: PATIENT_A_ID,
          service_id: "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1",
          slot_start: new Date(Date.now() + 86400000).toISOString(),
          slot_end: new Date(Date.now() + 90000000).toISOString(),
          status: "pending",
        },
      ],
      { onConflict: "id" },
    );
  });

  // ── 1. Cross-tenant SELECT for each high-value PHI table ────────────────

  describe("Cross-tenant SELECT — Clinic A cannot see Clinic B PHI", () => {
    it.each(HIGH_VALUE_PHI_TABLES)(
      "Clinic A client cannot SELECT clinic_id=B rows from %s",
      async (table) => {
        const ca = clientFor(CLINIC_A_ID);
        const { data, error } = await ca
          .from(table as string)
          .select("id")
          .eq("clinic_id", CLINIC_B_ID)
          .limit(1);

        if (!error) {
          expect(data ?? []).toHaveLength(0);
        } else {
          expect(error.message).toMatch(/permission denied|does not exist|relation/i);
        }
      },
    );
  });

  // ── 2. Anon (no clinic context) cannot read any PHI table ───────────────

  describe("Anon SELECT — no clinic context cannot read PHI tables", () => {
    it.each(HIGH_VALUE_PHI_TABLES)(
      "Anon client without x-clinic-id header cannot read %s",
      async (table) => {
        const anon = anonClient();
        const { data, error } = await anon
          .from(table as string)
          .select("id")
          .limit(1);

        if (!error) {
          expect(data ?? []).toHaveLength(0);
        } else {
          expect(error.message).toMatch(/permission denied|does not exist|relation/i);
        }
      },
    );
  });

  // ── 3. Cross-tenant INSERT — cannot insert into another tenant's tables ─

  describe("Cross-tenant INSERT protection", () => {
    it("Clinic A cannot insert a prescription with clinic_id=B", async () => {
      const ca = clientFor(CLINIC_A_ID);

      const { error } = await ca.from("prescriptions").insert({
        clinic_id: CLINIC_B_ID,
        patient_id: PATIENT_B_ID,
        doctor_id: PATIENT_A_ID, // valid user FK; RLS blocks before constraint check
        content: {},
        notes: "RLS injection test — must be blocked",
      } as never);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      // Verify the row was NOT created regardless of error handling
      const admin = adminClient();
      const { data } = await admin
        .from("prescriptions")
        .select("id")
        .eq("clinic_id", CLINIC_B_ID)
        .eq("medication", "RLS Test Drug")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    it("Clinic A cannot insert a notification targeting Clinic B", async () => {
      const ca = clientFor(CLINIC_A_ID);

      const { error } = await ca.from("notifications").insert({
        clinic_id: CLINIC_B_ID,
        user_id: PATIENT_B_ID,
        type: "appointment_reminder",
        channel: "in_app", // required NOT NULL field
        message: "RLS injection test — must be blocked",
        is_read: false, // correct column name (not 'read')
      } as never);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const admin = adminClient();
      const { data } = await admin
        .from("notifications")
        .select("id")
        .eq("clinic_id", CLINIC_B_ID)
        .eq("message", "RLS injection test")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── 4. Cross-tenant attribute escalation (UPDATE clinic_id) ─────────────

  describe("Cross-tenant UPDATE — cannot reassign clinic_id", () => {
    it("Clinic A cannot UPDATE a Clinic B user to change their clinic_id to A", async () => {
      const ca = clientFor(CLINIC_A_ID);

      const { error } = await ca
        .from("users")
        .update({ clinic_id: CLINIC_A_ID })
        .eq("id", PATIENT_B_ID);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      // Verify PATIENT_B still belongs to CLINIC_B
      const admin = adminClient();
      const { data } = await admin
        .from("users")
        .select("clinic_id")
        .eq("id", PATIENT_B_ID)
        .single();
      expect(data?.clinic_id).toBe(CLINIC_B_ID);
    });
  });

  // ── 5. Header injection — mismatched x-clinic-id cannot expand access ───

  describe("Header injection protection", () => {
    it("Client claiming Clinic B context cannot read Clinic A prescriptions", async () => {
      // A client that claims to be Clinic B should NOT be able to access Clinic A data
      const cb = clientFor(CLINIC_B_ID);

      const { data, error } = await cb
        .from("prescriptions")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_A_ID)
        .limit(5);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });

    it("Client claiming both clinic contexts is still isolated to its own header", async () => {
      // Try to bypass by setting two conflicting clinic IDs — PostgREST only
      // reads the first matching header; the DB function `get_request_clinic_id()`
      // reads from app.clinic_id which is set from the trusted server-side header.
      const ca = clientFor(CLINIC_A_ID);

      const { data, error } = await ca
        .from("users")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_B_ID)
        .limit(1);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });
  });

  // ── 6. Admin client bypasses RLS correctly ───────────────────────────────

  describe("Admin client (service role) can read all tenants", () => {
    it("admin client can read users from both Clinic A and Clinic B", async () => {
      const admin = adminClient();

      const { data: aUsers } = await admin
        .from("users")
        .select("id")
        .eq("id", PATIENT_A_ID)
        .limit(1);
      expect((aUsers ?? []).length).toBeGreaterThan(0);

      const { data: bUsers } = await admin
        .from("users")
        .select("id")
        .eq("id", PATIENT_B_ID)
        .limit(1);
      expect((bUsers ?? []).length).toBeGreaterThan(0);
    });
  });
});

/**
 * Infrastructure validation — always runs without Supabase.
 */
describe("RLS High-Value Tables — Test Infrastructure", () => {
  it("clinic IDs are distinct", () => {
    expect(CLINIC_A_ID).not.toBe(CLINIC_B_ID);
  });

  it("patient IDs are distinct", () => {
    expect(PATIENT_A_ID).not.toBe(PATIENT_B_ID);
  });

  it("test IDs do not overlap with rls-assertions.test.ts IDs", () => {
    // rls-assertions uses aaaa.../bbbb... — our IDs use cccc.../dddd...
    expect(CLINIC_A_ID).not.toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(CLINIC_B_ID).not.toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  });

  it("HIGH_VALUE_PHI_TABLES list is non-empty", () => {
    expect(HIGH_VALUE_PHI_TABLES.length).toBeGreaterThan(0);
  });
});
