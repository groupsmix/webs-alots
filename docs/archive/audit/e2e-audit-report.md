# Comprehensive Audit Report for `e2e` Directory

I have completed a deep scan of the `e2e` directory, encompassing all 30 test files and the `playwright.config.ts` file in the root.

Overall, the E2E suite is exceptionally well-written. It demonstrates robust defense-in-depth assertions, proper handling of React/Next.js hydration race conditions, and extensive security auditing (RBAC, IDOR, Open Redirects, CSRF, Webhooks).

Below is the prioritized list of findings based on your requested categories.

---

### 1. BUGS & ERRORS

**[Low] Flawed Cron Route Discovery (Silent Skips)**

- **File**: `e2e/cron-auth-security.spec.ts` (Lines: 74-75)
- **What's wrong**: The automated discovery script looks strictly for `route.ts`.
- **Why it's a problem**: The Next.js App Router fully supports `.js`, `.mjs`, and `.cjs` extensions. If a developer creates a cron route using one of these extensions (e.g., `route.js`), this script will silently ignore the route, meaning it will **not** be tested for authentication security.
- **Suggested fix**: Use `fs.readdirSync` on the directory and check for any file matching `^route\.(ts|js|mjs|cjs)$` instead of hardcoding the path to `route.ts`.

**[Low] Brittle Error Matching in Axe Accessibility Tests**

- **File**: `e2e/accessibility.spec.ts` (Line: 80)
- **What's wrong**: The test uses string matching on error messages: `if (msg.includes("Execution context was destroyed"))`.
- **Why it's a problem**: Playwright occasionally updates its internal error messages. If the phrasing changes in a future Playwright version, this retry logic will silently fail, causing flaky pipeline failures.
- **Suggested fix**: While this string matching is a common workaround in Playwright, adding a check for `err.message.includes('Target page, context or browser has been closed')` or checking the error's name/code (if provided by Playwright) will make it more resilient.

---

### 2. SECURITY ISSUES

**[Medium/Low] Hardcoded Seed Passwords in Source Code**

- **Files**:
  - `e2e/demo-smoke.spec.ts` (Lines: 29-30)
  - `e2e/authenticated-tenant-isolation.spec.ts` (Lines: 15-16)
  - `e2e/receptionist-workflow.spec.ts` (Lines: 21-22)
- **What's wrong**: There are hardcoded string fallbacks for clinic credentials (e.g., `"Doctor123!"`, `"ClinicAdmin123!"`, `"Reception123!"`).
- **Why it's a problem**: Even though these are just for seeding and the codebase explicitly documents a "seed-user guard" for production environments, having plaintext passwords in the source control is a bad practice. Security scanners often flag these as hardcoded secrets, polluting your vulnerability reports.
- **Suggested fix**: Remove the string fallbacks. Rely strictly on `process.env.E2E_DEMO_DOCTOR_PASSWORD` (and similar variables) loaded from a `.env.test` file or CI secrets.

---

### 3. BLOCKERS (Build / Run / Config)

_No severe blockers were found._

- Playwright is correctly configured to use `npx next dev --webpack` and `npx next start`.
- No broken config files, circular dependencies, or missing E2E dependencies (e.g., `@axe-core/playwright` is correctly installed in `package.json`).
- You will not face issues running `npm run test:e2e` assuming the environment variables (like `E2E_BASE_URL`) are populated.

---

### 4. PERFORMANCE & CODE QUALITY

**[Low] Playwright Overriding Spoofer Headers**

- **File**: `e2e/payment-processing.spec.ts` (Lines: 372-390)
- **What's wrong**: The test attempts to verify that the webhook rejects an oversized payload by passing a spoofed `"content-length": "50000000"` header.
- **Why it's a problem**: As noted in the test's own comment, Playwright automatically recalculates and overrides the `Content-Length` header based on the actual payload (`data: "{}"`). Therefore, the HTTP 413 "Payload Too Large" code path is never actually exercised at the transport layer by this test.
- **Suggested fix**: To genuinely test the 413 limit in E2E without Playwright's interference, either generate a real 50MB string payload (`data: 'x'.repeat(50 * 1024 * 1024)`), or use Node's native `http`/`fetch` modules inside the test to force the spoofed header through.

**[Low] Incomplete Playwright CLI Flag usage in CI**

- **File**: `playwright.config.ts` (Line: 13 & 19)
- **What's wrong**: `fullyParallel: true` is set, but `workers: process.env.CI ? 1 : undefined` is also set.
- **Why it's a problem**: Setting `workers: 1` in CI completely disables parallelization, rendering `fullyParallel: true` useless in the pipeline. While this is often done to prevent CI flakiness, it significantly increases test execution time.
- **Suggested fix**: If the CI environment has multiple cores, consider changing it to `workers: process.env.CI ? '50%' : undefined` to safely re-enable parallel testing and speed up your pipeline.
