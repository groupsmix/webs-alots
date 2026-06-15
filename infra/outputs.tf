output "rate_limit_namespace_ids" {
  description = "KV namespace IDs for production and staging rate limiting."
  value = {
    production = cloudflare_workers_kv_namespace.rate_limit_production.id
    staging    = cloudflare_workers_kv_namespace.rate_limit_staging.id
  }
}

output "uploads_bucket_names" {
  description = "R2 bucket names for encrypted uploads."
  value = {
    production = cloudflare_r2_bucket.uploads_production.name
    staging    = cloudflare_r2_bucket.uploads_staging.name
  }
}

output "notification_queue_names" {
  description = "Queue names for notification delivery and dead-letter handling."
  value = {
    production     = cloudflare_queue.notification_production.queue_name
    production_dlq = cloudflare_queue.notification_production_dlq.queue_name
    staging        = cloudflare_queue.notification_staging.queue_name
    staging_dlq    = cloudflare_queue.notification_staging_dlq.queue_name
  }
}

output "worker_routes" {
  description = "Worker route patterns managed by Terraform."
  value = {
    production = sort([for pattern, route in cloudflare_workers_route.production : route.pattern])
    staging    = sort([for pattern, route in cloudflare_workers_route.staging : route.pattern])
  }
}
