# =============================================================================
# DNS records (opt-in via manage_dns)
# =============================================================================
#
# By default Terraform does NOT manage DNS (manage_dns = false), mirroring
# manage_worker_routes / manage_queue_consumers. DNS for oltigo.com is
# currently maintained out of band (Cloudflare dashboard), so enabling this
# before importing existing records would let Terraform try to create
# duplicates. Flip manage_dns to true only after the records below are the
# single source of truth (see the "DNS records" section of infra/README.md).
#
# SCOPE: only the records required to make the MTA-STS policy
# (public/.well-known/mta-sts.txt) effective. This intentionally does NOT
# manage MX / SPF / DMARC / apex / www records — those stay wherever they are
# managed today, so a partial takeover cannot cause a mail outage. See
# SECURITY.md ("Email Transport Security (MTA-STS / TLS-RPT)") for context.
#
# Enabling manage_dns requires:
#   - cloudflare_zone_id set (a precondition below fails the plan otherwise), and
#   - the API token to also carry the "Zone / DNS: Edit" permission
#     (see providers.tf / variables.tf).

# --- MTA-STS policy host ------------------------------------------------------
# Sending MTAs fetch the policy from
# https://mta-sts.<domain>/.well-known/mta-sts.txt. A proxied record puts the
# hostname behind Cloudflare so the wildcard Worker route (*.oltigo.com/*, see
# locals.tf) serves the static policy file. There is no real origin, so the
# record points at the IPv6 discard prefix (100::); proxied records are always
# answered by Cloudflare, so that address is never actually dialed. The
# `mta-sts` label is reserved from tenant registration (see
# src/lib/reserved-subdomains.ts + migration 00200) so it can never be claimed
# as a clinic subdomain.
resource "cloudflare_dns_record" "mta_sts_host" {
  count = var.manage_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = "mta-sts.${var.dns_root_domain}"
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1 # proxied records must use ttl = 1 (automatic)
  comment = "MTA-STS policy host; served by the app Worker (managed by Terraform)"

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_dns = true."
    }
  }
}

# --- MTA-STS policy version record -------------------------------------------
# _mta-sts.<domain> TXT advertises the policy id. Bump var.mta_sts_policy_id
# (and re-deploy public/.well-known/mta-sts.txt) whenever the policy changes so
# sending MTAs re-fetch it.
resource "cloudflare_dns_record" "mta_sts_policy" {
  count = var.manage_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = "_mta-sts.${var.dns_root_domain}"
  type    = "TXT"
  content = "v=STSv1; id=${var.mta_sts_policy_id}"
  ttl     = 3600
  comment = "MTA-STS policy version record (managed by Terraform)"

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_dns = true."
    }
  }
}

# --- SMTP TLS reporting (TLS-RPT) --------------------------------------------
# _smtp._tls.<domain> TXT tells sending MTAs where to report TLS negotiation
# failures, so a broken MTA-STS enforcement surfaces as a report rather than
# silent mail loss. Recommended before switching MTA-STS to mode: enforce.
resource "cloudflare_dns_record" "smtp_tls_reporting" {
  count = var.manage_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = "_smtp._tls.${var.dns_root_domain}"
  type    = "TXT"
  content = "v=TLSRPTv1; rua=mailto:${var.mta_sts_report_email}"
  ttl     = 3600
  comment = "SMTP TLS reporting (TLS-RPT) endpoint (managed by Terraform)"

  lifecycle {
    precondition {
      condition     = var.cloudflare_zone_id != null && var.cloudflare_zone_id != ""
      error_message = "cloudflare_zone_id must be set when manage_dns = true."
    }
  }
}
