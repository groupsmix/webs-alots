resource "cloudflare_queue" "notification_production" {
  account_id = var.cloudflare_account_id
  queue_name = var.production_notification_queue_name

  # Renaming a queue is a destroy+recreate. Guard the production queue and its
  # DLQ so an accidental rename or `terraform destroy` cannot drop in-flight or
  # dead-lettered notification messages.
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_queue" "notification_production_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = var.production_notification_dlq_name

  # Dead-letter queue for the production notification queue. Messages land here
  # after max_retries (3) failed delivery attempts. DLQ accumulation means
  # patients are NOT receiving WhatsApp/SMS/email notifications — this must
  # be monitored.
  #
  # Known gap: there is no Terraform-managed Logpush rule or alerting policy
  # watching DLQ depth today. Until one is added, use the Cloudflare dashboard
  # or the Queues REST API to check the DLQ message count after incidents.
  # Adding a Logpush → SIEM / alerting rule is the recommended follow-up.
  # See infra/README.md — "DLQ monitoring" section.
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_queue" "notification_staging" {
  account_id = var.cloudflare_account_id
  queue_name = var.staging_notification_queue_name
}

resource "cloudflare_queue" "notification_staging_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = var.staging_notification_dlq_name
}

resource "cloudflare_queue_consumer" "notification_production" {
  count = var.manage_queue_consumers ? 1 : 0

  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.notification_production.id
  type              = "worker"
  script_name       = var.production_worker_name
  dead_letter_queue = cloudflare_queue.notification_production_dlq.queue_name

  settings = {
    batch_size       = local.queue_consumer_settings.batch_size
    max_wait_time_ms = local.queue_consumer_settings.max_wait_time_ms
    max_retries      = local.queue_consumer_settings.max_retries
  }
}

resource "cloudflare_queue_consumer" "notification_staging" {
  count = var.manage_queue_consumers ? 1 : 0

  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.notification_staging.id
  type              = "worker"
  script_name       = var.staging_worker_name
  dead_letter_queue = cloudflare_queue.notification_staging_dlq.queue_name

  settings = {
    batch_size       = local.queue_consumer_settings.batch_size
    max_wait_time_ms = local.queue_consumer_settings.max_wait_time_ms
    max_retries      = local.queue_consumer_settings.max_retries
  }
}

