output "rate_limit_namespace_ids" {
  description = "KV namespace IDs for production and staging rate limiting."
  value = {
    production = cloudflare_workers_kv_namespace.rate_limit_production.id
    staging    = cloudflare_workers_kv_namespace.rate_limit_staging.id
  }
}

output "feature_flags_namespace_id" {
  description = "KV namespace ID backing production super-admin feature flags."
  value       = cloudflare_workers_kv_namespace.feature_flags_production.id
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
  description = "Worker route patterns managed by Terraform (empty unless manage_worker_routes = true)."
  value = {
    production    = sort([for pattern, route in cloudflare_workers_route.production : route.pattern])
    staging       = sort([for pattern, route in cloudflare_workers_route.staging : route.pattern])
    ai_production = sort([for pattern, route in cloudflare_workers_route.ai_production : route.pattern])
    ai_staging    = sort([for pattern, route in cloudflare_workers_route.ai_staging : route.pattern])
  }
}

output "dns_records" {
  description = "MTA-STS / TLS-RPT DNS record names managed by Terraform (empty unless manage_dns = true)."
  value = {
    mta_sts_host   = [for r in cloudflare_dns_record.mta_sts_host : r.name]
    mta_sts_policy = [for r in cloudflare_dns_record.mta_sts_policy : r.name]
    smtp_tls_rpt   = [for r in cloudflare_dns_record.smtp_tls_reporting : r.name]
  }
}
