# Network Segmentation Hardening (A39)

## Overview

This document describes the network segmentation controls implemented to prevent SSRF attacks, webhook spoofing, and DNS rebinding attacks on the Oltigo Health platform.

## Egress Filtering (A39.1)

### Purpose

Prevent Server-Side Request Forgery (SSRF) attacks where an attacker-controlled URL parameter could be used to:
- Probe internal services (e.g., cloud metadata endpoints at 169.254.169.254)
- Exfiltrate data to external hosts
- Bypass firewall rules by pivoting through the application server

### Implementation

The middleware enforces an allowlist of external hosts that Workers can `fetch()` to:

```typescript
const ALLOWED_HOSTS = new Set([
  "api.openai.com",           // AI chat and auto-suggest features
  "api.stripe.com",           // International payment processing
  "api.twilio.com",           // SMS and WhatsApp notifications (Twilio provider)
  "graph.facebook.com",       // WhatsApp notifications (Meta Cloud API)
  "api.resend.com",           // Email notifications
  "cmi.co.ma",                // CMI payment gateway (Moroccan interbank)
  "payment.cmi.co.ma",        // CMI hosted payment page
]);
```

### Adding New External Services

When adding a new external service integration:

1. Add the hostname to `ALLOWED_HOSTS` in `src/middleware.ts`
2. Document the business justification in a code comment
3. Update this documentation with the new service

### Testing

Egress filtering is tested in `src/lib/__tests__/network-segmentation.test.ts`:
- Allowed hosts (OpenAI, Stripe, CMI, etc.) pass validation
- Blocked hosts (evil.com, internal services, cloud metadata) are rejected
- Relative URLs (same-origin) are always allowed

## CMI IP Allowlisting (A39.2)

### Purpose

Prevent webhook spoofing attacks where an attacker could send fake payment callbacks to:
- Mark unpaid appointments as paid
- Trigger appointment confirmations without payment
- Bypass payment verification

### Implementation

The CMI webhook endpoint (`/api/webhooks/cmi`) enforces an IP allowlist for CMI's known callback source IPs:

```typescript
const CMI_IP_RANGES = process.env.CMI_IP_RANGES?.split(",").map((r) => r.trim()).filter(Boolean) ?? [];
```

**Morocco IP ranges for CMI (Centre Monétique Interbancaire):**
- `196.200.0.0/16` (primary CMI network)
- `41.140.0.0/16` (backup CMI network)

### Configuration

Set the `CMI_IP_RANGES` environment variable with comma-separated CIDR ranges:

```bash
CMI_IP_RANGES="196.200.0.0/16,41.140.0.0/16"
```

When unset, the IP allowlist check is skipped (HMAC-only, backward compatible).

### Defense-in-Depth

IP allowlisting is a **defense-in-depth** control alongside HMAC signature verification:
1. **Primary defense**: HMAC signature verification (always enforced)
2. **Secondary defense**: IP allowlisting (optional, configured via env var)

Both layers must pass for a webhook to be processed.

### Testing

CMI IP allowlisting is tested in `src/lib/__tests__/network-segmentation.test.ts`:
- IPs within CMI ranges (196.200.x.x, 41.140.x.x) are allowed
- IPs outside CMI ranges are rejected
- Invalid CIDR ranges are handled gracefully

## DNS Sanitization (A39.3)

### Purpose

Prevent DNS rebinding attacks and log injection where control characters in hostname parameters could be used to:
- Bypass hostname allowlists via DNS rebinding
- Inject CRLF sequences into logs
- Exploit parsers that don't handle control characters correctly

### Implementation

The `sanitizeHostname()` function strips control characters (ASCII 0x00-0x1F and 0x7F-0x9F) from hostname parameters:

```typescript
function sanitizeHostname(hostname: string): string {
  return hostname.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}
```

This is applied before checking hostnames against the egress allowlist.

### Testing

DNS sanitization is tested in `src/lib/__tests__/network-segmentation.test.ts`:
- Clean hostnames pass through unchanged
- Hostnames with null bytes, CRLF, and other control characters are sanitized
- ANSI escape sequences are stripped

## Preservation Requirements

### External API Calls

All existing external API calls continue to work:
- **OpenAI**: AI chat and auto-suggest features
- **Stripe**: International payment processing
- **Twilio**: SMS and WhatsApp notifications
- **Meta (Facebook)**: WhatsApp Cloud API notifications
- **Resend**: Email notifications
- **CMI**: Moroccan payment gateway

### Webhook Functionality

All existing webhook functionality remains unchanged:
- **WhatsApp webhooks**: `/api/webhooks` (Meta HMAC signature)
- **Stripe webhooks**: `/api/payments/webhook` (Stripe signature)
- **CMI callbacks**: `/api/payments/cmi/callback` (CMI HMAC hash)
- **CMI webhooks**: `/api/webhooks/cmi` (CMI HMAC hash + IP allowlist)

### Performance

Middleware processing continues without performance degradation:
- Egress filtering adds minimal overhead (Set lookup)
- DNS sanitization is a simple regex replace
- IP allowlisting is only checked for CMI webhooks (low volume)

## Security Considerations

### SSRF Prevention

Egress filtering prevents SSRF attacks by:
- Blocking requests to internal services (169.254.169.254, 10.x.x.x, 192.168.x.x)
- Blocking requests to arbitrary external hosts
- Allowing only business-critical external services

### Webhook Spoofing Prevention

CMI IP allowlisting prevents webhook spoofing by:
- Rejecting callbacks from non-CMI IPs
- Requiring both IP allowlist AND HMAC signature verification
- Failing closed when IP is unknown and allowlist is configured

### DNS Rebinding Prevention

DNS sanitization prevents DNS rebinding by:
- Stripping control characters that could bypass allowlists
- Preventing CRLF injection into logs
- Ensuring hostnames are safe for DNS resolution

## Compliance

This implementation addresses:
- **A39.1**: Egress filtering requirement
- **A39.2**: CMI IP allowlisting requirement
- **A39.3**: DNS sanitization requirement

From the Phase 2 Infrastructure Hardening audit (A31-A60).

## References

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CMI Payment Gateway Documentation](https://www.cmi.co.ma/)
- [DNS Rebinding Attacks](https://en.wikipedia.org/wiki/DNS_rebinding)
