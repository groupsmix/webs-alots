terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19"
      # ~> 5.19 allows 5.20, 5.21, etc. The .terraform.lock.hcl file pins the
      # exact version used at last `terraform init`. This is the intended safety
      # mechanism — the lock file MUST be committed so CI always uses the same
      # binary that was tested locally.
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
