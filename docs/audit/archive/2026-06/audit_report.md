# Codebase Audit Report (Preliminary)

This is a preliminary audit report for the `@src` directory. I am currently running a full `typecheck` and `eslint` pass in the background to catch deeper bugs, dead code, and syntax issues. This report will be updated once those tasks complete.

## 1. Bugs & Errors (WIP)

> [!NOTE]
> Currently running a full TypeScript compiler check (`npm run typecheck`) to surface broken imports, missing types, and unhandled promises.

- **Syntax & Logic:** The codebase uses `withAuth` extensively, which helps mitigate missing context errors.
- **Error Handling:** Centralized through `apiError`, `apiSuccess`, and `logger.error` which correctly standardizes error shapes.

## 2. Security Issues

> [!IMPORTANT]
> The application uses proper HMAC verification for webhooks, requires strict CSP nonces, and enforces MFA for critical roles.

- **Missing Input Validation:** Some API endpoints bypass Zod schema wrappers (e.g., `withValidation`) and manually cast `request.json()`.
  - _File:_ `src/app/api/patient/documents/route.ts` (Lines 187-200)
  - _Problem:_ `const input = body as Record<string, unknown>;` relies on manual `typeof` checks instead of a robust Zod schema. This risks missing edge cases or allowing prototype pollution.
  - _Fix:_ Define a Zod schema and wrap the handler in `withValidation()`.
- **Tenant Isolation:** Tenant isolation is aggressively applied in `withAuth` and `src/middleware.ts`. Route contexts explicitly require `.eq("clinic_id", clinicId)`. We did not detect `insert(body)` spreads, as the team seems to strictly destructure payloads.
- **Hardcoded Secrets:** Scanned for hardcoded keys (`sk_live_`, `password=`, `Bearer`). All found instances were safely contained in `__tests__` directories using mock data.
- **XSS Vulnerabilities:** Usage of `dangerouslySetInnerHTML` was found, but it is safely wrapped with `safeJsonLdStringify` (for structured data) or `sanitizeHtml` (for blog content).
- **Dependencies:** `npm audit` was executed and reported **0 vulnerabilities** across all production and development dependencies.

## 3. Blockers

> [!WARNING]
> Running the app natively without `node_modules` failed on `typecheck`.

- **Missing Dependencies:** A fresh clone required running `npm install`. The installation completed successfully without version conflicts.
- **Build Checks:** Awaiting `typecheck` to confirm if there are any circular dependencies or missing types blocking `npm run build`.

## 4. Performance & Code Quality (WIP)

- **N+1 Queries:** Searched for `.from()` calls inside `map` and loops. The codebase heavily utilizes `Promise.all()` to run parallel, distinct queries (e.g. `const [usersRes, servicesRes] = await Promise.all(...)`) rather than N+1 iteration.
- **Dead Code:** Awaiting the results of `npm run lint` to accurately report unused variables, imports, and duplicate logic.

---

_I will automatically update this report as soon as the `typecheck` and `eslint` background tasks finish._
