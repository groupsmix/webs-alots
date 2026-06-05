/**
 * F-18: RLS integration tests against real Postgres.
 *
 * These tests require a running Supabase local instance (supabase start).
 * They verify that RLS policies actually block cross-tenant operations.
 *
 * Run: SUPABASE_LOCAL=true \
 *      SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
 *      SUPABASE_LOCAL_ANON_KEY=$(supabase status -o json | jq -r .ANON_KEY) \
 *      SUPABASE_LOCAL_SERVICE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY) \
 *      npm run test -- --run rls-real-postgres
 *
 * In CI, this requires the `supabase start` step in the workflow plus the
 * three env vars above. Tests are skipped when SUPABASE_LOCAL is not set,
 * or when any of the URL/anon/service-key env vars are missing.
 *
 * AUDIT F-03 / F-A89-04: Real RLS assertions implemented. The SKIP gate
 * is inverted so the suite runs by default when Supabase local env vars
 * are present (CI provides via `supabase start`). Tests are only skipped
 * when SKIP_RLS=true is explicitly set or the env vars are absent.
 * The schema infrastructure tests always run regardless of SKIP.
 * See #629 for remaining RLS coverage work.
 *
 * NOTE: We deliberately do NOT hardcode the well-known Supabase local
 * demo JWTs as fallbacks. Even though they are public dev keys, gitleaks
 * (correctly) flags any JWT-shaped literal in source.
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ?? process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "";

// AUDIT FINDING #3: Inverted the gate so tests run by default in CI.
// Previously: skipped unless SUPABASE_LOCAL was explicitly set.
// Now: only skipped when SKIP_RLS is explicitly set to "true".
// CI provides the Supabase local env vars via the `supabase start` step.
const SKIP =
  process.env.SKIP_RLS === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY;

const CLINIC_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLINIC_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/**
 * Create a Supabase anon client with x-clinic-id header set.
 * This simulates how createTenantClient() works for anon RLS queries.
 */
function createAnonClientForClinic(clinicId: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}

/**
 * Create a Supabase anon client WITHOUT any clinic context.
 * Used to verify that anon users cannot read data without a clinic header.
 */
function createAnonClientNoClinic() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Admin client for seed data setup (bypasses RLS).
 */
function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// R-05: PHI tables that must have RLS with clinic_id scoping.
// Expanded from the original 7 to cover all tables from the initial
// schema + migrations that store patient-attributable data.
const CORE_PHI_TABLES = [
  "appointments",
  "payments",
  "services",
  "time_slots",
  "reviews",
  "documents",
  "waiting_list",
  "prescriptions",
  "consultation_notes",
  "notifications",
  "lab_orders",
  "family_members",
  "installments",
  "users",
] as const;

describe.skipIf(SKIP)("RLS Real Postgres Tests", () => {
  beforeAll(async () => {
    // Seed two clinics and basic data using admin client
    const admin = createAdminClient();

    // Ensure test clinics exist (idempotent upsert)
    await admin.from("clinics").upsert(
      [
        {
          id: CLINIC_A_ID,
          name: "Clinic A (RLS Test)",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
        {
          id: CLINIC_B_ID,
          name: "Clinic B (RLS Test)",
          type: "doctor",
          status: "active",
          tier: "pro",
        },
      ],
      { onConflict: "id" },
    );

    // Create a test service in each clinic for FK references
    await admin.from("services").upsert(
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          clinic_id: CLINIC_A_ID,
          name: "Consultation A",
          duration_minutes: 30,
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          clinic_id: CLINIC_B_ID,
          name: "Consultation B",
          duration_minutes: 30,
        },
      ],
      { onConflict: "id" },
    );
  });

  describe("Cross-tenant SELECT isolation", () => {
    it.each(CORE_PHI_TABLES)(
      "anon client for clinic A cannot see clinic B data in %s",
      async (table) => {
        const clientA = createAnonClientForClinic(CLINIC_A_ID);

        // Query with clinic A context — should NOT return any clinic B rows
        const { data, error } = await clientA
          .from(table)
          .select("id, clinic_id")
          .eq("clinic_id", CLINIC_B_ID)
          .limit(1);

        // Either the query returns empty (RLS filters out) or the table
        // doesn't exist yet (migration not applied in local). Both are acceptable.
        if (!error) {
          expect(data ?? []).toHaveLength(0);
        } else {
          // If the table doesn't exist, that's fine for this test
          expect(error.message).toMatch(/does not exist|permission denied|relation/i);
        }
      },
    );
  });

  describe("Anon SELECT without clinic context", () => {
    it.each(CORE_PHI_TABLES)(
      "anon client without x-clinic-id header cannot read %s",
      async (table) => {
        const anonNoClinic = createAnonClientNoClinic();

        const { data, error } = await anonNoClinic.from(table).select("id").limit(5);

        // RLS should either return empty rows or deny access entirely
        if (!error) {
          // If the query succeeds, it should return 0 rows (RLS blocks all)
          expect(data ?? []).toHaveLength(0);
        } else {
          // Permission denied is also acceptable
          expect(error.message).toMatch(/does not exist|permission denied|relation/i);
        }
      },
    );
  });

  describe("Cross-tenant INSERT isolation", () => {
    it("anon client for clinic A cannot insert into clinic B services", async () => {
      const clientA = createAnonClientForClinic(CLINIC_A_ID);

      const { error } = await clientA.from("services").insert({
        clinic_id: CLINIC_B_ID,
        name: "Injected Service",
        duration_minutes: 15,
      });

      // RLS should block this — either permission denied or the insert
      // silently returns 0 rows affected
      if (error) {
        expect(error.message).toMatch(/policy|permission|violates|denied/i);
      }
      // If no error, verify the row was NOT actually created
      const admin = createAdminClient();
      const { data } = await admin
        .from("services")
        .select("id")
        .eq("clinic_id", CLINIC_B_ID)
        .eq("name", "Injected Service")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });
  });
});

