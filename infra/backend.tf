# =============================================================================
# Remote state backend
# =============================================================================
#
# This Terraform manages account-impacting Cloudflare resources, including the
# R2 bucket that stores encrypted patient PHI. State for this configuration:
#
#   - can contain sensitive resource attribute values,
#   - MUST be locked so two operators / CI runs cannot apply concurrently, and
#   - MUST NOT live on a laptop or be committed to git.
#
# Local state is the Terraform default and is NOT acceptable for this directory.
# Until the backend below is configured, treat `terraform apply` as blocked.
#
# Recommended: Cloudflare R2 via the S3-compatible backend. R2 supports
# conditional writes, which Terraform 1.11+ uses for native state locking on the
# S3 backend (no separate lock table needed). Create a dedicated, PRIVATE state
# bucket (e.g. `oltigo-tf-state`) and an R2 API token scoped to it.
#
# 1. Create the state bucket (one time, out of band — do NOT let this config
#    manage its own state bucket):
#
#      wrangler r2 bucket create oltigo-tf-state
#
# 2. Export R2 S3 credentials before `terraform init`:
#
#      export AWS_ACCESS_KEY_ID=<r2-access-key-id>
#      export AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
#
# 3. Uncomment and fill the block below, then run `terraform init`.
#    Replace <account_id> with the R2 account ID.
#
terraform {
  backend "s3" {
    bucket = "oltigo-tf-state"
    key    = "infra/cloudflare/terraform.tfstate"
    region = "auto"

    endpoints = {
      s3 = "https://<account_id>.r2.cloudflarestorage.com"
    }

    # R2 is not AWS — skip the AWS-specific validation/credential lookups.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    skip_metadata_api_check     = true

    # Native S3-backend state locking via R2 conditional writes
    # (requires Terraform >= 1.11). Remove if on an older Terraform and use a
    # DynamoDB-compatible lock table instead.
    use_lockfile = true

    # Encrypt the state object at rest.
    encrypt = true
  }
}
#
# Alternative: HCP Terraform / Terraform Cloud `cloud {}` block, which provides
# encrypted state, locking, and run history without managing an R2 bucket.
