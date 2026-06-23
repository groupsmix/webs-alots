import { test, expect } from "@playwright/test";

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
//   bans bare `test.skip`/`describe.skip`/`it.skip`, and Playwright's
//   `test` has no `skipIf` (that's Vitest). We therefore gate via
//   conditional registration at module top-level: when the env-guard is
//   false, the demo-dependent tests are simply never registered with
//   the Playwright runner. The unguarded "Login page is accessible"
//   case always runs because it does not depend on seed data.
const RUN_DEMO_SEED_TESTS = process.env.E2E_DEMO_SEED === "true";

test.describe("Demo Clinic Smoke Test", () => {
  // Use the demo subdomain for all requests in this block (CI sets
  // E2E_BASE_URL to the demo subdomain; fall back to demo.localhost locally).
  test.use({ baseURL: process.env.E2E_BASE_URL || "http://demo.localhost:3000" });

  if (RUN_DEMO_SEED_TESTS) {
    test("Public landing page loads correctly", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("text=Cabinet Dr. Ahmed Benali").first()).toBeVisible();

      const bookButton = page.locator("text=Prendre rendez-vous").first();
      await expect(bookButton).toBeVisible();
    });
  }

  test("Login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Connexion")).toBeVisible();
  });

  if (RUN_DEMO_SEED_TESTS) {
    test("Doctor can login", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[name="email"]', "doctor@demo-clinic.com");
      await page.fill('input[name="password"]', "Doctor123!");
      await page.click('button[type="submit"]');

      await page.waitForURL("**/dashboard**");
      await expect(page.locator("text=Dr. Ahmed Benali").first()).toBeVisible();
    });
  }
});
