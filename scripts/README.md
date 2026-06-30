# Scripts

Index of every script in this directory. The **Run by** column notes where a
script is invoked from: `CI` (a `.github/workflows/*` step), `npm` (a
`package.json` script), `husky` (a git hook), `deploy` (the build/deploy flow),
or `manual` (operator-run).

## Build & deploy

| Script                 | Language | Run by     | Purpose                                                                               |
| ---------------------- | -------- | ---------- | ------------------------------------------------------------------------------------- |
| `check-build-env.mjs`  | Node     | npm/deploy | Validates required build-time env vars before `opennextjs-cloudflare build`.          |
| `patch-opennext.mjs`   | Node     | npm/deploy | Pre-build patch for the OpenNext Cloudflare adapter.                                  |
| `post-build-patch.mjs` | Node     | npm/deploy | Post-build fixups for the Workers output bundle.                                      |
| `pages-build.sh`       | Bash     | manual     | Legacy Cloudflare Pages build script (superseded by the Workers deploy).              |
| `pre-deploy-check.sh`  | Bash     | deploy     | Pre-deploy config sanity checks (placeholders, KV isolation `--strict`, seed guards). |
| `staging-swap.sh`      | Bash     | manual     | Promote/swap the staging branch deploy.                                               |
| `create-staging-kv.sh` | Bash     | manual     | Provisions the staging-only `RATE_LIMIT_KV` namespace (fixes A-09).                   |

## CI guards (ratchets & invariants)

| Script                        | Language   | Run by    | Purpose                                                                                                    |
| ----------------------------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `check-bindings.ts`           | TypeScript | CI        | Flags wrangler.toml bindings not referenced anywhere in source.                                            |
| `check-bundle-budget.mjs`     | Node       | CI        | Fails if the shared JS bundle exceeds its size budget.                                                     |
| `check-cron-auth.ts`          | TypeScript | CI        | Verifies every `/api/cron/` route calls `verifyCronSecret()`.                                              |
| `check-cron-mapping.ts`       | TypeScript | CI        | Verifies all wrangler.toml `crons` blocks match the handler's `CRON_ROUTES`.                               |
| `check-db-types-drift.sh`     | Bash       | manual    | Detects `database.ts` drift vs the live schema (requires `SUPABASE_PROJECT_ID`).                           |
| `check-i18n-coverage.mjs`     | Node       | CI        | i18n coverage ratchet: untranslated `fr`→`en/ar` keys may shrink, never grow.                              |
| `check-knip-ratchet.mjs`      | Node       | CI        | Unused-file/export ratchet against the knip baseline.                                                      |
| `check-kv-isolation.ts`       | TypeScript | CI/deploy | Ensures staging KV namespace IDs are distinct from production (A-09); `--strict` also blocks placeholders. |
| `check-mvp-scope-refs.mjs`    | Node       | CI        | Verifies symbols referenced in `MVP_SCOPE.md` still exist in source.                                       |
| `check-security-coverage.mjs` | Node       | CI        | Asserts the documented security-test coverage posture.                                                     |
| `check-tenant-scoping.mjs`    | Node       | CI        | Guards tenant (clinic) scoping invariants.                                                                 |
| `check-translations.mjs`      | Node       | CI        | Validates translation files for structural issues.                                                         |
| `ratchet-coverage.mjs`        | Node       | manual    | Bumps `.vitest-coverage-floor.json` to current coverage.                                                   |
| `strip-suppressed-sarif.mjs`  | Node       | CI        | Removes in-source-suppressed findings from a SARIF before upload.                                          |
| `verify-cron-export.mjs`      | Node       | CI        | Verifies the cron handler exports match expectations.                                                      |
| `snapshot-rls-policies.mjs`   | Node       | CI        | Prints all RLS policies for PR-review visibility.                                                          |

## Security & secrets

| Script                        | Language   | Run by | Purpose                                                                        |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------------------------------ |
| `setup-worker-secrets.sh`     | Bash       | manual | Pushes the main Worker's secrets via `wrangler secret put`.                    |
| `setup-ai-worker-secrets.sh`  | Bash       | manual | Pushes the `webs-alots-ai` Worker's secrets.                                   |
| `rotate-phi-key.ts`           | TypeScript | manual | Re-encrypts PHI files in R2 from the old key to the new (AES-256-GCM).         |
| `check-secret-rotation.sh`    | Bash       | manual | Reports secrets overdue for rotation per `docs/secret-rotation-log.md`.        |
| `scan-pii-columns.mjs`        | Node       | CI     | Scans the schema for PII columns lacking the expected protections.             |
| `check-orphan-subdomains.mjs` | Node       | manual | Reports inactive/deleted clinic subdomains still served by the wildcard route. |

## Backup & disaster recovery

| Script       | Language | Run by  | Purpose                                                                                                                               |
| ------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `backup.sh`  | Bash     | CI/cron | `pg_dump` the database, optionally encrypt (AES-256-CBC + HMAC-SHA256 sidecar), upload to R2, rotate. Also `list`/`verify`/`restore`. |
| `r2-sync.sh` | Bash     | manual  | Replicate the primary R2 bucket to a replica bucket (`--verify` to compare counts).                                                   |
| `recover.sh` | Bash     | manual  | One-click disaster recovery (schema push, seed, deploy, secrets, restore).                                                            |

> Note: `backup.sh` backs up the **database only**. R2 object replication is a
> separate concern handled by `r2-sync.sh`. Encrypted backups are authenticated
> (Encrypt-then-MAC): the HMAC sidecar is verified before decryption on
> `verify`/`restore`, so a tampered or corrupt backup is rejected rather than loaded.

## Seeding & local dev

| Script                   | Language   | Run by | Purpose                                                           |
| ------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| `seed.ts`                | TypeScript | npm    | Primary demo seeder (`npm run seed` / `npm run demo:seed`).       |
| `seed-data.sql`          | SQL        | manual | Lightweight SQL seed fallback (used by `recover.sh`/CI).          |
| `seed-feature-flags.mjs` | Node       | manual | Prints/sets the initial feature-flag KV entries.                  |
| `dev-bootstrap.sh`       | Bash       | manual | Bootstraps a local dev environment (`.env.local`, local secrets). |

## i18n & maintenance tooling

| Script                      | Language | Run by    | Purpose                                                        |
| --------------------------- | -------- | --------- | -------------------------------------------------------------- |
| `extract-i18n.mjs`          | Node     | manual    | Extracts hardcoded strings into i18n keys.                     |
| `update-licenses.mjs`       | Node     | manual    | Regenerates `THIRD_PARTY_LICENSES.md` from the dep tree.       |
| `triage-eslint-warnings.sh` | Bash     | manual    | Summarises ESLint warnings by rule to help the ratchet.        |
| `run-chaos-tests.mjs`       | Node     | manual    | Chaos harness: inject faults, probe liveness, verify recovery. |
| `smoke-post-deploy.mjs`     | Node     | CI/manual | Post-deploy smoke test against the live site.                  |
