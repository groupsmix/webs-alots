resource "cloudflare_r2_bucket" "uploads_production" {
  account_id    = var.cloudflare_account_id
  name          = var.production_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.production_r2_bucket_jurisdiction
  storage_class = var.r2_storage_class

  # This bucket holds encrypted patient PHI. `location`, `jurisdiction`, and
  # `storage_class` are immutable (ForceNew) — changing them later would
  # destroy and recreate the bucket, wiping PHI. prevent_destroy blocks both
  # `terraform destroy` and any plan that would replace this resource.
  #
  # The bucket ALREADY EXISTS and must be imported before the first apply.
  # Because jurisdiction is immutable and a default-jurisdiction bucket cannot
  # be re-addressed as "eu", reconcile var.production_r2_bucket_jurisdiction
  # with the bucket's real jurisdiction (or run the EU-migration runbook)
  # before importing — see infra/README.md "R2 jurisdiction migration".
  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "uploads_staging" {
  account_id    = var.cloudflare_account_id
  name          = var.staging_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.staging_r2_bucket_jurisdiction
  storage_class = var.r2_storage_class

  # Staging is intentionally NOT guarded with prevent_destroy, consistent with
  # the staging rate-limit KV namespace and staging queues: staging data
  # resources are reprovisionable by design (see infra/README.md "Destroy
  # protection"). Do not put real PHI in the staging bucket; use synthetic
  # fixtures only.
}
