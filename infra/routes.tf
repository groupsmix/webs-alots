resource "cloudflare_workers_route" "production" {
  for_each = var.manage_worker_routes ? local.production_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.production_worker_name
}

resource "cloudflare_workers_route" "staging" {
  for_each = var.manage_worker_routes ? local.staging_route_patterns : toset([])

  zone_id = var.cloudflare_zone_id
  pattern = each.value
  script  = var.staging_worker_name
}
