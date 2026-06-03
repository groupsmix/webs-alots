import { test, expect } from "@playwright/test";

test.describe("Demo Clinic Smoke Test", () => {
  // Use the demo subdomain for all requests in this block
  test.use({ baseURL: "http://demo.localhost:3000" });

  // SCAFFOLD-GAP (A87-F10): These two tests expect the `Cabinet Dr. Ahmed
  // Benali` clinic and `doctor@demo-clinic.com / Doctor123!` credentials,
  // which are defined in supabase/seeds/00003_seed_data.sql and
  // scripts/seed.ts respectively. `supabase start` only applies
  // migrations + seed.sql, and seed.sql uses `seed-password-change-me`
  // as the password — not `Doctor123!` — and does NOT insert the clinic
  // row. Migration 00040 skips when run on a fresh DB. The `demo`
  // subdomain in CI resolves to `Cabinet Demo Oltigo` (migration 00046),
  // not to Dr. Ahmed Benali.
  //
  // Env-guard contract:
  //   set E2E_DEMO_SEED=true when the run environment has the full demo
  //   seed (Dr. Ahmed Benali clinic + Doctor123!/Reception123! auth users)
  //   applied. CI does not set this; local devs running `npm run seed`
  //   followed by `npm run test:e2e` should export it. Lint rule A87-F10
  //   bans bare `test.skip`, so this is the canonical opt-in switch.
  const RUN_DEMO_SEED_TESTS = process.env.E2E_DEMO_SEED === "true";

  test.skipIf(!RUN_DEMO_SEED_TESTS)("Public landing page loads correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Cabinet Dr. Ahmed Benali").first()).toBeVisible();

    const bookButton = page.locator("text=Prendre rendez-vous").first();
    await expect(bookButton).toBeVisible();
  });

  test("Login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Connexion")).toBeVisible();
  });

  test.skipIf(!RUN_DEMO_SEED_TESTS)("Doctor can login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "doctor@demo-clinic.com");
    await page.fill('input[name="password"]', "Doctor123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/dashboard**");
    await expect(page.locator("text=Dr. Ahmed Benali").first()).toBeVisible();
  });
});
