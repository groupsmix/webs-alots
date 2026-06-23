resource "cloudflare_r2_bucket" "uploads_production" {
  account_id    = var.cloudflare_account_id
  name          = var.production_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.r2_bucket_jurisdiction
  storage_class = var.r2_storage_class

  # This bucket holds encrypted patient PHI. `location`, `jurisdiction`, and
  # `storage_class` are immutable (ForceNew) — changing them later would
  # destroy and recreate the bucket, wiping PHI. prevent_destroy blocks both
  # `terraform destroy` and any plan that would replace this resource. Remove
  # this guard only via a deliberate, reviewed migration plan.
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "uploads_staging" {
  account_id    = var.cloudflare_account_id
  name          = var.staging_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.r2_bucket_jurisdiction
  storage_class = var.r2_storage_class
}
