# Runbook: seed the feature/pricing catalogue + diagnose AI Settings "Failed to load"

> Two operator tasks that need DB / infra access (they can't be done from a code PR):
>
> 1. **Populate `feature_definitions` + `pricing_tiers` in staging/production** so the
>    Marketplace and Feature Matrix aren't empty.
> 2. **Diagnose the AI Settings "Failed to load AI configuration" error** and the
>    emergency-stop "status unavailable" state.

---

## Part 1 — Seed the feature / pricing catalogue

### Why it can be empty in production

Migrations are applied by `db-migrate.yml` via `supabase db push --include-all`, which
applies **`supabase/migrations/**` only**. The feature catalogue and pricing tiers are
seeded in **`supabase/seeds/00025_seed_features_pricing.sql`**, and `supabase/seeds/`is
**not** applied by`db push`(it runs only on a local`supabase`reset). So a
production DB created via`db push`can have empty`feature_definitions`/`pricing_tiers`
→ empty Marketplace and empty Feature Matrix.

> The AI tables are **not** affected: `ai_provider_configs` + `ai_feature_toggles` are
> seeded inside **migration `00123`**, so they reach production normally. (See Part 2 for
> why AI Settings can still look empty.)

### The seed is safe to run repeatedly

`00025` ends each INSERT with `ON CONFLICT (key) DO NOTHING` (features) and
`ON CONFLICT (slug) DO NOTHING` (tiers). Re-running it never duplicates or overwrites
existing rows — if the data is already there, it's a no-op.

### Steps

1. **Get the database connection string.**
   Supabase Dashboard → your project → **Settings → Database → Connection string**.
   Use the **Session/Direct** connection (port 5432) for running a one-off SQL file. Keep
   it out of shell history (the `PGPASSWORD`/URL below is sensitive).

2. **Apply to STAGING first.**

   ```bash
   psql "postgresql://postgres:<STAGING_DB_PASSWORD>@<STAGING_HOST>:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seeds/00025_seed_features_pricing.sql
   ```

3. **Verify the row counts on staging.**

   ```bash
   psql "<STAGING_DB_URL>" -c "select count(*) as features from feature_definitions;"
   psql "<STAGING_DB_URL>" -c "select count(*) as tiers from pricing_tiers;"
   ```

   Expect ~60 features and 5 tiers. Then open **/super-admin/marketplace** and
   **/super-admin/features** on staging and confirm they list rows.

4. **Repeat against PRODUCTION** once staging looks right (same commands with the prod
   connection string).

> Prefer not to use `psql`? The Supabase Dashboard **SQL Editor** works too: paste the
> contents of `supabase/seeds/00025_seed_features_pricing.sql` and run it.

---

## Part 2 — Diagnose AI Settings "Failed to load" + emergency-stop "status unavailable"

The page loads two endpoints; either failing produces the symptom:

- `GET /api/admin/ai-config` → providers / feature toggles / usage. On failure the page
  shows the **"Couldn't load the AI configuration"** banner.
- `GET /api/admin/ai-kill-switch` → `{ ai_enabled, env_locked, kv_available }`. On failure
  the emergency-stop section shows **"status unavailable"** (with the Force-stop fallback
  added in the AI-7 change).

Work top-down — stop at the first step that explains it.

### Step 0 — Geo-restriction (most common cause) 🌍

`/api/admin/*`, `/admin`, and `/dashboard` are **geo-restricted to Morocco (`MA`)** by
default (`src/lib/middleware/geo-restriction.ts`). An operator browsing from outside
Morocco — or on a VPN, or whose IP is mis-geolocated — gets a **JSON `403`
`{ code: "GEO_RESTRICTED" }`** on those API calls, so AI Settings "fails to load" even
though the backend is healthy.

**Confirm:** open DevTools → Network, reload AI Settings, click the `ai-config` request.
A `403` with body `code: "GEO_RESTRICTED"` confirms it.

**Resolve (pick one):**

- Access from an allowed region (Morocco), or
- Add your region to the allowlist via `GEO_RESTRICT_ADMIN` (comma-separated ISO country
  codes, e.g. `MA,FR`), or
- Disable the admin geo-gate entirely with `ADMIN_GEO_RESTRICTION_ENABLED=false`
  (set on the Worker / env). Re-deploy or restart so it takes effect.

### Step 1 — Authentication / role

Both endpoints are `withAuth(["super_admin"])`. If your session isn't `super_admin` (or
expired), they return `401/403`. Confirm you're logged in as a super admin and the
session is fresh.

