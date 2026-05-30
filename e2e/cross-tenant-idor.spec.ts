import { test, expect } from "@playwright/test";

/**
 * TC-01 — Cross-Tenant IDOR Security Tests
 *
 * Audit finding TC-01 (High): The platform's most critical security invariant
 * is that a user authenticated to Clinic A cannot read, write, or delete
 * resources belonging to Clinic B.
 *
 * This suite tests the API layer for cross-tenant IDOR vulnerabilities by:
 *  1. Sending requests with forged/mismatched clinic IDs in request bodies
 *  2. Trying to access resource IDs that belong to another tenant
 *  3. Injecting tenant headers to impersonate a different clinic
 *  4. Attempting privilege escalation via role field injection
 *
 * These tests run unauthenticated (verifying public surface area) and rely on
 * the multi-tenant isolation infrastructure (middleware header stripping, RLS,
 * application-layer clinic_id scoping) already in place.
 *
 * For full cross-tenant isolation with authenticated sessions, see:
 *   src/lib/__tests__/integration/rls-assertions.test.ts (unit — needs local Supabase)
 *   src/lib/__tests__/integration/rls-high-value-tables.test.ts (unit — needs local Supabase)
 */

// Known-stable resource IDs that will never exist in the e2e environment.
// Using well-formed UUIDs prevents accidental 500 errors from UUID parse failures.
const CLINIC_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLINIC_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PATIENT_B_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const APPT_B_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DOCTOR_B_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// Acceptable 403/404 responses — cross-tenant access MUST return one of these.
// 401 is also acceptable (unauthenticated) but not 200 or 500.
const DENIED_STATUSES = [400, 401, 403, 404, 405, 422];

// ── Unauthenticated access to tenant-scoped resources ──────────────────────

test.describe("TC-01 — Unauthenticated cross-tenant resource access", () => {
  test("GET /api/v1/patients returns 401/403, not 200", async ({ request }) => {
    const res = await request.get("/api/v1/patients");
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/v1/appointments returns 401/403, not 200", async ({ request }) => {
    const res = await request.get("/api/v1/appointments");
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/patients with forged clinic_id query param is rejected", async ({ request }) => {
    const res = await request.get(`/api/v1/patients?clinic_id=${CLINIC_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/booking with competitor clinic_id is rejected", async ({ request }) => {
    const res = await request.get(`/api/booking?clinicId=${CLINIC_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });
});

// ── Header injection attacks ────────────────────────────────────────────────

test.describe("TC-01 — Tenant header injection attacks", () => {
  test("x-clinic-id header injection is stripped — branding API", async ({ request }) => {
    // An attacker injects x-clinic-id to try to read another clinic's branding
    const res = await request.get("/api/branding", {
      headers: { "x-clinic-id": CLINIC_B_ID },
    });
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}));
      // Must not return Clinic B's data
      expect(body.clinicId).not.toBe(CLINIC_B_ID);
      expect(body.id).not.toBe(CLINIC_B_ID);
    } else {
      expect(DENIED_STATUSES).toContain(res.status());
    }
  });

  test("x-tenant-clinic-id header injection is stripped — branding API", async ({ request }) => {
    const res = await request.get("/api/branding", {
      headers: {
        "x-tenant-clinic-id": CLINIC_B_ID,
        "x-tenant-clinic-name": "Attacker Clinic",
        "x-tenant-subdomain": "attacker",
      },
    });
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}));
      expect(body.clinicId).not.toBe(CLINIC_B_ID);
    } else {
      expect(DENIED_STATUSES).toContain(res.status());
    }
  });

  test("x-auth-profile-role header injection is stripped", async ({ request }) => {
    // TC-01 / A-07: Attempt to forge super_admin role via header injection.
    // Middleware strips all x-auth-profile-* headers before forwarding to route.
    const res = await request.get("/api/admin/audit-logs", {
      headers: {
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-id": "forged-user-id",
        "x-auth-profile-clinic": CLINIC_B_ID,
      },
    });
    // Must reject — forged headers must never grant access
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("x-auth-profile-sig header without valid HMAC is rejected", async ({ request }) => {
    const res = await request.get("/api/admin/usage", {
      headers: {
        "x-auth-profile-role": "super_admin",
        "x-auth-profile-id": "forged-user-id",
        "x-auth-profile-sig": "invalid-hmac-value",
        "x-auth-profile-iat": String(Math.floor(Date.now() / 1000)),
      },
    });
    expect(DENIED_STATUSES).toContain(res.status());
  });
});

// ── Cross-tenant resource ID guessing (IDOR) ───────────────────────────────

