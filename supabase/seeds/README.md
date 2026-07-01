# `supabase/seeds/` — manually-applied seed data

These SQL files are **not** part of the migration chain and are **not** run
automatically by `supabase db reset` (the CLI runs only `supabase/seed.sql`,
and `config.toml` defines no `[db.seed]` override). They are applied by hand
against a target database when demo/catalogue data is needed.

Do not renumber these to match `supabase/migrations/`. The numeric prefixes are
historical and intentionally overlap with migration numbers; the migration
`CHANGELOG.md` lists `00003`, `00025`, and `00044` as gaps because the work was
delivered here as seed data rather than as schema migrations.

## Files

| File                              | Purpose                                                                                                                                                  | When to run                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `00003_seed_data.sql`             | Demo clinic, users (admin/doctor/receptionist/patients), time slots, sample appointments. Used by the e2e suites under `e2e/` when `E2E_DEMO_SEED=true`. | Local dev / e2e / demo environments only. Never production.                  |
| `00025_seed_features_pricing.sql` | `feature_definitions` and pricing/plan catalogue. See `docs/runbooks/seed-catalogue-and-ai-config.md`.                                                   | Any environment whose Marketplace / feature matrix is empty.                 |
| `00044_dedup_seed_data.sql`       | One-off historical fixup that de-duplicated services/doctor rows accidentally re-seeded by migration `00040`.                                            | Legacy databases only — irrelevant to fresh installs. Kept for auditability. |

## Safety

- These scripts insert well-known demo credentials (see `seed.sql`). The
  application refuses to boot in `production`/`staging` until the seed
  passwords are rotated (`SEED_PASSWORDS_ROTATED=true`) and the seed users are
  removed — never apply `00003_seed_data.sql` to a production database.
