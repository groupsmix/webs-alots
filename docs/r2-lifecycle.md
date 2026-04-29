# R2 Lifecycle Rule for Direct Uploads

The direct-upload flow (`GET /api/upload` → presigned POST → `PUT /api/upload`
confirmation) has two failure modes that leave orphaned objects in the R2
bucket:

1. **Abandoned uploads** — the browser POSTs the file successfully but never
   calls the confirmation route (user closes the tab, network blip, etc.).
2. **Rejected confirmations** — confirmation finds a magic-byte mismatch and
   the route deletes the object. If the delete itself fails (transient R2
   error, IAM scope), the object is left behind.

Bytes accepted by R2 always satisfy the presigned POST policy
(`content-length-range 0..2 MB`, `Content-Type` lock), so the worst case is
a 2 MB orphan per abandoned attempt — but they accumulate over time.

## Required Lifecycle Rule

Add a single lifecycle rule on the `R2_BUCKET_NAME` bucket that expires any
object older than **24 hours** under the `clinics/` prefix that has *not*
been "promoted" to a confirmed upload. We rely on the rule to apply to the
entire `clinics/` prefix because:

- Confirmed uploads are persisted to the database within seconds of upload,
  so any object older than 24 h that the application no longer references
  is by definition orphaned.
- Cron-driven cleanup (querying the DB for unreferenced keys) requires
  schema changes to track "pending" uploads; the lifecycle rule is the
  cheaper guarantee.

### Wrangler / `wrangler.toml`

R2 lifecycle rules are configured via the Cloudflare dashboard or the
`wrangler r2 bucket lifecycle` commands — they are not part of
`wrangler.toml`. Apply with:

```bash
wrangler r2 bucket lifecycle add "$R2_BUCKET_NAME" \
  --id "expire-abandoned-uploads" \
  --prefix "clinics/" \
  --expire-days 1
```

To verify:

```bash
wrangler r2 bucket lifecycle list "$R2_BUCKET_NAME"
```

### Dashboard (manual)

1. Cloudflare dashboard → R2 → select the bucket.
2. **Settings** → **Object lifecycle rules** → **Add rule**.
3. Name: `expire-abandoned-uploads`.
4. Prefix: `clinics/`.
5. Expire current versions: **1 day**.
6. Save.

## Long-lived Uploads

Files that need to persist beyond 24 h (clinic logos, template assets) are
copied to a separate prefix (`clinics/{id}/logos/...`) and referenced from
the database immediately after the confirmation step. The lifecycle rule
above intentionally targets `clinics/` because confirmed uploads have their
last-modified time refreshed by the encryption pipeline (`r2-encrypted.ts`)
or by being re-PUT under a stable key.

If a future feature requires longer-lived direct uploads, either:

- carve out a sub-prefix excluded from the rule, or
- migrate confirmed uploads to a different bucket prefix (e.g.
  `confirmed/...`) and apply the lifecycle rule only to a `pending/...`
  prefix.

## Operational Notes

- The rule is **idempotent** — `wrangler r2 bucket lifecycle add` with the
  same `--id` updates an existing rule.
- Lifecycle deletions are billed as Class-A operations against the bucket;
  the volume is bounded by the upload rate-limit (10 uploads / minute /
  user, see `src/lib/rate-limit.ts`) so this is a non-issue.
- Server-side enforcement of `content-length-range` (via the presigned POST
  policy in `src/lib/r2.ts`) means abandoned uploads are bounded to
  `MAX_FILE_SIZE` (2 MB) — the lifecycle rule is the second line of defense,
  not the first.

---

## Native R2 Lifecycle Backstop (Task 3.3.4)

Separate from the cron-driven cleanup and the `expire-abandoned-uploads`
rule documented above, we run R2's **native** lifecycle engine as a
defense-in-depth backstop. This is purely additive — if the cron is wedged,
if the Worker is down, or if a future feature regresses the cleanup path,
R2 itself still enforces the minimum retention guarantees declared here.

The rule set lives as a checked-in JSON file and is applied to a bucket via
a small Node script that calls the Cloudflare REST API directly.

### Files

- [`r2-lifecycle.json`](../r2-lifecycle.json) — JSONC-ish declaration of the
  lifecycle rules. Shape matches the [Cloudflare R2 lifecycle
  API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update).
  `//` line comments and object fields starting with `_` are stripped by
  the apply script before the body is POSTed.
