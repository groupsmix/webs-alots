# The Cloudflare provider reads api_token from this variable.
#
# Do NOT set cloudflare_api_token in terraform.tfvars — it would be stored in
# plaintext on disk and risks accidental commit. Pass it instead via the
# environment variable TF_VAR_cloudflare_api_token, a secrets manager (e.g.
# Vault, AWS Secrets Manager), or a CI-injected secret.
#
# Required token permissions:
#   - Account: Workers KV Storage: Edit
#   - Account: R2 Storage: Edit
#   - Account: Queues: Edit
#   - Zone: Workers Routes: Edit (only needed when manage_worker_routes = true)
#   - Zone: DNS: Edit            (only needed when manage_dns = true)
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
