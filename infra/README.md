# Infrastructure as Code

This directory is the first Terraform scaffold for Oltigo Health's Cloudflare-managed infrastructure.

## Scope

This scaffold manages the durable Cloudflare resources that back the current `wrangler.toml` topology:

- Workers KV namespaces used for distributed rate limiting
- R2 buckets for encrypted uploads
- Cloudflare Queues and dead-letter queues for notifications
- Worker route bindings for production and staging domains (opt-in — see below)

### Ownership boundary with `wrangler.toml`

`wrangler.toml` is the live source of truth for **routes** and **queue consumers**:
`wrangler deploy` reasserts them on every CI run. To avoid a two-owner fight
where Terraform and wrangler continuously revert each other, Terraform does
**not** manage those by default:

- `manage_queue_consumers` defaults to `false`
- `manage_worker_routes` defaults to `false`

Only flip these to `true` if you first remove the corresponding
`[[queues.consumers]]` / `[[routes]]` blocks from `wrangler.toml` and make
Terraform the single source of truth for them.

### Destroy protection

Production data-bearing resources carry `lifecycle { prevent_destroy = true }`:

- the production R2 uploads bucket (encrypted PHI),
- the production rate-limit KV namespace, and
- the production notification queue and its DLQ.

This blocks both `terraform destroy` and any plan that would _replace_ them
(for example, changing an immutable R2 attribute like `jurisdiction`). Staging
equivalents are intentionally left unguarded so they can be reprovisioned.
Removing a guard requires a deliberate, reviewed migration plan.

## Intentionally out of scope for this first pass

To keep the initial rollout low-risk, this directory does **not** yet manage:

- the built Worker bundle or version uploads
- runtime Worker secrets
- Supabase projects, backups, or database users
- Cloudflare WAF rules, Access policies, DNS records, Turnstile, or Logpush

Those are good follow-up candidates, but they require either artifact-aware deployment plumbing or provider decisions that should be made explicitly.

## Why the Worker bundle is not managed here

The application is currently deployed by `.github/workflows/deploy.yml` using:

1. `npm run build:cf`
2. `wrangler deploy --env production|staging`

That remains the source of truth for application artifact deployment. Terraform here is focused on the surrounding account resources that are otherwise prone to dashboard drift.

## Why runtime secrets are not managed here

Cloudflare provider v5 removed the old `cloudflare_workers_secret` flow. This repo currently manages secrets operationally via:

- `wrangler secret put`
- Cloudflare dashboard secret management
- GitHub Actions secrets for CI-only credentials

Until the team chooses a stable Secrets Store strategy, keep secret values out of Terraform state.

## Current desired state

The defaults in this directory match the repo-grounded names already present in `wrangler.toml`:

- Production Worker: `webs-alots`
- Staging Worker: `webs-alots-staging`
- Production uploads bucket: `webs-alots-uploads`
- Staging uploads bucket: `webs-alots-uploads-staging`
- Production queue: `notification-queue`
- Production DLQ: `notification-queue-dlq`
- Staging queue: `notification-queue-staging`
- Staging DLQ: `notification-queue-staging-dlq`
- Production routes: `oltigo.com/*`, `*.oltigo.com/*`
- Staging routes: `staging.oltigo.com/*`, `*.staging.oltigo.com/*`

## Remote state (required before apply)

State for this directory can contain sensitive resource attributes and must be
locked and encrypted. **Local state is not acceptable here** — see `backend.tf`
for a ready-to-fill Cloudflare R2 (S3-compatible) backend with native state
locking. `*.tfstate*`, `.terraform/`, and `*.tfvars` are gitignored at the repo
root so state and identifiers cannot be accidentally committed
(`*.tfvars.example` is intentionally kept).

## Prerequisites

- Terraform `>= 1.6` (`>= 1.11` recommended for native S3-backend state locking)
- Cloudflare API token with permissions for Workers KV, R2, Queues, and Workers Routes — see `providers.tf` for the full permission list
- Pass the token via `TF_VAR_cloudflare_api_token` (never in `terraform.tfvars` or any committed file)
- `terraform.tfvars` created from `terraform.tfvars.example`
- A configured remote backend (see `backend.tf`)

## Bootstrap

```bash
cd infra
terraform init
cp terraform.tfvars.example terraform.tfvars
terraform plan
```

## Import-first guidance for existing production resources

Most production resources already exist. Do **not** run `terraform apply` against a live account until you either:

1. import the existing resources into state, or
2. intentionally target a new environment/account.

At minimum, import the currently provisioned rate-limit namespaces before apply:

```bash
terraform import cloudflare_workers_kv_namespace.rate_limit_production <account_id>/<namespace_id>
terraform import cloudflare_workers_kv_namespace.rate_limit_staging <account_id>/<namespace_id>
```

Known namespace IDs already recorded in `wrangler.toml`:

- production `RATE_LIMIT_KV`: `7ac37dff0a794542b0c766f38e73f105`
- production preview `RATE_LIMIT_KV`: `854c78ea8c9442ed8706d3ec31fe292e`
- staging `RATE_LIMIT_KV`: `da3acaf35a2d448984a4a95e769bc393`
- staging preview `RATE_LIMIT_KV`: `4965f9300c924de3afc0407679ff775b`

For routes and queues, obtain the existing resource IDs from the Cloudflare dashboard or API, then import them before the first apply.

## DLQ monitoring

The production notification queue is configured with `max_retries = 3`. After three failed delivery attempts a message is forwarded to `notification-queue-dlq`. A growing DLQ means patients are not receiving WhatsApp/SMS/email notifications — it is a patient-safety signal, not just an operational noise.

**Current gap:** There is no Terraform-managed Logpush rule or alerting policy watching DLQ depth. Until one is added:

1. Check the DLQ message count manually via the Cloudflare dashboard → **Queues** → `notification-queue-dlq` → **Messages**.
2. Alternatively, query the Queues REST API: `GET /accounts/{id}/queues/{id}/messages` with `?visible=true&status=delayed`.
3. For incidents involving missed patient notifications, treat a non-empty DLQ as a P1.

**Recommended follow-up:** Add a `cloudflare_logpush_job` resource that ships queue metrics to your SIEM/alerting layer, or configure a Cloudflare notification policy on queue message count.

## Wildcard routing

The production route patterns include `*.oltigo.com/*`, which routes all subdomains to the application Worker. This is intentional for the multi-tenant subdomain architecture (ADR-0007). Any new subdomain that should **not** be served by the application Worker must use a separate Cloudflare zone or a different account. Do not create internal/admin subdomains under `*.oltigo.com` without reviewing this routing first.

## Suggested next iterations

1. Add Cloudflare WAF custom rules and managed rule overrides
2. Add DNS records and origin/service bindings where appropriate
3. Add Logpush / audit-log retention plumbing
4. Decide whether to manage Workers secrets through a future Cloudflare Secrets Store flow or keep them operationally managed

> `terraform fmt -check` and `terraform validate` already run in CI via
> `.github/workflows/terraform.yml`.

## Safety notes

- Never put PHI or secret values in Terraform variables committed to git.
- Treat this directory as account-impacting code: require review from Platform/Security before apply.
- Keep `wrangler.toml` and this directory aligned; drift between them should be treated as an operational defect.
