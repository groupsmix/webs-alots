variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Workers, KV, Queues, and R2 resources."
  type        = string
}

variable "cloudflare_api_token" {
  description = <<-EOT
    Cloudflare API token passed to the provider.

    Required permissions:
      - Account / Workers KV Storage: Edit
      - Account / R2 Storage: Edit
      - Account / Queues: Edit
      - Zone / Workers Routes: Edit  (only when manage_worker_routes = true)
      - Zone / DNS: Edit             (only when manage_dns = true)

    IMPORTANT: Never set this in terraform.tfvars or any file committed to git.
    Inject it via the environment variable TF_VAR_cloudflare_api_token in CI,
    or use a secrets manager at plan/apply time.
  EOT
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = <<-EOT
    Cloudflare zone ID for oltigo.com routes.

    Required when manage_worker_routes = true OR manage_dns = true. Routes are
    owned by wrangler.toml by default (manage_worker_routes = false) and DNS is
    managed out of band by default (manage_dns = false), so this is optional and
    defaults to null. Preconditions in routes.tf and dns.tf fail the plan if
    routes/DNS are managed but this is left unset.
  EOT
  type        = string
  default     = null
  nullable    = true
}

variable "production_worker_name" {
  description = "Production Worker script name."
  type        = string
  default     = "webs-alots"
}

variable "staging_worker_name" {
  description = "Staging Worker script name."
  type        = string
  default     = "webs-alots-staging"
}

variable "ai_worker_name" {
  description = "Production AI Worker script name (handles /api/copilotkit/*)."
  type        = string
  default     = "webs-alots-ai"
}

variable "ai_worker_staging_name" {
  description = "Staging AI Worker script name."
  type        = string
  default     = "webs-alots-ai-staging"
}

variable "production_rate_limit_namespace_title" {
  description = "Production KV namespace title for distributed rate limiting."
  type        = string
  default     = "RATE_LIMIT_KV"
}

variable "staging_rate_limit_namespace_title" {
  description = "Staging KV namespace title for distributed rate limiting."
  type        = string
  default     = "RATE_LIMIT_KV_STAGING"
}

variable "production_feature_flags_namespace_title" {
  description = <<-EOT
    Production KV namespace title for super-admin feature flags
    (FEATURE_FLAGS_KV). Backs the global AI kill-switch toggle. This namespace
    already exists in production (id 223443c0631c4046b72ca8426f733f3c) and MUST
    be imported before the first apply — see infra/README.md.

    There is no staging FEATURE_FLAGS_KV binding in wrangler.toml, so only the
    production namespace is managed here.
  EOT
  type        = string
  default     = "FEATURE_FLAGS_KV"
}

variable "production_uploads_bucket_name" {
  description = "Production R2 bucket for encrypted uploads."
  type        = string
  default     = "webs-alots-uploads"
}

variable "staging_uploads_bucket_name" {
  description = "Staging R2 bucket for encrypted uploads."
  type        = string
  default     = "webs-alots-uploads-staging"
}

variable "r2_bucket_location" {
  description = "Optional preferred R2 bucket location. Leave null to use Cloudflare default behavior."
  type        = string
  default     = null
  nullable    = true
}

variable "production_r2_bucket_jurisdiction" {
  description = <<-EOT
    R2 data jurisdiction for the PRODUCTION uploads bucket.
    Accepted values: default, eu, fedramp.

    Target value is "eu" — the closest available jurisdiction to Morocco and
    the one recorded in docs/data-residency.md and ADR-0012 (R2 bucket
    jurisdiction set to EU). Cloudflare offers no Africa/Morocco jurisdiction,
    so "eu" provides the nearest data-residency guarantee compatible with
    Moroccan Law 09-08 and the Cloudflare DPA.

    IMPORTANT: jurisdiction is ForceNew (immutable) AND the production bucket
    has prevent_destroy = true, so Terraform cannot flip it in place. The
    production bucket `webs-alots-uploads` ALREADY EXISTS (see wrangler.toml).
    A bucket created with `wrangler r2 bucket create` lives in the "default"
    jurisdiction, and a default-jurisdiction bucket cannot be imported or
    addressed as "eu" — they are separate namespaces.

    Therefore, to manage the existing bucket you must EITHER:
      (a) run the EU-migration runbook in infra/README.md
          ("R2 jurisdiction migration") to recreate it under "eu", then keep
          this at "eu"; OR
      (b) temporarily set this to the bucket's CURRENT jurisdiction ("default")
          to import it as-is, then schedule the migration.

    Do NOT change this default without updating ADR-0012.
  EOT
  type        = string
  default     = "eu"
  nullable    = false

  validation {
    condition     = contains(["default", "eu", "fedramp"], var.production_r2_bucket_jurisdiction)
    error_message = "production_r2_bucket_jurisdiction must be one of: default, eu, fedramp."
  }
}

