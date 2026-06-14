locals {
  production_route_patterns = toset([
    "oltigo.com/*",
    "*.oltigo.com/*",
  ])

  staging_route_patterns = toset([
    "staging.oltigo.com/*",
    "*.staging.oltigo.com/*",
  ])

  queue_consumer_settings = {
    batch_size       = 25
    max_wait_time_ms = 30000
    max_retries      = 3
  }
}
