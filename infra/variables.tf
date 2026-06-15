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
  description = "Whether Terraform should also manage the worker queue consumers."
  type        = bool
  default     = true
}
