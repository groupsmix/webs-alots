# DNS & Email Security Configuration

> **Audit findings:** A144-A151 | **Last updated:** April 2026

This document contains copy-paste-ready DNS records and configuration for
securing Oltigo Health's email and domain infrastructure.

---

## 1. Reporting Mailboxes (A151-F6)

Before applying any of the records below, verify that these mailboxes exist
and are monitored:

| Mailbox | Purpose | Monitored by |
|---------|---------|--------------|
| `dmarc@oltigo.com` | DMARC aggregate + forensic reports | Security team |
| `tls-rpt@oltigo.com` | TLS-RPT failure reports | Security team |
| `security@oltigo.com` | VDP / vulnerability reports | Security team |
| `abuse@oltigo.com` | Abuse complaints (RFC 2142) | Security team |
| `postmaster@oltigo.com` | Email delivery issues (RFC 2142) | Security team |

**Action:** Create all mailboxes (or aliases forwarding to a shared inbox)
and confirm delivery before publishing the DNS records below.

---

## 2. SPF (Sender Policy Framework)

Authorizes Resend (our transactional email provider) and Cloudflare's
infrastructure to send on behalf of `oltigo.com`.

```dns
; SPF — single TXT record on the apex domain
; Include Resend's SPF + Cloudflare (if using CF Email Routing)
TXT  oltigo.com  "v=spf1 include:send.resend.com include:_spf.mx.cloudflare.net ~all"
```

**Notes:**
- `~all` (softfail) is recommended during initial rollout. Move to `-all`
  (hardfail) once DMARC is at `p=reject` and all legitimate senders are
  confirmed.
- Do not add more than 10 DNS lookups total (current: 2 includes).

---

## 3. DMARC (Domain-based Message Authentication)

### Phase 1: Monitor (deploy immediately)

```dns
TXT  _dmarc.oltigo.com  "v=DMARC1; p=none; rua=mailto:dmarc@oltigo.com; ruf=mailto:dmarc@oltigo.com; fo=1; adkim=r; aspf=r; pct=100"
```

### Phase 2: Quarantine (after 2-4 weeks of clean reports)

```dns
TXT  _dmarc.oltigo.com  "v=DMARC1; p=quarantine; rua=mailto:dmarc@oltigo.com; ruf=mailto:dmarc@oltigo.com; fo=1; adkim=r; aspf=r; pct=25"
```

Ramp `pct` from 25 -> 50 -> 75 -> 100 over 4 weeks.

### Phase 3: Reject (target state)

```dns
TXT  _dmarc.oltigo.com  "v=DMARC1; p=reject; rua=mailto:dmarc@oltigo.com; ruf=mailto:dmarc@oltigo.com; fo=1; adkim=s; aspf=s; pct=100"
```

**Notes:**
- `fo=1` sends forensic reports on any alignment failure (useful during
  monitor phase).
- `adkim=s; aspf=s` (strict alignment) should only be set at Phase 3 once
  all senders are DKIM-aligned.

---

## 4. DKIM

DKIM signing is handled by Resend. Follow their domain verification flow:

1. Go to Resend Dashboard -> Domains -> Add Domain
2. Add the three CNAME records Resend provides (typically
   `resend._domainkey.oltigo.com`)
3. Wait for verification (usually < 5 minutes)

Resend rotates DKIM keys automatically. No manual key management required.

---

## 5. CAA (Certification Authority Authorization)

Restrict which CAs can issue TLS certificates for `oltigo.com`. Cloudflare
uses Google Trust Services and Let's Encrypt.

```dns
; Allow only CAs that Cloudflare uses for edge certificates
CAA  oltigo.com  0 issue "letsencrypt.org"
CAA  oltigo.com  0 issue "pki.goog"
CAA  oltigo.com  0 issue "digicert.com"

; Allow wildcard issuance from the same CAs
CAA  oltigo.com  0 issuewild "letsencrypt.org"
CAA  oltigo.com  0 issuewild "pki.goog"
CAA  oltigo.com  0 issuewild "digicert.com"

; Security contact for mis-issuance reports
CAA  oltigo.com  0 iodef "mailto:security@oltigo.com"
```

**Notes:**
- `digicert.com` is included because Cloudflare may use DigiCert for
  certain certificate types (Advanced Certificate Manager).
- Review annually; if Cloudflare changes CA providers, update accordingly.

---

## 6. MTA-STS (Mail Transfer Agent Strict Transport Security)

MTA-STS tells sending mail servers to require TLS when delivering to
`oltigo.com`. Requires two pieces:

### 6a. DNS record

```dns
TXT  _mta-sts.oltigo.com  "v=STSv1; id=20260430T000000"
```

