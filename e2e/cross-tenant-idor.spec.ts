import { test, expect } from "@playwright/test";

/**
 * TC-01 — Cross-Tenant IDOR Security Tests
 *
 * Audit finding TC-01 (High): The platform's most critical security invariant
 * is that a user authenticated to Clinic A cannot read, write, or delete
 * resources belonging to Clinic B.
 *
 * SCOPE OF THIS SUITE (read this before adding/loosening assertions):
 * These tests run UNAUTHENTICATED. They verify the *public attack surface*:
 *   1. Tenant-scoped routes deny anonymous access (never 200 with data).
 *   2. Injected tenant/role headers are stripped by middleware.
 *   3. Routes that exist are actually auth-gated (deny BEFORE any data access).
 *
 * They do NOT (and cannot, without seeded multi-tenant sessions) prove
 * cross-tenant isolation between two authenticated clinics. That invariant
 * is covered by:
 *   - e2e/authenticated-tenant-isolation.spec.ts (E2E, gated on E2E_DEMO_SEED)
 *   - src/lib/__tests__/integration/rls-assertions.test.ts (needs local Supabase)
 *   - src/lib/__tests__/integration/rls-high-value-tables.test.ts
 *
 * IMPORTANT: every endpoint asserted here is a REAL route. Do not assert
 * against non-existent paths — a 404 from a missing route is a false pass
 * that proves nothing about access control.
 */

// Known-stable resource IDs that will never exist in the e2e environment.
// Well-formed UUIDs prevent accidental 500s from UUID parse failures.
const CLINIC_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PATIENT_B_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const APPT_B_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DOCTOR_B_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// Routes wrapped by withAuth/withAuthAnyRole/withAuthValidation reject an
// anonymous caller with 401 BEFORE any role (403), validation (422), or
// data-access (404) logic runs. We allow 403 only as defense-in-depth; the
// security-critical fact is that 200 (a leak) and 5xx (a crash) never appear.
const AUTH_DENIED = [401, 403];

// API-key routes (/api/v1/*) reject a caller without a Bearer key with 401.
const APIKEY_DENIED = [401];

// ── Unauthenticated access to tenant-scoped resources ──────────────────────

test.describe("TC-01 — Unauthenticated cross-tenant resource access", () => {
  test("GET /api/v1/patients requires an API key (401)", async ({ request }) => {
    const res = await request.get("/api/v1/patients");
    expect(APIKEY_DENIED).toContain(res.status());
  });

  test("GET /api/v1/appointments requires an API key (401)", async ({ request }) => {
    const res = await request.get("/api/v1/appointments");
    expect(APIKEY_DENIED).toContain(res.status());
  });

  test("GET /api/v1/patients with forged clinic_id query param is still 401", async ({
    request,
  }) => {
    // The clinic_id query param is ignored — tenant is derived from the API
    // key, never the client. Anonymous access must still be denied.
    const res = await request.get(`/api/v1/patients?clinic_id=${CLINIC_B_ID}`);
    expect(APIKEY_DENIED).toContain(res.status());
  });

  test("GET /api/booking ignores a forged clinic_id and derives tenant from host", async ({
    request,
  }) => {
    // /api/booking is a PUBLIC slot-availability endpoint. The clinicId query
    // param is silently ignored (tenant comes from the subdomain), so the
    // security boundary here is: a forged clinicId must NOT cause a 200 with
    // another clinic's data, and the endpoint must not 5xx. Without the
    // required doctorId+date it returns a 400 validation error.
    const res = await request.get(`/api/booking?clinicId=${CLINIC_B_ID}`);
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).not.toBe(200);
    expect([400, 401, 403]).toContain(res.status());
  });
});

// ── Header injection attacks ────────────────────────────────────────────────

test.describe("TC-01 — Tenant header injection attacks", () => {
  test("x-clinic-id header injection is stripped — branding API", async ({ request }) => {
    // An attacker injects x-clinic-id to try to read another clinic's branding.
    // /api/branding is intentionally public, so it returns 200 — but the
    // injected id must never influence the response.
    const res = await request.get("/api/branding", {
      headers: { "x-clinic-id": CLINIC_B_ID },
    });
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => ({}));
    expect(JSON.stringify(body)).not.toContain(CLINIC_B_ID);
  });

  test("x-tenant-* header injection is stripped — branding API", async ({ request }) => {
    const res = await request.get("/api/branding", {
      headers: {
        "x-tenant-clinic-id": CLINIC_B_ID,
        "x-tenant-clinic-name": "Attacker Clinic",
        "x-tenant-subdomain": "attacker",
      },
    });
    expect(res.status()).toBe(200);
    const serialized = JSON.stringify(await res.json().catch(() => ({})));
    expect(serialized).not.toContain(CLINIC_B_ID);
    expect(serialized).not.toContain("Attacker Clinic");
  });

  test("x-auth-profile-role header injection cannot grant admin access", async ({ request }) => {
    // TC-01 / A-07: Attempt to forge super_admin role via header injection.
    // Middleware strips all x-auth-profile-* headers; the route re-derives the
    // profile from the (absent) session, so this must be denied — never 200.
    const res = await request.get("/api/admin/audit-logs", {
      headers: {
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-id": "forged-user-id",
        "x-auth-profile-clinic": CLINIC_B_ID,
      },
    });
    expect(AUTH_DENIED).toContain(res.status());
  });

  test("x-auth-profile-sig header without a valid HMAC is rejected", async ({ request }) => {
    const res = await request.get("/api/admin/usage", {
      headers: {
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-id": "forged-user-id",
        "x-auth-profile-sig": "invalid-hmac-value",
        "x-auth-profile-iat": String(Math.floor(Date.now() / 1000)),
      },
    });
    expect(AUTH_DENIED).toContain(res.status());
  });
});