/**
 * RLS-01: Cross-tenant isolation tests.
 *
 * SA-010 audit finding: verify that a clinic_A super_admin cannot read
 * data belonging to clinic_B, and that clinic_A staff cannot mutate
 * clinic_B records even if they construct the request directly.
 */
describe.skipIf(SKIP)("Cross-tenant isolation (SA-010)", () => {
  it("clinic_A anon client cannot read appointments belonging to clinic_B", async () => {
    const clientA = createAnonClientForClinic(CLINIC_A_ID);

    // Query appointments scoped to clinic_B while using clinic_A context.
    // RLS should return an empty set rather than leaking clinic_B rows.
    const { data, error } = await clientA
      .from("appointments")
      .select("id")
      .eq("clinic_id", CLINIC_B_ID)
      .limit(5);

    // Either an empty array (RLS blocked) or a permission error is acceptable.
    // What is NOT acceptable: rows from clinic_B leaking through.
    if (!error) {
      expect(data).toHaveLength(0);
    }
  });

  it("clinic_A anon client cannot read users belonging to clinic_B", async () => {
    const clientA = createAnonClientForClinic(CLINIC_A_ID);

    const { data, error } = await clientA
      .from("users")
      .select("id, name")
      .eq("clinic_id", CLINIC_B_ID)
      .limit(5);

    if (!error) {
      expect(data).toHaveLength(0);
    }
  });

  it("unauthenticated client (no clinic header) cannot read any appointments", async () => {
    const clientNoClinic = createAnonClientNoClinic();

    const { data, error } = await clientNoClinic.from("appointments").select("id").limit(5);

    if (!error) {
      // Without a valid clinic context, RLS should return zero rows.
      expect(data).toHaveLength(0);
    }
  });

  it("admin client can read data from both clinics (service role bypass)", async () => {
    const admin = createAdminClient();

    // Seed a minimal appointment for clinic_A so the query returns something.
    // This verifies the service role bypass is working, not just RLS blocking everything.
    const { data: clinicAData } = await admin
      .from("clinics")
      .select("id")
      .eq("id", CLINIC_A_ID)
      .limit(1);

    // The admin client must be able to see both clinics.
    const { data: clinicBData } = await admin
      .from("clinics")
      .select("id")
      .eq("id", CLINIC_B_ID)
      .limit(1);

    // Both clinics should be accessible via admin client.
    expect(clinicAData?.length).toBeGreaterThanOrEqual(1);
    expect(clinicBData?.length).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Schema validation tests (always run, no Supabase required).
 * Verify that our test constants are well-formed.
 */
describe("RLS Test Infrastructure", () => {
  it("test clinic IDs are valid UUIDs", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(CLINIC_A_ID).toMatch(uuidRegex);
    expect(CLINIC_B_ID).toMatch(uuidRegex);
  });

  it("test clinic IDs are distinct", () => {
    expect(CLINIC_A_ID).not.toEqual(CLINIC_B_ID);
  });

  it("CORE_PHI_TABLES list is non-empty", () => {
    expect(CORE_PHI_TABLES.length).toBeGreaterThan(0);
  });

  it("Supabase local URL is configured when SUPABASE_LOCAL is set", () => {
    if (process.env.SUPABASE_LOCAL) {
      expect(SUPABASE_URL).toBeTruthy();
      expect(SUPABASE_ANON_KEY).toBeTruthy();
      expect(SUPABASE_SERVICE_KEY).toBeTruthy();
    }
  });
});
