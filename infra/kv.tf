resource "cloudflare_workers_kv_namespace" "rate_limit_production" {
  account_id = var.cloudflare_account_id
  title      = var.production_rate_limit_namespace_title

  # Production rate-limit counters. Destroying/replacing this namespace resets
  # all distributed limiter state and can briefly let the limiter fall open.
  # Staging is intentionally left without this guard so it can be reprovisioned.
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_kv_namespace" "rate_limit_staging" {
  account_id = var.cloudflare_account_id
  title      = var.staging_rate_limit_namespace_title
}