// ── Cross-tenant resource ID access on real by-id routes (IDOR) ────────────

test.describe("TC-01 — Cross-tenant resource ID access (IDOR)", () => {
  test("GET /api/admissions/{id} with cross-tenant ID is auth-gated", async ({ request }) => {
    const res = await request.get(`/api/admissions/${APPT_B_ID}`);
    expect(AUTH_DENIED).toContain(res.status());
  });

  test("GET /api/invoices/{id} with cross-tenant ID is auth-gated", async ({ request }) => {
    const res = await request.get(`/api/invoices/${APPT_B_ID}`);
    expect(AUTH_DENIED).toContain(res.status());
  });

  test("PATCH /api/admissions/{id} with cross-tenant ID + extra fields is auth-gated", async ({
    request,
  }) => {
    // The auth gate runs before the body is read, so mass-assignment of
    // disallowed fields can never take effect for an anonymous caller. The
    // field-allowlisting itself is unit-tested (mass-assignment-guard.yml +
    // route handler tests); here we only assert the route denies anonymous
    // writes outright.
    const res = await request.patch(`/api/admissions/${APPT_B_ID}`, {
      data: { action: "discharge", role: "super_admin", clinic_id: CLINIC_B_ID },
    });
    expect(AUTH_DENIED).toContain(res.status());
  });

  test("GET /api/files/download with cross-tenant file key is auth-gated", async ({ request }) => {
    // withAuthAnyRole rejects the anonymous caller (401) before the R2 key is
    // ever inspected, so a constructed cross-tenant key cannot leak a file.
    const crossTenantKey = `clinics/${CLINIC_B_ID}/prescriptions/fake-file.pdf`;
    const res = await request.get(`/api/files/download?key=${encodeURIComponent(crossTenantKey)}`);
    expect(AUTH_DENIED).toContain(res.status());
  });
});

// ── Cross-tenant write attempts (mass assignment + role escalation) ─────────

test.describe("TC-01 — Cross-tenant write and role escalation", () => {
  test("POST /api/v1/appointments with cross-clinic doctor_id is rejected", async ({ request }) => {
    // The v1 appointments schema is snake_case and strict; a camelCase /
    // clinic-spoofing body fails validation (422). A well-formed body would
    // still require a valid API key (401). And because this route is not
    // CSRF-exempt, an origin-less POST is rejected by the CSRF middleware (403)
    // before any of that. Either way: never 200/5xx.
    const res = await request.post("/api/v1/appointments", {
      data: {
        doctorId: DOCTOR_B_ID,
        clinicId: CLINIC_B_ID,
        patientId: PATIENT_B_ID,
        date: "2026-12-01",
        time: "10:00",
        duration: 30,
      },
    });
    expect([401, 403, 422]).toContain(res.status());
  });

  test("POST /api/v1/register-clinic never assigns role=super_admin (D-02)", async ({
    request,
  }) => {
    // D-02: The role assigned at registration is hardcoded server-side; the
    // schema is .strict() and has no `role` field. Self-service registration
    // is also disabled by default (403). If a deployment enables it, the
    // response must never reflect a super_admin role.
    const res = await request.post("/api/v1/register-clinic", {
      data: {
        clinicName: "Escalation Test",
        email: "test@escalation.com",
        phone: "+212600000001",
        role: "super_admin",
        website: "https://test.com",
        specialties: ["general"],
      },
    });
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json().catch(() => ({}));
      expect(body.role).not.toBe("super_admin");
      expect(body.data?.role).not.toBe("super_admin");
      expect(body.user?.role).not.toBe("super_admin");
    } else {
      // Disabled (403) | strict-schema reject (422) | bad domain (400) |
      // rate-limited (429) | verification unavailable (503).
      expect([400, 403, 422, 429, 503]).toContain(res.status());
    }
  });
});

// ── No existence oracle on real by-id routes (D-04) ────────────────────────

test.describe("TC-01 — Resource ID enumeration resistance", () => {
  test("invoices return the same denial for a fake vs cross-tenant ID (no oracle)", async ({
    request,
  }) => {
    // D-04: A route must not reveal whether a cross-tenant record exists by
    // returning a different status for "missing" vs "forbidden". Because the
    // auth gate runs first, an anonymous caller sees an identical 401 for
    // both, which is exactly the no-oracle property we want.
    const fakeId = "00000000-0000-4000-8000-000000000000";

    const fakeRes = await request.get(`/api/invoices/${fakeId}`);
    const crossRes = await request.get(`/api/invoices/${PATIENT_B_ID}`);

    expect(AUTH_DENIED).toContain(fakeRes.status());
    expect(AUTH_DENIED).toContain(crossRes.status());
    // No existence oracle: identical status for both IDs.
    expect(fakeRes.status()).toBe(crossRes.status());
  });
});
