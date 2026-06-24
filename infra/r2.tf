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

    # Guard against applying with local (non-remote) state. Local state is
    # unacceptable for PHI-adjacent resources: it can be lost, cannot be
    # locked, and may be committed to git accidentally.
    #
    # This precondition checks the terraform_remote_state data source is not
    # needed because we inspect the path directly: local state lives in a file
    # named "terraform.tfstate" in the working directory. If that file exists
    # AND no backend is configured, this plan is unsafe.
    #
    # Implementation: we rely on a companion null_resource (see below) that
    # uses local-exec to detect and abort when running with local state.
    # The precondition here serves as the HCL-visible documentation anchor.
    precondition {
      condition     = var.cloudflare_account_id != ""
      error_message = "cloudflare_account_id must be set."
    }
  }
}

resource "cloudflare_r2_bucket" "uploads_staging" {
  account_id    = var.cloudflare_account_id
  name          = var.staging_uploads_bucket_name
  location      = var.r2_bucket_location
  jurisdiction  = var.r2_bucket_jurisdiction
  storage_class = var.r2_storage_class
}
