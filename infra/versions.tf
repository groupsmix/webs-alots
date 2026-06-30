terraform {
  # >= 1.11.0 is required (not merely recommended): backend.tf uses the S3
  # backend with `use_lockfile = true`, and native S3-backend state locking via
  # R2 conditional writes only exists on Terraform 1.11+. Allowing an older
  # version here would let `terraform init` succeed with NO state locking, which
  # is unacceptable for this PHI-adjacent configuration. CI pins 1.14.6.
  required_version = ">= 1.11.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.21"
      # ~> 5.21 allows 5.22, 5.23, etc. (but not 6.0). The .terraform.lock.hcl
      # file pins the exact version used at last `terraform init` (5.21.0). This
      # is the intended safety mechanism — the lock file MUST be committed so CI
      # always uses the same binary that was tested locally. The CI workflow
      # reads the pinned version directly from the lock file (single source of
      # truth) instead of hardcoding it.
      #
      # NEVER run `terraform init -upgrade` in CI. Only run it deliberately when
      # intentionally reviewing and accepting a new provider version. After
      # upgrading, re-review the provider changelog for breaking changes to
      # cloudflare_r2_bucket, cloudflare_workers_kv_namespace,
      # cloudflare_queue, and cloudflare_queue_consumer before applying to
      # production.
    }
  }
}