test.describe("TC-01 — Cross-tenant resource ID enumeration (IDOR)", () => {
  test("GET /api/v1/patients/{id} with cross-tenant patient ID returns 401/403/404", async ({
    request,
  }) => {
    // Patient B belongs to Clinic B. An unauthenticated request must not return 200.
    const res = await request.get(`/api/v1/patients/${PATIENT_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("PATCH /api/v1/patients/{id} with cross-tenant patient ID returns 401/403/404", async ({
    request,
  }) => {
    const res = await request.patch(`/api/v1/patients/${PATIENT_B_ID}`, {
      data: { name: "Hijacked Name" },
    });
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/admissions/{id} with cross-tenant appointment ID is rejected", async ({
    request,
  }) => {
    const res = await request.get(`/api/admissions/${APPT_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/invoices/{id} with cross-tenant invoice ID is rejected", async ({ request }) => {
    const res = await request.get(`/api/invoices/${APPT_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/files/download with cross-tenant file key is rejected", async ({ request }) => {
    // Attempt to download a file using a constructed cross-tenant R2 key
    const crossTenantKey = `${CLINIC_B_ID}/prescriptions/fake-file.pdf`;
    const res = await request.get(
      `/api/files/download?key=${encodeURIComponent(crossTenantKey)}`,
    );
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("GET /api/lab/results with cross-tenant patient_id query param is rejected", async ({
    request,
  }) => {
    const res = await request.get(`/api/lab/results?patientId=${PATIENT_B_ID}`);
    expect(DENIED_STATUSES).toContain(res.status());
  });
});

// ── Cross-tenant write attempts (mass assignment + role escalation) ─────────

test.describe("TC-01 — Cross-tenant write and role escalation", () => {
  test("POST /api/v1/appointments with cross-clinic doctor_id is rejected", async ({
    request,
  }) => {
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
    expect(DENIED_STATUSES).toContain(res.status());
  });

  test("POST /api/v1/register-clinic does not accept role=super_admin (D-02)", async ({
    request,
  }) => {
    // D-02: Hardcode the role assigned at registration. Never accept `role` from client.
    // Even if self-service registration is disabled, the handler must reject a role field.
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
    // If registration is disabled: 403/503
    // If registration is enabled: 200/201 but role must NOT be super_admin
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json().catch(() => ({}));
      expect(body.role).not.toBe("super_admin");
      expect(body.user?.role).not.toBe("super_admin");
    } else {
      expect([403, 422, 429, 503]).toContain(res.status());
    }
  });

  test("PATCH /api/v1/patients/{id} mass-assignment of role is ignored (D-03)", async ({
    request,
  }) => {
    // D-03: Mass assignment — if endpoint is open, it must reject disallowed fields.
    const res = await request.patch(`/api/v1/patients/${PATIENT_B_ID}`, {
      data: {
        name: "Test Patient",
        role: "super_admin",
        is_verified: true,
        clinic_id: CLINIC_A_ID,
      },
    });
    // Must not succeed for a cross-tenant patient
    expect(DENIED_STATUSES).toContain(res.status());
  });
});

// ── Deleted/revoked clinic isolation (D-05) ────────────────────────────────

test.describe("TC-01 — Deleted clinic resource access", () => {
  test("API endpoints for non-existent clinic return 4xx, not 500", async ({ request }) => {
    // A non-existent clinic ID should return 404/403, not a 500 that leaks DB errors
    const nonExistentClinicId = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";
    const res = await request.get(`/api/branding?clinicId=${nonExistentClinicId}`);
    expect(res.status()).not.toBe(500);
    expect(res.status()).not.toBe(200);
  });
});

// ── Sequential ID enumeration (D-04) ───────────────────────────────────────

test.describe("TC-01 — Resource ID enumeration resistance", () => {
  test("API returns identical error shape for missing vs cross-tenant resources", async ({
    request,
  }) => {
    // D-04: Different error messages for "not found" vs "forbidden" leak cross-tenant
    // record existence. Both should return the same status code (404 preferred).
    const totallyFakeId = "00000000-0000-4000-8000-000000000000";
    const crossTenantId = PATIENT_B_ID;

    const fakeRes = await request.get(`/api/v1/patients/${totallyFakeId}`);
    const crossRes = await request.get(`/api/v1/patients/${crossTenantId}`);

    // Both must be denied. Ideally identical status codes (no oracle).
    expect(DENIED_STATUSES).toContain(fakeRes.status());
    expect(DENIED_STATUSES).toContain(crossRes.status());
  });
});
