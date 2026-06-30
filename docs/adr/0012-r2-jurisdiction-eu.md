# ADR-0012: R2 Bucket Jurisdiction Set to EU

**Date:** 2026-06-27
**Status:** Accepted
**Deciders:** Core team

## Context

Oltigo Health stores encrypted patient files (lab results, prescriptions,
imaging) in Cloudflare R2. These files are Protected Health Information (PHI)
subject to Moroccan Law 09-08 (CNDP). Cloudflare R2's `jurisdiction`
attribute controls which regional data envelope the bucket's data is confined
to.

The Cloudflare Terraform provider (v5.x) accepts three jurisdiction values:

| Value     | Meaning                                           |
| --------- | ------------------------------------------------- |
| `default` | Cloudflare selects region; may include US storage |
| `eu`      | Data confined to the European Union               |
| `fedramp` | US FedRAMP boundary (US government use only)      |

There is no Africa or Morocco-specific jurisdiction option.

**Critical constraint:** `jurisdiction` is a `ForceNew` attribute — once a
bucket is created, it cannot be changed without destroying and recreating the
bucket. The production bucket also has `prevent_destroy = true`.

Note that the production bucket `webs-alots-uploads` **already exists** (it
backs live uploads declared in `wrangler.toml`) and was created via
`wrangler r2 bucket create`, which places it in the **`default`** jurisdiction.
A `default`-jurisdiction bucket cannot be imported or addressed as `eu` —
jurisdictional buckets occupy a separate API namespace. So setting `eu` is not
a one-line change for the existing bucket; it requires the migration runbook
documented in `infra/README.md` ("R2 jurisdiction migration").

Previously the Terraform jurisdiction variable defaulted to `null`,
leaving the jurisdiction unset and Cloudflare free to store PHI anywhere
(including the US). This was inconsistent with the "EU jurisdiction (pinned)"
claim already recorded in `docs/data-residency.md`.

## Decision

Set the R2 jurisdiction to **`"eu"`** as the explicit, non-nullable default for
both buckets via `production_r2_bucket_jurisdiction` and
`staging_r2_bucket_jurisdiction` in `infra/variables.tf`. This is enforced at
plan time by Terraform `validation` blocks that reject any value outside
`default | eu | fedramp`.

The `eu` jurisdiction is the closest available geographic boundary to Morocco
and aligns with:

- The existing Supabase/AWS Ireland primary database residency.
- The Cloudflare DPA signed with the EU Data Processing Addendum.
- The "adequate protection" position under Law 09-08 (EU SCCs + Cloudflare DPA).
- The existing claim in `docs/data-residency.md`.

## Alternatives Considered

1. **`default`** — Cloudflare may place data in US storage. Incompatible with
   the data-residency guarantee already documented and operationally undesirable
   for a health platform.

2. **`fedramp`** — US government boundary. Not applicable to a Moroccan
   commercial health platform.

3. **`null` / unset (status quo)** — Equivalent to `default` in practice.
   Leaves residency undefined and contradicts `docs/data-residency.md`.

## Consequences

- **Positive:** R2 PHI storage is now explicitly EU-confined, consistent with
  the documented sub-processor registry and Law 09-08 cross-border transfer
  position.
- **Positive:** The `validation` block in `variables.tf` prevents silent drift
  — any attempt to set an unsupported value fails at `terraform plan`.
- **Risk:** `eu` jurisdiction may have slightly higher latency for Moroccan
  users than `default` (which might select a closer PoP). In practice, files
  are served via Workers (not directly from R2), so this is negligible.
- **Immutability:** Because `jurisdiction` is ForceNew and the production
  bucket carries `prevent_destroy`, the value cannot be flipped in place. The
  production bucket already exists in the `default` jurisdiction, so reaching
  the `eu` target requires the data-backup → bucket-recreation → data-restore
  → import procedure in `infra/README.md` ("R2 jurisdiction migration"). Until
  that migration runs, operators must either complete it or import the bucket
  as-is by temporarily setting `production_r2_bucket_jurisdiction` to its
  current value (see the runbook's Option B).

## References

- `docs/data-residency.md` — sub-processor registry with R2 residency claim
- `docs/adr/0002-phi-encryption-r2.md` — client-side AES-256-GCM encryption
- `infra/variables.tf` — `production_r2_bucket_jurisdiction` / `staging_r2_bucket_jurisdiction` variable definitions
- `infra/r2.tf` — R2 bucket resources with `prevent_destroy`
- `infra/README.md` — "R2 jurisdiction migration" runbook for the existing bucket
- Cloudflare R2 jurisdiction docs: https://developers.cloudflare.com/r2/buckets/jurisdictions/
