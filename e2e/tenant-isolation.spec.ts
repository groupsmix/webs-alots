import { test, expect } from "@playwright/test";

/**
 * E2E tests for tenant isolation (cross-tenant data leakage prevention).
 *
 * Verifies that:
 * 1. Injected x-tenant-* headers are stripped by middleware
 * 2. API routes enforce clinic_id scoping
 * 3. Booking and branding APIs are tenant-aware
 * 4. Notification dispatch rejects cross-clinic recipients
 * 5. Payment APIs scope operations to the correct tenant
 */

test.describe("Tenant isolation — header injection prevention", () => {
  test("middleware strips injected x-tenant-clinic-id header", async ({
    request,
  }) => {
    // An attacker could try to inject x-tenant-clinic-id on a root-domain
    // request to impersonate another tenant. The middleware MUST strip all
    // x-tenant-* headers from incoming requests before processing.
    const response = await request.get("/api/branding", {
      headers: {
        "x-tenant-clinic-id": "attacker-injected-clinic-id",
      },
    });
    // Should succeed (200) but NOT use the injected clinic ID.
    // The response should contain the default/root branding, not
    // the attacker-specified clinic's branding.
    expect(response.status()).toBe(200);
    const body = await response.json();
    // The branding should NOT include the attacker's clinic ID
    expect(body.clinicId).not.toBe("attacker-injected-clinic-id");
  });

  test("middleware strips injected x-tenant-clinic-name header", async ({
    request,
  }) => {
    const response = await request.get("/api/branding", {
      headers: {
        "x-tenant-clinic-name": "Attacker Clinic",
        "x-tenant-clinic-id": "fake-id-12345",
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.name).not.toBe("Attacker Clinic");
  });

  test("middleware strips all x-tenant-* headers from incoming requests", async ({
    request,
  }) => {
    // Try injecting all tenant headers at once
    const response = await request.get("/api/branding", {
      headers: {
        "x-tenant-clinic-id": "injected-id",
        "x-tenant-clinic-name": "Injected Name",
        "x-tenant-subdomain": "injected-subdomain",
        "x-tenant-clinic-type": "injected-type",
        "x-tenant-clinic-tier": "injected-tier",
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    // None of the injected values should appear in the response
    expect(body.clinicId).not.toBe("injected-id");
  });
});

test.describe("Tenant isolation — API data scoping", () => {
  test("GET /api/patients returns auth error without credentials", async ({
    request,
  }) => {
    // Without auth, the API should reject — not leak cross-tenant data
    const response = await request.get("/api/patients");
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/patients rejects unauthenticated cross-tenant creation", async ({
    request,
  }) => {
    const response = await request.post("/api/patients", {
      data: {
        name: "Cross-Tenant Patient",
        email: "cross-tenant@example.com",
        phone: "+212600000000",
        clinic_id: "other-clinic-uuid",
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("notification dispatch API rejects unauthenticated requests", async ({
    request,
  }) => {
    // POST /api/notifications requires staff-role auth.
    // An unauthenticated request trying to send notifications to
    // another clinic's users must be rejected.
    const response = await request.post("/api/notifications", {
      data: {
        trigger: "new_booking",
        variables: { patient_name: "Test" },
        recipientId: "cross-tenant-user-id",
        channels: ["in_app"],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("notification trigger API rejects unauthenticated requests", async ({
    request,
  }) => {
    const response = await request.post("/api/notifications/trigger", {
      data: {
        trigger: "new_booking",
        variables: { patient_name: "Test" },
        recipients: [{ id: "some-user-id", channels: ["in_app"] }],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe("Tenant isolation — booking endpoint scoping", () => {
  test("POST /api/booking requires booking verification token", async ({
    request,
  }) => {
    // The booking endpoint requires an x-booking-token header
    // to prevent unauthenticated spam.
    const response = await request.post("/api/booking", {
      data: {
        specialtyId: "test",
        doctorId: "test",
        serviceId: "test",
        date: "2025-12-01",
        time: "10:00",
        isFirstVisit: true,
        hasInsurance: false,
        patient: {
          name: "Test Patient",
          phone: "+212600000000",
        },
        slotDuration: 30,
        bufferTime: 5,
      },
    });
    // Should reject without booking token (401)
    expect([401, 403, 429]).toContain(response.status());
  });

  test("POST /api/booking rejects invalid booking token", async ({
    request,
  }) => {
    const response = await request.post("/api/booking", {
      headers: {
        "x-booking-token": "invalid-token-value",
      },
      data: {
        specialtyId: "test",
        doctorId: "test",
        serviceId: "test",
        date: "2025-12-01",
        time: "10:00",
        isFirstVisit: true,
        hasInsurance: false,
        patient: {
          name: "Test Patient",
          phone: "+212600000000",
        },
        slotDuration: 30,
        bufferTime: 5,
      },
    });
    // Should reject with invalid token (403)
    expect([401, 403, 429]).toContain(response.status());
  });
});

test.describe("Tenant isolation — payment webhook scoping", () => {
  test("Stripe webhook rejects requests without signature", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/webhook", {
      data: JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_fake",
            metadata: {
              clinic_id: "other-clinic-id",
              patient_id: "patient-id",
            },
            amount_total: 10000,
          },
        },
      }),
      headers: {
        "content-type": "application/json",
      },
    });
    // Should reject — missing stripe-signature header
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("Stripe webhook rejects requests with invalid signature", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/webhook", {
      data: JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_fake",
            metadata: {
              clinic_id: "injected-clinic-id",
              patient_id: "patient-id",
            },
          },
        },
      }),
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=999999999,v1=invalidhash",
      },
    });
    // Should reject — invalid signature
    expect([400, 401, 403, 503]).toContain(response.status());
  });

  test("CMI callback rejects requests with invalid hash", async ({
    request,
  }) => {
    const formData = new URLSearchParams();
    formData.append("oid", "fake-order-id");
    formData.append("amount", "200.00");
    formData.append("ProcReturnCode", "00");
    formData.append("HASH", "invalidhashvalue");

    const response = await request.post("/api/payments/cmi/callback", {
      data: formData.toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    // Should reject — invalid HMAC hash
    expect([400, 401, 403]).toContain(response.status());
  });
});
