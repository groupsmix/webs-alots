variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Workers, KV, Queues, and R2 resources."
  type        = string
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
  description = "Optional R2 data jurisdiction, for example default or eu."
  type        = string
  default     = null
  nullable    = true
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
