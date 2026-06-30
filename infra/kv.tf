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

resource "cloudflare_workers_kv_namespace" "feature_flags_production" {
  account_id = var.cloudflare_account_id
  title      = var.production_feature_flags_namespace_title

  # Backs the super-admin global feature flags (e.g. the AI kill-switch).
  # Destroying/replacing this namespace drops all persisted flags, which makes
  # PUT /api/super-admin/feature-flags fail with 503 KV_UNAVAILABLE. This
  # namespace already exists in production and MUST be imported before apply
  # (see infra/README.md). There is no staging equivalent in wrangler.toml.
  lifecycle {
    prevent_destroy = true
  }
}
