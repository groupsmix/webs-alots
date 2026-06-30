resource "cloudflare_workers_route" "production" {
  for_each = var.manage_worker_routes ? local.production_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.production_worker_name

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_worker_routes = true."
    }
  }
}

resource "cloudflare_workers_route" "staging" {
  for_each = var.manage_worker_routes ? local.staging_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.staging_worker_name

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_worker_routes = true."
    }
  }
}

# AI Worker (webs-alots-ai) routes. Managed under the same manage_worker_routes
# flag so route ownership is all-or-nothing: if Terraform owns the application
# Worker's catch-all, it must also own the more-specific /api/copilotkit/*
# routes, otherwise the catch-all would intercept AI traffic. When enabling
# this flag, remove the corresponding [[routes]] from workers/ai/wrangler.toml
# as well, not just the main wrangler.toml.
resource "cloudflare_workers_route" "ai_production" {
  for_each = var.manage_worker_routes ? local.ai_production_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.ai_worker_name

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_worker_routes = true."
    }
  }
}

resource "cloudflare_workers_route" "ai_staging" {
  for_each = var.manage_worker_routes ? local.ai_staging_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.ai_worker_staging_name

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_worker_routes = true."
    }
  }
}