**Important:** Bump the `id` value every time you update the policy file.
The `id` is opaque; a timestamp works well.

### 6b. Policy file

The policy file must be served at:
`https://mta-sts.oltigo.com/.well-known/mta-sts.txt`

This requires either:
- A Cloudflare Worker on the `mta-sts.oltigo.com` subdomain, or
- A static site / Pages project serving the file.

The policy file content is in [`public/.well-known/mta-sts.txt`](../public/.well-known/mta-sts.txt).

**Hosting options (pick one):**

1. **Cloudflare Pages** -- Create a Pages project with just the
   `.well-known/mta-sts.txt` file, custom domain `mta-sts.oltigo.com`.
2. **Cloudflare Worker** -- Inline the policy text in a Worker response.
3. **Next.js route** -- Serve from the main app (requires
   `mta-sts.oltigo.com` to point to the same Worker).

---

## 7. TLS-RPT (TLS Reporting)

Tells sending servers where to report TLS delivery failures (complements
MTA-STS).

```dns
TXT  _smtp._tls.oltigo.com  "v=TLSRPTv1; rua=mailto:tls-rpt@oltigo.com"
```

---

## 8. BIMI (Brand Indicators for Message Identification)

BIMI displays the Oltigo logo next to emails in supporting clients.
**Prerequisite:** DMARC must be at `p=quarantine` or `p=reject`.

### Phase 1: Prepare assets

1. Create an SVG Tiny PS logo at `https://oltigo.com/bimi-logo.svg`
   (must be SVG Tiny 1.2 Portable/Secure profile).
2. Optionally obtain a Verified Mark Certificate (VMC) from DigiCert or
   Entrust and host at `https://oltigo.com/vmc.pem`.

### Phase 2: Publish DNS (only after DMARC enforces)

```dns
TXT  default._bimi.oltigo.com  "v=BIMI1; l=https://oltigo.com/bimi-logo.svg; a=https://oltigo.com/vmc.pem"
```

If no VMC is available yet, omit the `a=` tag:

```dns
TXT  default._bimi.oltigo.com  "v=BIMI1; l=https://oltigo.com/bimi-logo.svg"
```

---

## 9. Complete DNS Record Summary

| Type | Name | Value | Priority |
|------|------|-------|----------|
| TXT | `oltigo.com` | `v=spf1 include:send.resend.com include:_spf.mx.cloudflare.net ~all` | -- |
| TXT | `_dmarc.oltigo.com` | (see Phase 1/2/3 above) | -- |
| CNAME | `resend._domainkey.oltigo.com` | (from Resend dashboard) | -- |
| CAA | `oltigo.com` | `0 issue "letsencrypt.org"` | -- |
| CAA | `oltigo.com` | `0 issue "pki.goog"` | -- |
| CAA | `oltigo.com` | `0 issue "digicert.com"` | -- |
| CAA | `oltigo.com` | `0 issuewild "letsencrypt.org"` | -- |
| CAA | `oltigo.com` | `0 issuewild "pki.goog"` | -- |
| CAA | `oltigo.com` | `0 issuewild "digicert.com"` | -- |
| CAA | `oltigo.com` | `0 iodef "mailto:security@oltigo.com"` | -- |
| TXT | `_mta-sts.oltigo.com` | `v=STSv1; id=20260430T000000` | -- |
| TXT | `_smtp._tls.oltigo.com` | `v=TLSRPTv1; rua=mailto:tls-rpt@oltigo.com` | -- |
| TXT | `default._bimi.oltigo.com` | `v=BIMI1; l=https://oltigo.com/bimi-logo.svg; a=https://oltigo.com/vmc.pem` | -- |

---

## 10. Verification Checklist

After applying records, verify with:

- [ ] `dig TXT oltigo.com` -- SPF record present
- [ ] `dig TXT _dmarc.oltigo.com` -- DMARC record present
- [ ] `dig CAA oltigo.com` -- CAA records present
- [ ] `dig TXT _mta-sts.oltigo.com` -- MTA-STS DNS record present
- [ ] `curl https://mta-sts.oltigo.com/.well-known/mta-sts.txt` -- policy file served
- [ ] `dig TXT _smtp._tls.oltigo.com` -- TLS-RPT record present
- [ ] Send test email from `noreply@oltigo.com` and check DMARC alignment
- [ ] Use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) or [mail-tester.com](https://www.mail-tester.com) to validate full stack
- [ ] Confirm `dmarc@oltigo.com` receives aggregate reports within 24-48h
- [ ] Confirm `tls-rpt@oltigo.com` receives TLS reports

## Related Documents

- [Data Residency & Sub-Processors](./data-residency.md)
- [Incident Response Runbook](./incident-response.md)
- [SECURITY.md](../SECURITY.md)
