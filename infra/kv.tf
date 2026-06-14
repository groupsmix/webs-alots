resource "cloudflare_workers_kv_namespace" "rate_limit_production" {
  account_id = var.cloudflare_account_id
  title      = var.production_rate_limit_namespace_title
}

resource "cloudflare_workers_kv_namespace" "rate_limit_staging" {
  account_id = var.cloudflare_account_id
  title      = var.staging_rate_limit_namespace_title
}
