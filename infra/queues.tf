resource "cloudflare_queue" "notification_production" {
  account_id = var.cloudflare_account_id
  queue_name = var.production_notification_queue_name
}

resource "cloudflare_queue" "notification_production_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = var.production_notification_dlq_name
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
  queue_id          = cloudflare_queue.notification_production.queue_id
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
  queue_id          = cloudflare_queue.notification_staging.queue_id
  type              = "worker"
  script_name       = var.staging_worker_name
  dead_letter_queue = cloudflare_queue.notification_staging_dlq.queue_name

  settings = {
    batch_size       = local.queue_consumer_settings.batch_size
    max_wait_time_ms = local.queue_consumer_settings.max_wait_time_ms
    max_retries      = local.queue_consumer_settings.max_retries
  }
}
