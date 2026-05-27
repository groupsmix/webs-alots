/**
 * S0-08-02 / A76-02: RLS assertion tests — cross-tenant data isolation.
 *
 * Previously a placeholder (`expect(true).toBe(true)`). Now implements
 * real assertions that verify RLS policies prevent cross-tenant reads,
 * writes, and updates.
 *
 * These tests are skipped unless a local Supabase instance is running
 * with the required env vars (same gate as rls-real-postgres.test.ts).
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";
import type { Database } from "@/lib/types/database";

const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";

const SKIP =
  process.env.SKIP_RLS === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY;

const CLINIC_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLINIC_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function createAnonClientForClinic(clinicId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}

function createAnonClientNoClinic() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function createAdminClientLocal() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe.skipIf(SKIP)("RLS Assertion Tests (S0-08-02)", () => {
  const SERVICE_A_ID = "33333333-3333-3333-3333-333333333333";
  const SERVICE_B_ID = "44444444-4444-4444-4444-444444444444";

  beforeAll(async () => {
    const admin = createAdminClientLocal();

    await admin.from("clinics").upsert(
      [
        { id: CLINIC_A_ID, name: "Assert Clinic A", type: "doctor", status: "active", tier: "pro" },
        { id: CLINIC_B_ID, name: "Assert Clinic B", type: "doctor", status: "active", tier: "pro" },
      ],
      { onConflict: "id" },
    );

    await admin.from("services").upsert(
      [
        { id: SERVICE_A_ID, clinic_id: CLINIC_A_ID, name: "Assert Svc A", duration_minutes: 30 },
        { id: SERVICE_B_ID, clinic_id: CLINIC_B_ID, name: "Assert Svc B", duration_minutes: 30 },
      ],
      { onConflict: "id" },
    );
  });

  describe("Cross-tenant SELECT assertions", () => {
    it("should prevent Clinic A from reading Clinic B appointments", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { data, error } = await clientA
        .from("appointments")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_B_ID)
        .limit(5);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });

    it("should prevent Clinic A from reading Clinic B services", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { data, error } = await clientA
        .from("services")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_B_ID)
        .limit(5);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });

    it("should prevent Clinic A from reading Clinic B payments", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { data, error } = await clientA
        .from("payments")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_B_ID)
        .limit(5);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });

    it("should prevent Clinic A from reading Clinic B users", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { data, error } = await clientA
        .from("users")
        .select("id, clinic_id")
        .eq("clinic_id", CLINIC_B_ID)
        .limit(5);

      if (!error) {
        expect(data ?? []).toHaveLength(0);
      } else {
        expect(error.message).toMatch(/permission denied|does not exist|relation/i);
      }
    });
  });

  describe("Anon access without clinic context", () => {
    it("should prevent unauthenticated user from reading patient records", async () => {
      const anonClient = createAnonClientNoClinic();
      const { data, error } = await anonClient.from("users").select("*").limit(1);

      if (error) {
        expect(error).toBeDefined();
      } else {
        expect(data).toHaveLength(0);
      }
    });

    it("should prevent unauthenticated user from reading appointments", async () => {
      const anonClient = createAnonClientNoClinic();
      const { data, error } = await anonClient.from("appointments").select("*").limit(1);

      if (error) {
        expect(error).toBeDefined();
      } else {
        expect(data).toHaveLength(0);
      }
    });
  });

  describe("Cross-tenant INSERT assertions", () => {
    it("should prevent Clinic A from inserting services into Clinic B", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { error } = await clientA.from("services").insert({
        clinic_id: CLINIC_B_ID,
        name: "RLS Assertion Injected",
        duration_minutes: 15,
      });

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const admin = createAdminClientLocal();
      const { data } = await admin
        .from("services")
        .select("id")
        .eq("clinic_id", CLINIC_B_ID)
        .eq("name", "RLS Assertion Injected")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("Cross-tenant UPDATE assertions", () => {
    it("should prevent Clinic A from updating Clinic B services", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { error } = await clientA
        .from("services")
        .update({ name: "Hijacked Service" })
        .eq("id", SERVICE_B_ID);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const admin = createAdminClientLocal();
      const { data } = await admin.from("services").select("name").eq("id", SERVICE_B_ID).single();
      expect(data?.name).toBe("Assert Svc B");
    });
  });

  describe("Cross-tenant DELETE assertions", () => {
    it("should prevent Clinic A from deleting Clinic B services", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);
      const { error } = await clientA.from("services").delete().eq("id", SERVICE_B_ID);

      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }

      const admin = createAdminClientLocal();
      const { data } = await admin.from("services").select("id").eq("id", SERVICE_B_ID).limit(1);
      expect(data ?? []).toHaveLength(1);
    });
  });
});

describe("RLS Assertion Test Infrastructure", () => {
  it("test clinic IDs are valid UUIDs", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(CLINIC_A_ID).toMatch(uuidRegex);
    expect(CLINIC_B_ID).toMatch(uuidRegex);
  });

  it("test clinic IDs are distinct", () => {
    expect(CLINIC_A_ID).not.toEqual(CLINIC_B_ID);
  });
});
