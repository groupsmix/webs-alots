locals {
  # WILDCARD ROUTING NOTE:
  # "*.oltigo.com/*" routes all subdomains (clinic subdomains, demo, etc.) to
  # the application Worker — this is intentional for the multi-tenant subdomain
  # routing architecture (see ADR-0007). Any new internal/admin subdomain that
  # should NOT be handled by the application Worker (e.g. an admin panel, an
  # internal service, or a third-party integration) MUST use a separate
  # Cloudflare zone or be placed on a different account. Do not create
  # internal subdomains under *.oltigo.com without first reviewing this routing.
  production_route_patterns = toset([
    "oltigo.com/*",
    "*.oltigo.com/*",
  ])

  staging_route_patterns = toset([
    "staging.oltigo.com/*",
    "*.staging.oltigo.com/*",
  ])

  # AI Worker (webs-alots-ai) routes. These are MORE SPECIFIC than the
  # application Worker's catch-all above, and Cloudflare zone routing prefers
  # the more specific pattern (see workers/ai/wrangler.toml). If Terraform owns
  # routes (manage_worker_routes = true) but omits these, the catch-all
  # "oltigo.com/*" would swallow /api/copilotkit/* and break the AI Worker.
  # Keep these in lockstep with workers/ai/wrangler.toml.
  ai_production_route_patterns = toset([
    "oltigo.com/api/copilotkit",
    "oltigo.com/api/copilotkit/*",
  ])

  ai_staging_route_patterns = toset([
    "staging.oltigo.com/api/copilotkit",
    "staging.oltigo.com/api/copilotkit/*",
  ])

  queue_consumer_settings = {
    batch_size       = 25
    max_wait_time_ms = 30000
    max_retries      = 3
    # After max_retries attempts the message is forwarded to the DLQ. Monitor
    # DLQ depth to detect silent notification failures (WhatsApp/SMS/email).
    # See the "DLQ monitoring" section of infra/README.md.
  }
}
