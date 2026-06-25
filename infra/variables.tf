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

    IMPORTANT: Never set this in terraform.tfvars or any file committed to git.
    Inject it via the environment variable TF_VAR_cloudflare_api_token in CI,
    or use a secrets manager at plan/apply time.
  EOT
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for oltigo.com routes."
  type        = string
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

variable "r2_bucket_jurisdiction" {
  description = <<-EOT
    R2 data jurisdiction. Accepted values: default, eu, fedramp.

    For Oltigo Health, this is set to "eu" — the closest available
    jurisdiction to Morocco and the one already recorded in
    docs/data-residency.md and ADR-0008. Cloudflare offers no
    Africa/Morocco jurisdiction, so "eu" provides the nearest data-
    residency guarantee compatible with Moroccan Law 09-08 and the
    Cloudflare DPA.

    IMPORTANT: jurisdiction is ForceNew (immutable). The production
    bucket also has prevent_destroy = true, so changing this value
    after the first apply requires a deliberate, reviewed migration plan.
    Do NOT change this default without updating ADR-0008.
  EOT
  type        = string
  default     = "eu"
  nullable    = false

  validation {
    condition     = contains(["default", "eu", "fedramp"], var.r2_bucket_jurisdiction)
    error_message = "r2_bucket_jurisdiction must be one of: default, eu, fedramp."
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
