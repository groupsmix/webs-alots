# A31–A60 Audit — Dashboard Action Checklist

The code-side fixes for the A31–A60 hostile audit ship in PR
`audit/A31-A60-fixes`. Several findings are not addressable from the
repo because they live in the Cloudflare or Sentry dashboard, on the
GitHub org settings, or as a workflow policy. This file is the
operator's checklist for closing them.

Status legend: `[ ]` pending · `[x]` done · `(n/a)` not applicable.

---

## 1. Cloudflare KV — provision dedicated staging namespace (CRIT, #1)

- [ ] On the machine with `wrangler` authenticated to the production
      Cloudflare account, run:

      ./scripts/create-staging-kv.sh

- [ ] Paste the printed `id` and `preview_id` into `wrangler.toml`
      under `[[env.staging.kv_namespaces]]`, replacing the
      `REPLACE_BEFORE_STAGING_DEPLOY_*` placeholders.
- [ ] Run `bun run scripts/check-kv-namespace-collision.mjs --strict`
      locally to confirm. Commit and merge.

## 2. Cloudflare Notifications — billing-anomaly alert (HIGH, #2)

The code change (`cpu_ms = 30000`) caps runaway per-invocation cost.
The complementary control is an account-level alert.

- [ ] Cloudflare Dashboard → Notifications → Add → "Workers and Pages"
      category → "Workers Usage Notification".
- [ ] Threshold: daily invocations > expected baseline × 3 (suggest
      starting at 10M/day; tune after one week of telemetry).
- [ ] Send to: oncall PagerDuty + #ops Slack.

## 3. AV scan — set `AV_SCAN_URL` in production (HIGH, #3)

The PR makes PHI categories *always* fail closed when no scanner is
configured. Production must therefore configure one before merging,
or PHI uploads (`patient_documents`, `radiology`, `lab_results`, etc.)
will be rejected with HTTP 503.

- [ ] Decide on scanner: clamav-rest container vs. ClamScan Lambda vs.
      a managed vendor.
- [ ] Provision and harden: 25 MB body limit, 15s timeout matches the
      Workers-side `AbortSignal.timeout`.
- [ ] `wrangler secret put AV_SCAN_URL --env production`.
- [ ] (Optional, for non-PHI hardening) `wrangler secret put
      AV_SCAN_REQUIRED --env production` set to `true`.
- [ ] Add scanner uptime to the existing uptime-monitor cron.

## 4. CORS — verify no legitimate cross-tenant XHR (MED, #4)

The PR drops `Access-Control-Allow-Credentials: true` on
cross-tenant origins. If any internal tool relied on this (e.g. an
admin page on `admin.oltigo.com` reading data from a tenant API),
that tool will start failing with a missing-cookie error.

- [ ] Grep internal admin/ops apps for `credentials: 'include'` calls
      targeting a hostname different from the page hostname.
- [ ] If any are found, decide: move them to the same hostname, or
      switch them to a server-side proxy with HMAC.

## 5. CSS-vars refactor — finish the `style-src` unsafe-inline removal (MED, #5)

Tracked as `H-01`. Not in this PR. Recommend a follow-up PR per
component family (admin, dashboard, public-marketing).

- [ ] `rg --no-heading -n 'style=' src/components | wc -l` — current
      inline-style count.
- [ ] Open issue: "Reduce inline styles by 25% per sprint until 0,
      then remove `'unsafe-inline'` from `style-src`".

## 6. Block manual deploys (MED, #6)

`typescript.ignoreBuildErrors: true` is justified for the Workers
Builds OOM, but means a `wrangler deploy` from a developer's laptop
would skip the CI `tsc --noEmit` gate.

- [ ] Disable production deploy from non-CI: rotate the production
      Cloudflare API token to one stored only in GitHub Actions secrets.
- [ ] Optional: add a `pre-push` hook that refuses pushes containing
      `wrangler deploy` if the working tree differs from `main`.

## 7. R2 — enable object versioning on PHI buckets (MED, #7)

R2 supports bucket-level object versioning. The lifecycle file remains
thin (one rule) until the `clinics/_pending/` refactor lands.

- [ ] Cloudflare Dashboard → R2 → `webs-alots-uploads` → Settings →
      Object Versioning → Enable.
- [ ] Same for `webs-alots-uploads-staging`.
- [ ] Set retention policy: keep non-current versions for 30 days
      (matches RTO/RPO in `docs/bcp.md`).
- [ ] (Optional) Set Object Lock in Compliance mode for PHI buckets
      if HIPAA/Law 09-08 evidence retention requires immutability.

## 8. Cloudflare Logpush — enable R2 access logs (INFO, A37.7)

- [ ] Cloudflare Dashboard → Analytics & Logs → Logpush → New job →
      R2 → both buckets → destination: R2 (separate audit bucket) or S3.
- [ ] Verify logs include `actor`, `key`, `operation`, `result`.

## 9. Cloudflare TLS settings (INFO, A36.2)

- [ ] SSL/TLS → Edge Certificates → Minimum TLS Version = 1.2.
- [ ] SSL/TLS → Edge Certificates → TLS 1.3 = Enabled.
- [ ] SSL/TLS → Edge Certificates → Opportunistic Encryption = On.
- [ ] SSL/TLS → Edge Certificates → Automatic HTTPS Rewrites = On.

## 10. GitHub org-level controls (INFO, A34.6)

- [ ] Branch protection on `main`: required signed commits, required
      reviews (1+), required status checks (full CI matrix), require
      branches up to date.
- [ ] Enforce 2FA org-wide (Settings → Organization security).
- [ ] Restrict force-push and branch deletion on `main`.

## 11. Sentry — shorten retention on PHI-adjacent envs (INFO, A41.11)

- [ ] Sentry → Settings → Org → Data retention.
- [ ] Confirm matches the Privacy Notice (`docs/plausible-privacy.md`
      and the BAA if one exists).

## 12. R2 token scoping (INFO, A35.6)

- [ ] Cloudflare → My Profile → API Tokens.
- [ ] Verify the R2 token used by `backup.yml` is scoped to
      `webs-alots-uploads`, `webs-alots-uploads-staging`, and
      `webs-alots-backups` only — not "Object Read & Write" on all
      buckets.

---

## After the checklist

When all rows above are `[x]`, update `docs/security-evidence-index.md`
with a link back to this file plus the date of completion. This forms
the SOC-2 evidence trail for the A31–A60 audit cycle.
