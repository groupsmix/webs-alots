# Contributing to Oltigo Health

Thank you for your interest in contributing! This guide covers the conventions and workflows used in this project.

## Getting Started

```bash
# Clone and install
git clone https://github.com/groupsmix/webs-alots.git
cd webs-alots
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

## Git Branching Strategy

- **`main`** — Production branch. Deploys automatically to Cloudflare Workers.
- **`staging`** — Staging branch. Deploys automatically to the staging Worker.
- **Feature branches** — Branch from `main` with descriptive names: `feature/booking-recurring`, `fix/tenant-isolation-webhook`, etc.

### Workflow

1. Create a feature branch from `main`
2. Make changes, commit with conventional commits (see below)
3. Open a pull request targeting `main`
4. CI must pass (lint, typecheck, unit tests, E2E tests, bundle size check)
5. Get at least one review approval
6. Squash and merge

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add recurring appointment booking
fix: prevent cross-tenant data leak in webhook handler
docs: update WhatsApp template approval guide
test: add integration tests for booking cancellation flow
chore: upgrade Next.js to 16.2
refactor: extract shared Supabase mock to test-utils
```

## Code Style

- **TypeScript** — Strict mode. No `any`, `getattr`, or `setattr`.
- **ESLint** — Run `npm run lint` before committing. Pre-commit hook runs it automatically.
- **Formatting** — Follow existing file conventions. No Prettier configured; match the surrounding code.
- **Imports** — Place all imports at the top of files. Use `@/` path alias for `src/` imports.

## Multi-Tenant Architecture Rules

**Critical — every contributor must follow these:**

1. **Always scope by `clinic_id`** — Every database query must include `.eq("clinic_id", clinicId)`. Never query across tenants.
2. **Use `requireTenant()` or `requireTenantWithConfig()`** — Never hardcode clinic IDs.
3. **Never trust client-supplied tenant headers** — The middleware strips and re-applies them from the database.
4. **RLS is defense-in-depth** — Application-level scoping is required even though RLS policies exist.
5. **Test tenant isolation** — When adding new endpoints, add E2E tests verifying cross-tenant access is blocked.

## Adding New API Endpoints

1. Create the route file under `src/app/api/your-endpoint/route.ts`
2. Use `withAuth()` or `withAuthValidation()` wrappers from `@/lib/with-auth` and `@/lib/api-validate`
3. Define a Zod schema in `@/lib/validations` for request body validation
4. Use response helpers from `@/lib/api-response` (`apiSuccess`, `apiError`, `apiNotFound`, etc.)
5. Add audit logging via `logAuditEvent()` for state-changing operations
6. Scope all database queries by `clinic_id`
7. Add tests:
   - **Schema validation tests** in `src/app/api/__tests__/`
   - **Route handler tests** that import and invoke the actual handler
   - **E2E tests** in `e2e/` for critical flows

## Writing Tests

### Unit Tests (Vitest)

- Location: `src/lib/__tests__/`, `src/components/__tests__/`, `src/app/api/__tests__/`
- Use shared mocks from `src/components/__tests__/test-utils.ts` for Supabase, tenant, and logger
- Import and test actual functions — avoid tautological tests that only test the test data
- Coverage thresholds: 80% statements, 70% branches

```bash
npm run test          # Run all unit tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### E2E Tests (Playwright)

- Location: `e2e/`
- Configured for Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari
- Run against `npm run build` + `npx next start` in CI

```bash
npm run test:e2e              # Run all E2E tests
npx playwright test --ui      # Interactive UI mode
npx playwright test --headed  # See the browser
```

### Integration Tests

- Location: `src/lib/__tests__/integration/`
- Test complete server-side flows (booking → cancellation → notification)
- Use mocked Supabase clients, not real database

## Database Migrations

- Location: `supabase/migrations/`
- Naming: Sequential 5-digit prefix — `00061_description.sql`, `00062_description.sql`, etc.
- Always include `IF NOT EXISTS` / `IF EXISTS` guards
- Always add RLS policies for new tables with `clinic_id` scoping
- CI validates migration numbering and basic SQL syntax on PRs that touch migrations

```bash
supabase db push    # Apply migrations
```

## Security Requirements

- **Never log secrets or PHI** — Use structured logging via `@/lib/logger`
- **PHI encryption** — Patient files (prescriptions, lab results, x-rays) must be encrypted with AES-256-GCM via `@/lib/encryption`
- **Audit logging** — All state-changing operations must call `logAuditEvent()`
- **Input validation** — All API inputs must be validated with Zod schemas
- **CSRF** — Enforced automatically by middleware for mutation methods

## Moroccan Domain Specifics

- **Timezone**: Always use `Africa/Casablanca` via `@/lib/timezone` helpers
- **Currency**: MAD (Moroccan Dirham)
- **Insurance types**: CNSS, CNOPS, AMO, RAMED
- **Languages**: French (default), Arabic (RTL), English
- **Phone format**: +212 (Moroccan)
- **WhatsApp templates**: 10 Darija templates — see `docs/whatsapp-template-approval.md`

## Pre-commit Hooks

The project uses Husky with the following pre-commit checks:

1. `lint-staged` — ESLint with auto-fix on changed `.ts`/`.tsx` files
2. `tsc --noEmit` — TypeScript type checking
3. `vitest run --passWithNoTests` — Full unit test suite

## CI Pipeline

Pull requests run:

1. **ESLint** + **TypeScript** type check
2. **Unit tests** (Vitest)
3. **Bundle size budget** (250 kB shared JS limit)
4. **E2E tests** (Playwright with Chromium)

Deploy pipeline (on push to `main`/`staging`) additionally runs unit tests before deploying.

## Questions?

Open a discussion or reach out to the maintainers.
