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
