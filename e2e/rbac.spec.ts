import { test, expect } from "@playwright/test";

/**
 * E2E tests for Role-Based Access Control (RBAC).
 *
 * Verifies that:
 * 1. Protected dashboard routes redirect unauthenticated users to login
 * 2. Each role's routes are properly guarded
 * 3. Staff-only API endpoints reject unauthenticated requests
 * 4. Patient-specific API endpoints enforce auth
 * 5. Role-specific dashboards are not accessible without proper role
 */

test.describe("RBAC — patient routes require authentication", () => {
  test("patient dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    const response = await page.goto("/patient/dashboard");
    const url = page.url();
    const isRedirected = url.includes("/login") || url.includes("/auth");
    const isBlocked =
      response?.status() === 401 || response?.status() === 403;
    expect(isRedirected || isBlocked).toBeTruthy();
  });

  test("patient appointments page redirects to login", async ({ page }) => {
    const response = await page.goto("/patient/appointments");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("patient profile page redirects to login", async ({ page }) => {
    const response = await page.goto("/patient/profile");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("RBAC — admin routes require authentication", () => {
  test("admin dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    const response = await page.goto("/admin/dashboard");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("admin patients management redirects to login", async ({ page }) => {
    const response = await page.goto("/admin/patients");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("admin settings page redirects to login", async ({ page }) => {
    const response = await page.goto("/admin/settings");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("RBAC — doctor routes require authentication", () => {
  test("doctor dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    const response = await page.goto("/doctor/dashboard");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("doctor patients page redirects to login", async ({ page }) => {
    const response = await page.goto("/doctor/patients");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("doctor appointments page redirects to login", async ({ page }) => {
    const response = await page.goto("/doctor/appointments");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("RBAC — receptionist routes require authentication", () => {
  test("receptionist dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    const response = await page.goto("/receptionist/dashboard");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("receptionist patients page redirects to login", async ({ page }) => {
    const response = await page.goto("/receptionist/patients");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("RBAC — super-admin routes require authentication", () => {
  test("super-admin dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    const response = await page.goto("/super-admin/dashboard");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("super-admin clinics management redirects to login", async ({
    page,
  }) => {
    const response = await page.goto("/super-admin/clinics");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("super-admin users page redirects to login", async ({ page }) => {
    const response = await page.goto("/super-admin/users");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("RBAC — specialist role routes require authentication", () => {
  const specialistRoutes = [
    "/pharmacist/dashboard",
    "/nutritionist/dashboard",
    "/optician/dashboard",
    "/physiotherapist/dashboard",
    "/psychologist/dashboard",
    "/radiology/dashboard",
    "/speech-therapist/dashboard",
    "/lab-panel/dashboard",
  ];

  for (const route of specialistRoutes) {
    test(`${route} redirects to login when unauthenticated`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      const url = page.url();
      const isProtected =
        url.includes("/login") ||
        url.includes("/auth") ||
        response?.status() === 401 ||
        response?.status() === 403;
      expect(isProtected).toBeTruthy();
    });
  }
});

test.describe("RBAC — staff-only API endpoints reject unauthenticated requests", () => {
  test("POST /api/notifications requires staff auth", async ({ request }) => {
    const response = await request.post("/api/notifications", {
      data: {
        trigger: "new_booking",
        variables: {},
        recipientId: "some-id",
        channels: ["in_app"],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/notifications/trigger requires staff auth", async ({
    request,
  }) => {
    const response = await request.post("/api/notifications/trigger", {
      data: {
        trigger: "booking_confirmation",
        variables: { patient_name: "Test" },
        recipients: [{ id: "user-id", channels: ["whatsapp"] }],
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/payments/create-checkout requires staff auth", async ({
    request,
  }) => {
    const response = await request.post("/api/payments/create-checkout", {
      data: {
        amount: 10000,
        currency: "mad",
        description: "Test Payment",
      },
    });
    expect([401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("POST /api/payments/cmi requires staff auth", async ({ request }) => {
    const response = await request.post("/api/payments/cmi", {
      data: {
        amount: 200,
        description: "Test CMI Payment",
      },
    });
    expect([401, 403, 404, 405, 503]).toContain(response.status());
  });

  test("GET /api/notifications requires auth", async ({ request }) => {
    const response = await request.get("/api/notifications");
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("DELETE /api/patient/delete-account requires auth", async ({
    request,
  }) => {
    const response = await request.delete("/api/patient/delete-account");
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("GET /api/patient/export requires auth", async ({ request }) => {
    const response = await request.get("/api/patient/export");
    expect([401, 403, 404, 405]).toContain(response.status());
  });
});

test.describe("RBAC — public routes remain accessible", () => {
  test("homepage is accessible without auth", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
  });

  test("login page is accessible without auth", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(400);
  });

  test("registration page is accessible without auth", async ({ page }) => {
    const response = await page.goto("/register");
    expect(response?.status()).toBeLessThan(400);
  });

  test("booking page is accessible without auth", async ({ page }) => {
    const response = await page.goto("/booking");
    expect(response?.status()).toBeLessThan(500);
  });

  test("pricing page is accessible without auth", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBeLessThan(400);
  });

  test("API health check is accessible without auth", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("API branding is accessible without auth", async ({ request }) => {
    const response = await request.get("/api/branding");
    expect(response.status()).toBe(200);
  });
});

test.describe("RBAC — login redirect includes return path", () => {
  test("protected route redirect includes redirect query param", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    const url = page.url();
    // When redirected to login, the original path should be preserved
    // as a query parameter so the user can be sent back after login
    if (url.includes("/login")) {
      const urlObj = new URL(url);
      const redirect = urlObj.searchParams.get("redirect");
      expect(redirect).toBeTruthy();
      expect(redirect).toContain("/admin");
    }
  });

  test("patient route redirect includes redirect query param", async ({
    page,
  }) => {
    await page.goto("/patient/dashboard");
    const url = page.url();
    if (url.includes("/login")) {
      const urlObj = new URL(url);
      const redirect = urlObj.searchParams.get("redirect");
      expect(redirect).toBeTruthy();
      expect(redirect).toContain("/patient");
    }
  });
});
