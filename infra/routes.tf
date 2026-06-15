resource "cloudflare_workers_route" "production" {
  for_each = local.production_route_patterns

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.production_worker_name
}

resource "cloudflare_workers_route" "staging" {
  for_each = local.staging_route_patterns

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.staging_worker_name
}
