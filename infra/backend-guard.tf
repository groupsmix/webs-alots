# =============================================================================
# Backend guard — enforced at plan/apply time
# =============================================================================
#
# This null_resource aborts any plan that is running with local state.
# Local state is unacceptable for this configuration (PHI-adjacent resources,
# concurrent apply risk, no locking). The check runs as a local-exec so it
# fires before any API calls are made to Cloudflare.
#
# How it works:
#   - Terraform writes local state to "terraform.tfstate" in the working dir.
#   - If that file exists, we are NOT using a remote backend.
#   - The shell script exits non-zero, failing the plan immediately.
#
# To intentionally bypass (e.g. during initial backend migration):
#   TF_SKIP_BACKEND_GUARD=1 terraform plan
#
# This resource is always created (count = 1), so it runs on every apply.
# It does not manage any real infrastructure.

resource "null_resource" "backend_guard" {
  # Re-run whenever the workspace changes (extra safety for multi-workspace use).
  triggers = {
    workspace = terraform.workspace
  }

  provisioner "local-exec" {
    interpreter = ["/bin/sh", "-c"]
    command     = <<-EOT
      if [ "$${TF_SKIP_BACKEND_GUARD:-0}" = "1" ]; then
        echo "[backend-guard] Skipped (TF_SKIP_BACKEND_GUARD=1)."
        exit 0
      fi
      # terraform.tfstate in the working dir means local state is active.
      if [ -f "terraform.tfstate" ] || [ -f "../infra/terraform.tfstate" ]; then
        echo ""
        echo "ERROR: Local state detected (terraform.tfstate exists)."
        echo "       Applying with local state is NOT permitted for this"
        echo "       configuration. It manages PHI-adjacent Cloudflare"
        echo "       resources and requires a remote, locked backend."
        echo ""
        echo "       Configure the S3/R2 backend in backend.tf and run"
        echo "       'terraform init' before attempting to plan or apply."
        echo ""
        echo "       If you are intentionally migrating state, set:"
        echo "         TF_SKIP_BACKEND_GUARD=1 terraform plan"
        echo ""
        exit 1
      fi
      echo "[backend-guard] Remote backend confirmed — no local state file found."
    EOT
  }
}
