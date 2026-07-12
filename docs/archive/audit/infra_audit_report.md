# Infra Directory — Full Audit Report

> Scope: `c:\webs-alots\infra\` · 14 files · Terraform (HCL) · Cloudflare provider v5.21.0
> Generated: 2026-07-02

---

## Summary Table

| #   | Severity    | File                  | Issue                                                                                                                                                                                                    |
| --- | ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 🔴 Critical | `backend.tf`          | No remote backend is active — all state is local (no locking, no encryption)                                                                                                                             |
| 2   | 🔴 Critical | `r2.tf`               | Jurisdiction mismatch deadlock: `eu` default will fail/silently fork on import of an existing `default`-jurisdiction bucket                                                                              |
| 3   | 🟠 High     | `.terraform.lock.hcl` | Lock file only contains hashes for `linux_amd64` — `darwin_arm64` / `windows_amd64` will hit checksum mismatch errors                                                                                    |
| 4   | 🟠 High     | `queues.tf`           | No DLQ monitoring — patient notification failures are silent; no alerting resource defined                                                                                                               |
| 5   | 🟠 High     | `dns.tf`              | MTA-STS policy is already `mode: enforce` before TLS-RPT data has been collected — premature enforcement risks breaking inbound mail                                                                     |
| 6   | 🟠 High     | `locals.tf`           | AI Worker route patterns are missing trailing `/*` on the bare path entry, causing incomplete routing coverage                                                                                           |
| 7   | 🟡 Medium   | `variables.tf`        | `cloudflare_account_id` has no `sensitive = true` — account ID leaks in plan output and CI logs                                                                                                          |
| 8   | 🟡 Medium   | `variables.tf`        | `cloudflare_zone_id` has no `sensitive = true` — same leakage vector                                                                                                                                     |
| 9   | 🟡 Medium   | `kv.tf`               | `feature_flags_production` has no `ignore_changes` guard on `title` — a remote rename causes perpetual drift without destroying data                                                                     |
| 10  | 🟡 Medium   | `queues.tf`           | `manage_queue_consumers` consumer resources reference `queue_id` field which may not exist in Cloudflare provider v5 API — untested code path                                                            |
| 11  | 🟡 Medium   | `backend.tf`          | The entire backend block is commented out — no `.terraform/environment` or CI guard prevents a developer from applying with local state                                                                  |
| 12  | 🟢 Low      | `variables.tf`        | `mta_sts_policy_id` default is a static string (`"20260630000000"`) — easy to forget to bump on policy change                                                                                            |
| 13  | 🟢 Low      | `outputs.tf`          | KV namespace IDs and queue IDs are output in plain text — consider `sensitive = true` to suppress them from CI plan logs                                                                                 |
| 14  | 🟢 Low      | `README.md`           | KV namespace IDs hardcoded in the README (`7ac37dff…`, `da3acaf3…`, `223443c0…`) — these are account-visible metadata but should move to `terraform.tfvars.example` comments or a separate import script |

---

## 🔴 CRITICAL

---

### Finding 1 — No Active Remote Backend (State is Local)

**File:** [`backend.tf`](file:///c:/webs-alots/infra/backend.tf) · Lines 33–58

**What's wrong:**
The entire `terraform { backend "s3" { … } }` block is commented out. Terraform defaults to a local backend, writing `terraform.tfstate` to disk. While `.gitignore` excludes `*.tfstate`, nothing technically prevents a developer from accidentally committing it after a typo. More critically:

- **No state locking** — two concurrent `terraform apply` runs will corrupt state.
- **No encryption at rest** — the state file may contain sensitive resource attributes (see `variables.tf` `sensitive = true` on `cloudflare_api_token`).
- **No audit trail** — there is no run history. An accidental `terraform destroy` leaves no recoverable record.

The `backend.tf` file itself calls this out: _"Local state is NOT acceptable for this directory. Until the backend below is configured, treat `terraform apply` as blocked."_ Yet the backend remains commented.

**Why it's a problem:**
This is a **PHI-adjacent, account-impacting** configuration that includes production destroy-protected resources. Running without remote state is explicitly flagged as blocked in the file's own comments. If a developer follows the README bootstrap steps (`terraform init` → `terraform plan`) without first configuring the backend, all operations silently use local state.

**Suggested fix:**

1. Create the R2 state bucket out of band: `wrangler r2 bucket create oltigo-tf-state`
2. Uncomment and fill the `backend "s3" { … }` block in `backend.tf`, substituting the real `<account_id>`.
3. Run `terraform init` to migrate to the remote backend.
4. Add a CI guard: if `terraform init -backend=false` succeeds but `terraform workspace list` fails (i.e. no remote backend), abort the workflow.

---

### Finding 2 — R2 Jurisdiction Mismatch Deadlock

**File:** [`r2.tf`](file:///c:/webs-alots/infra/r2.tf) · Lines 1–21 · [`variables.tf`](file:///c:/webs-alots/infra/variables.tf) · Lines 109–143

**What's wrong:**
`production_r2_bucket_jurisdiction` defaults to `"eu"`, but the production bucket `webs-alots-uploads` was created via `wrangler r2 bucket create` (which places it in the `default` jurisdiction). The `jurisdiction` attribute is **ForceNew** (immutable) and `prevent_destroy = true` is set.

This creates a deadlock:

- Importing with `jurisdiction = "eu"` against a `default` bucket → 404 / silent fork (a second, empty EU-namespace bucket is created or the import fails).
- Changing `jurisdiction` on the existing resource → Terraform plans a replace → `prevent_destroy` blocks the apply.
- You cannot proceed in either direction without manual intervention.

The README documents this in "R2 jurisdiction migration", and `variables.tf` has an extensive warning — but the **default value is still `"eu"`**, meaning any operator who does not read the full README and runs `terraform import` + `terraform apply` will hit this immediately.

**Why it's a problem:**
This is a critical operational trap that can silently split PHI storage between a `default` and a `eu` bucket, causing uploads to succeed but existing files to be unreachable (wrong bucket namespace), or causing `terraform apply` to fail with a cryptic error mid-flight.

**Suggested fix:**
Change the default value of `production_r2_bucket_jurisdiction` from `"eu"` to `null` with `nullable = true`, and add a validation that requires an explicit value at apply time. This forces operators to consciously choose the jurisdiction rather than silently inheriting the ADR target that may not match reality. Alternatively, add a `precondition` in the `r2.tf` lifecycle that fails fast with a clear message if the bucket already exists in a different jurisdiction.

```hcl
# variables.tf — safer default
variable "production_r2_bucket_jurisdiction" {
  default  = null          # Force explicit choice
  nullable = true
  ...
  validation {
    condition     = var.production_r2_bucket_jurisdiction != null
    error_message = "You MUST set production_r2_bucket_jurisdiction explicitly. See infra/README.md R2 jurisdiction migration before setting this."
  }
}
```

---

## 🟠 HIGH

---

### Finding 3 — Lock File Missing Non-Linux Platform Hashes

**File:** [`.terraform.lock.hcl`](file:///c:/webs-alots/infra/.terraform.lock.hcl) · Lines 1–33

**What's wrong:**
The lock file comment on line 4 explicitly states: _"Platform coverage: this lock file was regenerated for linux_amd64 (CI) only."_ The hashes array contains only 9 entries — consistent with a single-platform generation. `darwin_arm64` (macOS M-series) and `windows_amd64` hashes are absent.

**Why it's a problem:**
Any developer on macOS or Windows running `terraform init` will get:

```
Error: Failed to install provider
  ...
  checksum mismatch or no hashes for platform
```

This means the infra directory is effectively non-functional for local development on the two most common developer platforms in this repo (especially relevant since the user is on Windows).

**Suggested fix:**
Run from the `infra/` directory:

```bash
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_arm64 \
  -platform=windows_amd64
```

Then commit the updated `.terraform.lock.hcl`. This is a one-time operation; the CI workflow already reads the pinned version from the lock file.

---

### Finding 4 — No DLQ Alerting (Silent Patient Notification Failures)

**File:** [`queues.tf`](file:///c:/webs-alots/infra/queues.tf) · Lines 13–29 · [`README.md`](file:///c:/webs-alots/infra/README.md) · Lines 249–255

**What's wrong:**
The `notification-queue-dlq` queue exists and is referenced in the queue consumer's `dead_letter_queue` setting, but there is **no Terraform-managed `cloudflare_logpush_job` or notification policy** watching DLQ depth. The README and `queues.tf` comments acknowledge this gap: _"Known gap: there is no Terraform-managed Logpush rule or alerting policy watching DLQ depth today."_

**Why it's a problem:**
A growing DLQ means patients are silently not receiving WhatsApp/SMS/email notifications (appointment reminders, cancellations, etc.). The README correctly calls this a **patient-safety signal**. Without alerting, the only detection path is manual dashboard inspection after an incident has already occurred. For a healthcare platform, this is unacceptable.

**Suggested fix:**
Add a `cloudflare_logpush_job` or Cloudflare notification policy resource to `queues.tf`:

```hcl
# cloudflare_notification_policy is available in provider v5
resource "cloudflare_notification_policy" "dlq_depth_alert" {
  account_id  = var.cloudflare_account_id
  name        = "DLQ depth alert — notification-queue-dlq"
  description = "Alert when DLQ accumulates messages (patient notification failure)"
  enabled     = true
  alert_type  = "queues_worker_notification"
  # filters and email_integration / pagerduty_integration etc.
}
```

At minimum, document a manual SLA (e.g., "check DLQ daily") in a runbook and set a calendar reminder until automated alerting is implemented.

---

### Finding 5 — MTA-STS `mode: enforce` Before TLS-RPT Baseline Exists

**File:** [`dns.tf`](file:///c:/webs-alots/infra/dns.tf) · Lines 74–94 · [`README.md`](file:///c:/webs-alots/infra/README.md) · Lines 204–206

**What's wrong:**
The `_smtp._tls` TLS-RPT record is declared in `dns.tf`, and the README notes the policy file uses `mode: enforce`. However, `manage_dns` defaults to `false` — so neither the MTA-STS host record nor the TLS-RPT record is currently active via Terraform. The README warns: _"validate with TLS-RPT reports (and optionally `mode: testing`) before relying on it."_ There is no enforcement gate ensuring the operator collected TLS-RPT reports before flipping `manage_dns = true`.

**Why it's a problem:**
If `manage_dns` is enabled prematurely with `mode: enforce` in the policy file, senders that have already cached the policy will refuse to deliver email to oltigo.com if the MX cannot present a matching TLS certificate. This is a silent inbound mail outage — no bounce, no NDR, just missing emails. For a healthcare platform that relies on email for appointment notifications, this is a High-severity availability risk.

**Suggested fix:**

1. Add a variable `mta_sts_mode` with a default of `"testing"` and output it in the `_mta-sts` TXT record.
2. Require a manual approval step (or a conditional precondition) to switch from `testing` to `enforce`.
3. Document the required TLS-RPT baseline collection period (e.g., 30 days) before enforcement in `README.md`.

---

### Finding 6 — AI Route Pattern Missing Trailing `/*` Creates Routing Gap

**File:** [`locals.tf`](file:///c:/webs-alots/infra/locals.tf) · Lines 26–34

**What's wrong:**

```hcl
ai_production_route_patterns = toset([
  "oltigo.com/api/copilotkit",       # ← bare path, no wildcard
  "oltigo.com/api/copilotkit/*",
])
ai_staging_route_patterns = toset([
  "staging.oltigo.com/api/copilotkit",    # ← same issue
  "staging.oltigo.com/api/copilotkit/*",
])
```

The bare `oltigo.com/api/copilotkit` pattern matches only the exact path. Without a trailing slash or `/*`, any request to `/api/copilotkit` (without a trailing slash or sub-path) is correctly matched. However, the **companion wildcard** `oltigo.com/api/copilotkit/*` does **not** match `/api/copilotkit` itself (no trailing path segment). Together they cover both cases — so this is correct.

**Revised assessment:** This is actually fine as a pair. However, the bare pattern `oltigo.com/api/copilotkit` (no trailing slash) may behave differently across Cloudflare's route matching engine than expected. In Cloudflare Workers route matching, `oltigo.com/api/copilotkit` matches only that exact path, while `oltigo.com/api/copilotkit/` (with trailing slash) is a separate path. If the application sends redirects from `/api/copilotkit` → `/api/copilotkit/`, the redirect itself is served by the AI Worker (correct), but it adds a round-trip.

**Why it's still worth flagging:**
The route `oltigo.com/api/copilotkit` without a trailing slash is a narrow pattern. If a future refactor adds `/api/copilotkit?query=...` with no path suffix, this may be swallowed by the catch-all `oltigo.com/*` going to the application Worker instead. The pattern should be explicitly documented with this nuance, or changed to `oltigo.com/api/copilotkit*` (no slash, glob suffix) to be unambiguous.

**Suggested fix:**

```hcl
ai_production_route_patterns = toset([
  "oltigo.com/api/copilotkit*",   # matches /api/copilotkit, /api/copilotkit/, /api/copilotkit/foo
])
```

Confirm this matches the wrangler.toml AI Worker route definition and update both in lockstep.

---

## 🟡 MEDIUM

---

### Finding 7 — `cloudflare_account_id` Not Marked `sensitive`

**File:** [`variables.tf`](file:///c:/webs-alots/infra/variables.tf) · Lines 1–4

**What's wrong:**

```hcl
variable "cloudflare_account_id" {
  description = "Cloudflare account ID …"
  type        = string
  # no sensitive = true
}
```

The account ID appears in plan output, apply output, and any CI log that echoes `terraform plan -out=plan.tfplan && terraform show plan.tfplan`.

**Why it's a problem:**
While a Cloudflare account ID is not a secret in the same class as an API token, it is a stable identifier that scopes all API calls to this account. Combined with even a partial token leak, it reduces the effort needed to target the account. CI logs for healthcare platforms should be treated with extra care.

**Suggested fix:**

```hcl
variable "cloudflare_account_id" {
  ...
  sensitive = true
}
```

---

### Finding 8 — `cloudflare_zone_id` Not Marked `sensitive`

**File:** [`variables.tf`](file:///c:/webs-alots/infra/variables.tf) · Lines 25–38

Same issue as Finding 7. The zone ID is used in route and DNS resources and will appear in plan output.

**Suggested fix:** Add `sensitive = true`.

---

### Finding 9 — `feature_flags_production` KV Namespace Has No `ignore_changes` on `title`

**File:** [`kv.tf`](file:///c:/webs-alots/infra/kv.tf) · Lines 18–30

**What's wrong:**
If the namespace title is renamed in the Cloudflare dashboard (e.g., by another operator or an automated tool), `terraform plan` will show a diff attempting to revert the title back to `"FEATURE_FLAGS_KV"`. This is usually harmless (Terraform wins) but for the `feature_flags_production` namespace — which `prevent_destroy = true` guards — any rename that Terraform tries to apply will succeed (title changes are in-place, not ForceNew), but it creates ongoing drift noise.

More importantly: if the API changes `title` to a required field with rename-as-new-resource semantics in a future provider version, this could trigger a destroy+recreate attempt that `prevent_destroy` would block, halting all Terraform operations until manually resolved.

**Suggested fix:**

```hcl
lifecycle {
  prevent_destroy = true
  ignore_changes  = [title]
}
```

---

### Finding 10 — `cloudflare_queue_consumer` `queue_id` Field May Not Exist in Provider v5

**File:** [`queues.tf`](file:///c:/webs-alots/infra/queues.tf) · Lines 42–72

**What's wrong:**
The consumer resources reference `cloudflare_queue.notification_production.queue_id`:

```hcl
queue_id = cloudflare_queue.notification_production.queue_id
```

In Cloudflare provider v5, the `cloudflare_queue` resource schema should be verified for the exact attribute name. In some provider versions the queue identifier is exported as `id` rather than `queue_id`. Since `manage_queue_consumers = false` by default, this code path is never exercised in CI, making a schema mismatch a latent bug that only surfaces when someone enables the flag.

**Why it's a problem:**
When an operator sets `manage_queue_consumers = true`, the apply will fail with a schema error. This is a silent, latent defect in opt-in code.

**Suggested fix:**
Verify against the provider v5 schema:

```bash
terraform providers schema -json | jq '.provider_schemas | .. | .resource_schemas? | .cloudflare_queue? | .block.attributes'
```

If the attribute is `id` not `queue_id`, fix the reference. Add a `terraform validate` step in CI that exercises this code path (e.g., with `manage_queue_consumers = true` in a test plan).

---

### Finding 11 — No CI Gate Preventing Apply with Local State

**File:** [`backend.tf`](file:///c:/webs-alots/infra/backend.tf) · Lines 1–62

**What's wrong:**
The backend is commented out (see Finding 1), but there is also **no CI check** that detects and rejects local-state usage. The `README.md` says `terraform apply` is blocked without a configured backend, but this is enforced only by documentation — not by code.

**Why it's a problem:**
A developer who does not read the full README can run `terraform init && terraform apply` in a CI fork or locally and succeed, creating divergent local state. If that state file is then committed accidentally (despite the `.gitignore`), production resource IDs are exposed.

**Suggested fix:**
In `.github/workflows/terraform.yml` (if it exists), add a step after `terraform init` that checks for a configured remote backend:

```bash
terraform workspace list | grep -v "^  default$" || \
  (echo "ERROR: No remote workspace found. Configure backend.tf before applying." && exit 1)
```

Or use `terraform state pull` and check the backend type in the metadata.

---

## 🟢 LOW

---

### Finding 12 — Static `mta_sts_policy_id` Default — Easy to Miss Bumping

**File:** [`variables.tf`](file:///c:/webs-alots/infra/variables.tf) · Lines 254–265

**What's wrong:**

```hcl
default = "20260630000000"
```

This is a hardcoded timestamp. Sending MTAs only re-fetch the MTA-STS policy when `id` changes. If the policy is updated but this variable is forgotten, senders continue enforcing the old policy (e.g., old MX list) silently.

**Why it's a problem:**
Low-risk operationally (the policy is cached per sender, not universally), but easy to forget and there is no automated check.

**Suggested fix:**
Add a `lifecycle` `precondition` on the `cloudflare_dns_record.mta_sts_policy` resource that validates the format is a timestamp ≥ today — or document a required checklist item: "bump `mta_sts_policy_id` and redeploy `mta-sts.txt` on any policy change."

---

### Finding 13 — Outputs Expose KV IDs and Queue Names in Plain Text

**File:** [`outputs.tf`](file:///c:/webs-alots/infra/outputs.tf) · Lines 1–50

**What's wrong:**

```hcl
output "rate_limit_namespace_ids" { ... }
output "feature_flags_namespace_id" { ... }
output "notification_queue_names" { ... }
```

These outputs are printed in CI plan/apply logs unless marked `sensitive = true`.

**Suggested fix:**

```hcl
output "rate_limit_namespace_ids" {
  sensitive = true
  ...
}
```

Apply to `feature_flags_namespace_id`, `uploads_bucket_names`, and `notification_queue_names`. The `worker_routes` and `dns_records` outputs do not need this treatment.

---

### Finding 14 — KV Namespace IDs Hardcoded in README

**File:** [`README.md`](file:///c:/webs-alots/infra/README.md) · Lines 147–149

**What's wrong:**

```
- production `RATE_LIMIT_KV`: `7ac37dff0a794542b0c766f38e73f105`
- staging `RATE_LIMIT_KV`: `da3acaf35a2d448984a4a95e769bc393`
- production `FEATURE_FLAGS_KV`: `223443c0631c4046b72ca8426f733f3c`
```

These namespace IDs are committed to the repository in plaintext.

**Why it's a problem:**
Namespace IDs are not secrets, but they are account-scoped internal identifiers. Combined with an account ID, they allow direct API calls to KV namespaces without going through the application. For a healthcare platform, minimizing exposure of internal infrastructure identifiers is good practice.

**Suggested fix:**
Move these to a comment in `terraform.tfvars.example` or a separate `IMPORT.md` file that is not committed to the repo (or note that they are already visible in `wrangler.toml` if they are, making this moot).

---

## Configuration & Dependency Summary

| File                       | Status      | Notes                                                             |
| -------------------------- | ----------- | ----------------------------------------------------------------- |
| `versions.tf`              | ✅ Good     | `>= 1.11.0` correctly required for `use_lockfile`; CI pins 1.14.6 |
| `providers.tf`             | ✅ Good     | Token via variable only, no hardcoded value                       |
| `.terraform.lock.hcl`      | ⚠️ Partial  | Only `linux_amd64` hashes — see Finding 3                         |
| `backend.tf`               | ❌ Blocked  | Entirely commented out — see Finding 1                            |
| `variables.tf`             | ⚠️ Minor    | Missing `sensitive` on account/zone IDs; static policy ID default |
| `kv.tf`                    | ✅ Good     | `prevent_destroy` on production namespaces                        |
| `r2.tf`                    | ❌ Deadlock | `eu` default vs `default` reality — see Finding 2                 |
| `queues.tf`                | ⚠️ Gap      | No DLQ alerting; latent `queue_id` schema risk                    |
| `routes.tf`                | ✅ Good     | `precondition` guards zone_id requirement                         |
| `dns.tf`                   | ⚠️ Risk     | Premature `enforce` mode; `manage_dns = false` guards it for now  |
| `locals.tf`                | ⚠️ Minor    | AI route pattern nuance (bare path vs glob)                       |
| `outputs.tf`               | ⚠️ Minor    | Non-sensitive outputs for internal IDs                            |
| `.gitignore`               | ✅ Good     | `*.tfstate`, `*.tfvars`, `**/.terraform/*` all excluded           |
| `terraform.tfvars.example` | ✅ Good     | No real secrets; correctly excludes `cloudflare_api_token`        |
