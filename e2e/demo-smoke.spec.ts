import { test, expect } from "@playwright/test";

test.describe("Demo Clinic Smoke Test", () => {
  // Use the demo subdomain for all requests in this block
  test.use({ baseURL: "http://demo.localhost:3000" });

  test("Public landing page loads correctly", async ({ page }) => {
    await page.goto("/");
    // Check that the demo clinic name is visible
    await expect(page.locator("text=Cabinet Dr. Ahmed Benali").first()).toBeVisible();

    // Check for the "Prendre rendez-vous" CTA
    const bookButton = page.locator("text=Prendre rendez-vous").first();
    await expect(bookButton).toBeVisible();
  });

  test("Login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Connexion")).toBeVisible();
  });

  test("Doctor can login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "doctor@demo-clinic.com");
    await page.fill('input[name="password"]', "Doctor123!");
    await page.click('button[type="submit"]');

    // Wait for redirect to doctor dashboard
    await page.waitForURL("**/dashboard**");
    // Check dashboard elements
    await expect(page.locator("text=Dr. Ahmed Benali").first()).toBeVisible();
  });
});