variable "staging_r2_bucket_jurisdiction" {
  description = <<-EOT
    R2 data jurisdiction for the STAGING uploads bucket.
    Accepted values: default, eu, fedramp. Defaults to "eu" to match the
    production residency posture (ADR-0012). Same ForceNew immutability caveat
    as production applies; staging carries no prevent_destroy guard, so it can
    be reprovisioned if the jurisdiction must change.
  EOT
  type        = string
  default     = "eu"
  nullable    = false

  validation {
    condition     = contains(["default", "eu", "fedramp"], var.staging_r2_bucket_jurisdiction)
    error_message = "staging_r2_bucket_jurisdiction must be one of: default, eu, fedramp."
  }
}

variable "r2_storage_class" {
  description = "Optional default R2 storage class."
  type        = string
  default     = null
  nullable    = true
}

variable "production_notification_queue_name" {
  description = "Production notifications queue name."
  type        = string
  default     = "notification-queue"
}

variable "production_notification_dlq_name" {
  description = "Production notifications dead-letter queue name."
  type        = string
  default     = "notification-queue-dlq"
}

variable "staging_notification_queue_name" {
  description = "Staging notifications queue name."
  type        = string
  default     = "notification-queue-staging"
}

variable "staging_notification_dlq_name" {
  description = "Staging notifications dead-letter queue name."
  type        = string
  default     = "notification-queue-staging-dlq"
}

variable "manage_queue_consumers" {
  description = <<-EOT
    Whether Terraform should also manage the worker queue consumers.

    Defaults to false because wrangler.toml already declares
    [[queues.consumers]] for both environments, and `wrangler deploy` reasserts
    that config on every CI deploy. Letting Terraform manage consumers too
    creates a two-owner fight (each apply/deploy reverts the other). Keep this
    false unless you remove the consumer blocks from wrangler.toml and make
    Terraform the single source of truth for queue consumers.
  EOT
  type        = bool
  default     = false
}

variable "manage_worker_routes" {
  description = <<-EOT
    Whether Terraform should manage the Worker route bindings.

    Defaults to false for the same reason as manage_queue_consumers:
    wrangler.toml already declares routes for both environments and
    `wrangler deploy` reasserts them on every CI run. Enabling this without
    removing the [[routes]] / [[env.*.routes]] blocks from wrangler.toml causes
    Terraform and wrangler to continuously overwrite each other.
  EOT
  type        = bool
  default     = false
}

variable "manage_dns" {
  description = <<-EOT
    Whether Terraform should manage the MTA-STS / TLS-RPT DNS records (dns.tf).

    Defaults to false because DNS for oltigo.com is currently maintained out of
    band (Cloudflare dashboard). Enabling this without first importing any
    pre-existing records would make Terraform attempt to create duplicates.

    When true:
      - cloudflare_zone_id must be set (precondition in dns.tf), and
      - the API token must also carry "Zone / DNS: Edit".

    Scope is intentionally limited to the records that make the MTA-STS policy
    effective. It does NOT manage MX / SPF / DMARC / apex / www, so turning it
    on cannot cause a partial-ownership mail outage.
  EOT
  type        = bool
  default     = false
}

variable "dns_root_domain" {
  description = <<-EOT
    Apex domain used to construct the MTA-STS / TLS-RPT record names
    (e.g. "oltigo.com" yields mta-sts.oltigo.com, _mta-sts.oltigo.com,
    _smtp._tls.oltigo.com). Only used when manage_dns = true.
  EOT
  type        = string
  default     = "oltigo.com"
}

variable "mta_sts_policy_id" {
  description = <<-EOT
    Value of the `id` field in the _mta-sts TXT record (v=STSv1; id=...).

    Sending MTAs re-fetch the policy only when this id changes, so bump it
    (and re-deploy public/.well-known/mta-sts.txt) on every policy change. A
    monotonic timestamp such as YYYYMMDDHHMMSS is the conventional format.
    Only used when manage_dns = true.
  EOT
  type        = string
  default     = "20260630000000"
}

variable "mta_sts_report_email" {
  description = <<-EOT
    Mailbox that receives SMTP TLS reports (TLS-RPT rua). Placed in the
    _smtp._tls TXT record. Should match the canonical security contact
    (security@oltigo.com — see public/.well-known/security.txt). Only used when
    manage_dns = true.
  EOT
  type        = string
  default     = "security@oltigo.com"
}
