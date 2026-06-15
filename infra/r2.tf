resource "cloudflare_r2_bucket" "uploads_production" {
  account_id    = var.cloudflare_account_id
  name          = var.production_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.r2_bucket_jurisdiction
  storage_class = var.r2_storage_class
}

resource "cloudflare_r2_bucket" "uploads_staging" {
  account_id    = var.cloudflare_account_id
  name          = var.staging_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.r2_bucket_jurisdiction
  storage_class = var.r2_storage_class
}
