# Scripts

Index of all scripts in this directory.

| Script                        | Language   | Purpose                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------ |
| `backup-database.sh`          | Bash       | Full Supabase database backup via pg_dump                    |
| `backup.sh`                   | Bash       | Combined backup (DB + R2 files)                              |
| `check-bundle-budget.mjs`     | Node       | CI guard — fails if shared JS bundle exceeds budget          |
| `check-cron-mapping.ts`       | TypeScript | CI guard — verifies wrangler.toml crons match route handlers |
| `check-db-types-drift.sh`     | Bash       | CI guard — detects stale `database.ts` vs migrations         |
| `check-orphan-subdomains.mjs` | Node       | Finds DNS records with no matching clinic row                |
| `check-security-coverage.mjs` | Node       | Documents security test coverage posture                     |
| `extract-i18n.mjs`            | Node       | Extracts hardcoded strings into i18n translation keys        |
| `pages-build.sh`              | Bash       | Cloudflare Pages build script (legacy)                       |
| `patch-opennext.mjs`          | Node       | Post-install patch for OpenNext Cloudflare adapter           |
| `post-build-patch.mjs`        | Node       | Post-build fixups for Workers output                         |
| `pre-deploy-check.sh`         | Bash       | Pre-deployment sanity checks (env, migrations, build)        |
| `r2-sync.sh`                  | Bash       | Sync R2 bucket contents between environments                 |
| `ratchet-coverage.mjs`        | Node       | Bumps `.vitest-coverage-floor.json` to current coverage      |
| `recover.sh`                  | Bash       | Disaster recovery — restore DB from backup                   |
| `rotate-phi-key.ts`           | TypeScript | Re-encrypts PHI files after encryption key rotation          |
| `seed-data.sql`               | SQL        | Development seed data for local Supabase                     |
| `snapshot-rls-policies.mjs`   | Node       | Prints all RLS policies for PR review visibility             |
| `staging-swap.sh`             | Bash       | Swap staging ↔ production Cloudflare Workers                 |
