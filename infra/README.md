# Infrastructure as Code

This directory is the first Terraform scaffold for Oltigo Health's Cloudflare-managed infrastructure.

## Scope

This scaffold manages the durable Cloudflare resources that back the current `wrangler.toml` topology:

- Workers KV namespaces used for distributed rate limiting
- R2 buckets for encrypted uploads
- Cloudflare Queues and dead-letter queues for notifications
- Worker route bindings for production and staging domains

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

## Prerequisites

- Terraform `>= 1.6`
- Cloudflare API token with permissions for Workers KV, R2, Queues, and Workers Routes
- `CLOUDFLARE_API_TOKEN` exported in your shell or injected by CI
- `terraform.tfvars` created from `terraform.tfvars.example`

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

## Suggested next iterations

1. Add Cloudflare WAF custom rules and managed rule overrides
2. Add DNS records and origin/service bindings where appropriate
3. Add Logpush / audit-log retention plumbing
4. Decide whether to manage Workers secrets through a future Cloudflare Secrets Store flow or keep them operationally managed
5. Add CI for `terraform fmt -check` and `terraform validate`

## Safety notes

- Never put PHI or secret values in Terraform variables committed to git.
- Treat this directory as account-impacting code: require review from Platform/Security before apply.
- Keep `wrangler.toml` and this directory aligned; drift between them should be treated as an operational defect.
