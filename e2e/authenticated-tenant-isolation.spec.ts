import { test, expect, type Page } from "@playwright/test";

// This scenario relies on the richer local/demo seed from `scripts/seed.ts`
// or `supabase/seeds/00003_seed_data.sql`. CI does not provision the second
// clinic auth user, so we only register the test when explicitly opted in.
const RUN_DEMO_SEED_TESTS = process.env.E2E_DEMO_SEED === "true";

const DEMO_SUBDOMAIN_URL = process.env.E2E_BASE_URL || "http://demo.localhost:3000";
const OTHER_SUBDOMAIN_URL = "http://sourire-dental.localhost:3000";

// Seed credentials are sourced from env vars so they are not hardcoded in the
// repo. The fallbacks are the documented demo-seed defaults (see
// supabase/seeds/00003_seed_data.sql); they only work when E2E_DEMO_SEED=true
// and are blocked in production by the seed-user guard (see AGENTS.md).
const DEMO_ADMIN_EMAIL = process.env.E2E_DEMO_ADMIN_EMAIL || "admin@demo-clinic.com";
const DEMO_ADMIN_PASSWORD = process.env.E2E_DEMO_ADMIN_PASSWORD || "ClinicAdmin123!";

async function loginAsDemoClinicAdmin(page: Page): Promise<void> {
  await page.goto(`${DEMO_SUBDOMAIN_URL}/login`);
  await page.fill('input[name="email"]', DEMO_ADMIN_EMAIL);
  await page.fill('input[name="password"]', DEMO_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**");
}

test.describe("Authenticated tenant isolation", () => {
  // Always runs (CI included): a tenant-scoped API must reject unauthenticated
  // access with an auth error — never 200 with another tenant's data. This
  // guarantees the file registers at least one test in CI, where the richer
  // authenticated cross-subdomain check below is skipped (no second seeded
  // clinic auth user).
  test("tenant-scoped API rejects unauthenticated access (no cross-tenant leak)", async ({
    request,
  }) => {
    const res = await request.get("/api/waiting-queue");
    expect([401, 403]).toContain(res.status());
    // A leak would surface as 200 with a payload — assert it never does.
    expect(res.status()).not.toBe(200);
  });

  if (RUN_DEMO_SEED_TESTS) {
    test("clinic session is rejected on a different tenant subdomain", async ({ page }) => {
      await loginAsDemoClinicAdmin(page);

      const sameTenantResponse = await page.goto(`${DEMO_SUBDOMAIN_URL}/api/waiting-queue`);
      expect(sameTenantResponse).not.toBeNull();
      // The clinic's own session must be served its own tenant's queue. An
      // empty queue is still a 200, so a crash (5xx) is a real bug here and
      // must NOT count as a pass — assert success outright.
      expect(sameTenantResponse!.status()).toBe(200);

      const crossTenantResponse = await page.goto(`${OTHER_SUBDOMAIN_URL}/api/waiting-queue`);
      expect(crossTenantResponse).not.toBeNull();
      expect(crossTenantResponse!.status()).toBe(403);
      await expect(page.locator("body")).toContainText("tenant mismatch");
    });
  }
});