- [`scripts/apply-r2-lifecycle.mjs`](../scripts/apply-r2-lifecycle.mjs) —
  applies the JSON to a bucket. Reads account ID, API token, and bucket
  name from environment variables. Idempotent: the Cloudflare API replaces
  the entire rule set on every `PUT`.

### Rules

#### `abort-incomplete-multipart-1d` (enabled)

Aborts any multipart upload that has not been completed within 24 hours and
releases the associated part storage. Applies to the **entire bucket**
(empty prefix).

The direct-upload flow uses presigned POSTs capped at 2 MB, so it does not
start multipart uploads. This rule covers every other producer of multipart
state:

- the AWS SDK used by backup/recovery scripts (`scripts/backup.sh`,
  `scripts/recover.sh`, `scripts/r2-sync.sh`),
- ad-hoc SOP tooling (PHI key rotation, staging swap),
- any future large-file feature (clinical imaging, exports) that opts into
  the multipart API.

Abandoned part data is billed against the bucket and is invisible to the
confirm-upload route's cleanup — R2's own engine is the only thing that
can reclaim it reliably.

#### `expire-pending-uploads-30d` (commented-out stub)

Commented out inside `r2-lifecycle.json` because it depends on a future
code change (see below). When enabled, it would delete any object under
the `clinics/_pending/` prefix after 30 days — a belt-and-braces expiry on
direct uploads that were accepted by R2 but never promoted to a confirmed
record.

Do **not** uncomment the stub until the application actually writes
unconfirmed uploads to `clinics/_pending/`. Today they are written directly
to `clinics/{id}/...` alongside long-lived assets (logos, templates), so an
age-based delete on any `clinics/` sub-prefix would destroy confirmed data.

### Running the script

```bash
# Staging
export CLOUDFLARE_ACCOUNT_ID=...       # same as Workers deploy
export CLOUDFLARE_API_TOKEN=...        # token with "R2 Edit" on the bucket
export R2_BUCKET_NAME=webs-alots-uploads-staging
node scripts/apply-r2-lifecycle.mjs

# Production
export R2_BUCKET_NAME=webs-alots-uploads
node scripts/apply-r2-lifecycle.mjs
```

The script exits non-zero if any env var is missing or if the Cloudflare
API returns an error (`success: false` or non-2xx), so it is safe to wire
into a deploy pipeline.

Useful flags:

- `--dry-run` — prints the exact request body without hitting the API.
  Use this to inspect what the JSONC stripper produced.
- `--file=PATH` — apply a non-default config file (e.g. during a migration).

### Verifying

After applying, confirm via `wrangler`:

```bash
wrangler r2 bucket lifecycle list "$R2_BUCKET_NAME"
```

The `abort-incomplete-multipart-1d` rule should appear with an
AbortIncompleteMultipartUpload transition at 1 day. `wrangler` also surfaces
the `expire-abandoned-uploads` rule from the pre-existing setup — both
coexist because each targets a different object lifecycle concern.

### Required API token scopes

Create a scoped token at
<https://dash.cloudflare.com/profile/api-tokens> with:

- **Account** → **Workers R2 Storage** → **Edit** (scoped to the specific
  account and, if the UI allows, to the individual bucket).

Store it as `CLOUDFLARE_API_TOKEN` in the CI secret store. The token used
for `wrangler deploy` has the right scope; you can reuse it.

### Future refactor: `clinics/_pending/`

The long-term plan is to stop writing unconfirmed direct uploads straight
to `clinics/{id}/...` and instead:

1. Presigned POST targets `clinics/_pending/{clinic_id}/{upload_id}`.
2. The confirm-upload route moves the object to its final
   `clinics/{id}/...` key after magic-byte validation and DB persistence.
3. The `expire-pending-uploads-30d` rule then safely cleans up anything
   that never got promoted, without risk to long-lived assets.

Once that refactor lands:

- Uncomment the `expire-pending-uploads-30d` rule in
  [`r2-lifecycle.json`](../r2-lifecycle.json).
- Re-run `node scripts/apply-r2-lifecycle.mjs` against both staging and
  production.
- Consider retiring the legacy `expire-abandoned-uploads` rule described
  at the top of this document — its `clinics/` prefix becomes redundant
  once unconfirmed uploads live under `clinics/_pending/`.