### Step 2 — Data (only if Step 0/1 are clean)

`ai_provider_configs` and `ai_feature_toggles` ship with migration `00123`, so on a
migrated DB they're populated. Verify:

```bash
psql "<DB_URL>" -c "select provider, is_active from ai_provider_configs order by routing_tier;"
psql "<DB_URL>" -c "select feature_key, is_enabled from ai_feature_toggles;"
```

- If these return rows, the empty UI is **not** a data problem → it's Step 0/1 (geo/auth)
  or Step 4 (a server error).
- If they're empty, the migration didn't apply — re-run `db-migrate.yml` (or
  `supabase db push --include-all`) against that project.

### Step 3 — Kill-switch KV binding

`GET /api/admin/ai-kill-switch` reports `kv_available`. If it's `false`, the
`FEATURE_FLAGS_KV` namespace isn't bound to the Worker:

- The **dashboard toggle can't persist** a stop (POST returns a 503 telling you to use the
  env override). The AI-7 **Force emergency stop** surfaces that same message.
- To halt AI **right now** without KV, set **`AI_DISABLED=true`** on the Worker env
  (this always wins — `env_locked: true` — and the dashboard can't re-enable until it's
  removed).
- To make the in-app switch work, bind `FEATURE_FLAGS_KV` (see `wrangler.toml` — the
  binding is documented there) and re-deploy.

### Step 4 — Server logs (if Steps 0–3 are clean and it still fails)

A genuine `500` from `ai-config` means a DB/query error other than "table missing". Pull
the Worker logs and look for the structured entries:

- context **`ai-config`** (the route logs `Failed to load AI config` / query errors), and
- context **`ai-settings`** (the client logs the failed load).

```bash
# Cloudflare Worker live logs
npx wrangler tail webs-alots --env production --format pretty | grep -i "ai-config\|ai-settings"
```

The logged Postgres error code/message tells you the specific cause (permissions, a
column/type mismatch, RLS, etc.).

---

## Quick reference

| Symptom                                             | Most likely cause                         | Fix                                                                           |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Marketplace / Feature Matrix empty                  | `feature_definitions` not seeded (Part 1) | Run `supabase/seeds/00025` against the DB                                     |
| AI Settings "Failed to load" from abroad            | Admin geo-restriction `403`               | Allow region via `GEO_RESTRICT_ADMIN` / `ADMIN_GEO_RESTRICTION_ENABLED=false` |
| AI providers empty but DB has rows                  | Geo/auth on `ai-config`, not data         | Steps 0–1                                                                     |
| Emergency stop "status unavailable" / can't persist | `FEATURE_FLAGS_KV` not bound              | Bind KV, or use `AI_DISABLED=true` to stop now                                |
| Genuine 500 after the above                         | DB/query error                            | `wrangler tail` → grep `ai-config`                                            |

### Related env / flags

- `GEO_RESTRICT_ADMIN`, `ADMIN_GEO_RESTRICTION_ENABLED` — admin geo allowlist / kill.
- `AI_DISABLED` — hard env override that disables all AI (beats the dashboard switch).
- `FEATURE_FLAGS_KV` — Worker KV namespace backing the `ai.enabled` kill switch.

See also: `docs/production-env-matrix.md`, `docs/deployment.md`, `docs/ENVIRONMENTS.md`.
