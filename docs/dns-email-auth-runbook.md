# DNS & Email Authentication Remediation Runbook

> **Audit controls:** A144, A145, A146, A147, A148, A149, A150, A151
> **Date:** 2026-04-30
> **Owner:** Infrastructure / DevOps

This runbook tracks DNS and email authentication findings from the security
audit. Items marked with code changes are handled in the companion PR;
everything else requires manual infrastructure action.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P1 | Must fix before handling real patient data |
| P2 | Fix within 2 weeks of launch |
| P3 | Fix within 6 weeks of launch |

---

## A144 -- Email Authentication per Sending Domain

### A144-F1 (P1): SPF does not include Resend

**Problem:** Outbound email uses Resend (`src/lib/email.ts`), but the SPF
record does not include `spf.resend.com`. All mail from Resend fails SPF
alignment.

**Action:**
```
; Replace current TXT record on oltigo.com
oltigo.com.  TXT  "v=spf1 include:_spf.mx.cloudflare.net include:spf.resend.com ~all"
```

**Verification:**
```bash
dig TXT oltigo.com +short
# Should include both includes
nslookup -type=txt oltigo.com
```

### A144-F2 (P1): DKIM key is 1024-bit

**Problem:** `resend._domainkey.oltigo.com` uses a 1024-bit RSA key. Modern
best practice requires 2048-bit.

**Action:**
1. Log into the Resend dashboard
2. Navigate to Domains > oltigo.com > DKIM
3. Rotate to a 2048-bit key
4. Update the DNS TXT record for `resend._domainkey.oltigo.com`
5. Verify with: `dig TXT resend._domainkey.oltigo.com +short`

### A144-F3 (P1): No DMARC policy

**Problem:** No `_dmarc.oltigo.com` TXT record. Attackers can spoof
`oltigo.com` freely.

**Action -- Phase 1 (quarantine):**
```
_dmarc.oltigo.com.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@oltigo.com; ruf=mailto:dmarc@oltigo.com; sp=quarantine; adkim=s; aspf=s; pct=100; fo=1"
```

**Action -- Phase 2 (reject, after 6 weeks of monitoring):**
```
_dmarc.oltigo.com.  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@oltigo.com; ruf=mailto:dmarc@oltigo.com; sp=reject; adkim=s; aspf=s; pct=100; fo=1"
```

**Monitoring:** Set up a DMARC report aggregator (e.g., Postmark DMARC,
dmarcian, or EasyDMARC free tier) pointed at `dmarc@oltigo.com`.

### A144-F4 (P3): No BIMI record

**Problem:** `default._bimi.oltigo.com` is missing.

**Prerequisite:** DMARC must be at `p=reject` for 2+ weeks.

**Action (after DMARC is at reject):**
```
default._bimi.oltigo.com.  TXT  "v=BIMI1; l=https://oltigo.com/brand/logo.svg; a=https://oltigo.com/brand/vmc.pem"
```

**Note:** A VMC (Verified Mark Certificate) costs approximately $1,500/yr.
Evaluate ROI before purchasing.

### A144-F5 (P2): No custom Return-Path / bounce domain

**Problem:** Resend uses its own bounce domain by default, which breaks
DMARC `aspf=s` (strict SPF alignment).

**Action:**
1. In Resend dashboard, configure a custom Return-Path subdomain:
   `bounces.oltigo.com`
2. Add the required DNS records (CNAME) that Resend provides
3. Verify alignment with a test email to mail-tester.com

---

## A145 -- DNS Hygiene

### A145-F1 (P1): DNSSEC not enabled

**Problem:** No DS record at the registrar. Without DNSSEC, BGP hijack or
off-path DNS injection can serve attacker A-records for oltigo.com.

**Action:**
1. In Cloudflare dashboard: DNS > DNSSEC > Enable DNSSEC
2. Copy the DS record details from Cloudflare
3. In Namecheap: Advanced DNS > DNSSEC > Add DS record
4. Wait for propagation (up to 48h)

**Verification:**
```bash
dig DS oltigo.com +short
# Should return DS record
dig +dnssec oltigo.com
# Should show AD (Authenticated Data) flag
```

### A145-F2 (P1): No CAA records

**Problem:** Any CA globally can issue a certificate for oltigo.com.

**Action:** Add these CAA records in Cloudflare DNS:
```
oltigo.com.  CAA  0 issue "letsencrypt.org"
oltigo.com.  CAA  0 issue "pki.goog"
oltigo.com.  CAA  0 issue "sectigo.com"
oltigo.com.  CAA  0 issuewild "letsencrypt.org;validationmethods=dns-01"
oltigo.com.  CAA  0 iodef "mailto:security@oltigo.com"
```

**Verification:**
```bash
dig CAA oltigo.com +short
```

### A145-F3 (P2): No MTA-STS

**Problem:** Inbound SMTP to oltigo.com mailboxes is not TLS-enforced.

**Action:**
1. Add TXT record:
   ```
   _mta-sts.oltigo.com.  TXT  "v=STSv1; id=20260430"
   ```
2. Host policy file at `https://mta-sts.oltigo.com/.well-known/mta-sts.txt`:
   ```
   version: STSv1
   mode: testing
   mx: *.mx.cloudflare.net
   max_age: 86400
   ```
3. After 2 weeks of monitoring, change `mode: testing` to `mode: enforce`
   and increase `max_age` to `604800` (1 week).

### A145-F4 (P2): No TLS-RPT

**Problem:** No mechanism to receive TLS failure reports.

**Action:**
```
_smtp._tls.oltigo.com.  TXT  "v=TLSRPTv1; rua=mailto:tls-rpt@oltigo.com"
```

### A145-F5 (P3): No DANE (low priority)

**Prerequisite:** DNSSEC must be enabled first.

**Note:** Modern senders (Gmail, Outlook) do not enforce DANE for SMTP.
MTA-STS (A145-F3) is more impactful. Defer until after MTA-STS is enforced.

---

## A146 -- Subdomain Takeover

### A146-F2 (P2): Unknown subdomains should return hard 404

**Status:** FIXED IN CODE (this PR).

Changed `src/middleware.ts` to return HTTP 404 with
`X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` for
unknown subdomains, instead of redirecting to the root domain.

---

## A147 -- WHOIS / Registrar Hygiene

### A147-F1 (P2): No registry lock

**Action:** Contact Namecheap support (requires Pro account) to apply:
- `serverTransferProhibited`
- `serverDeleteProhibited`
- `serverUpdateProhibited`

### A147-F2 (P1): MFA on registrar account

**Action:** If not already done:
1. Enable mandatory 2FA on the Namecheap account
2. Use a hardware key (YubiKey) if possible
3. Store credentials in a shared 1Password vault (not personal devices)

### A147-F3 (P1): Auto-renew and billing alerts

**Action:**
1. Enable auto-renew on Namecheap for oltigo.com
2. Add a calendar reminder 30 days before 2027-03-24 (current expiry)
3. Set up billing alert emails to `domains@oltigo.com`

### A147-F4 (P2): Short registration period

**Action:** Bulk-renew to push expiry to 2031+ (5-year minimum).

---

## A148 -- Certificate Landscape

### A148-F4 (P2): Verify OCSP stapling

**Action:**
```bash
echo | openssl s_client -status -connect oltigo.com:443 2>/dev/null | grep -A 5 "OCSP Response"
# Should show "OCSP Response Status: successful"
```

### A148-F5 (P2): Key reuse policy

**Action:** Document that every manual certificate renewal must generate
a new private key. Add to the team's certificate management SOP.

### A148-F6 (P3): HSTS preload commitment

**Action:** Verify preload status at https://hstspreload.org/?domain=oltigo.com.
Be aware that HSTS preload with `includeSubDomains` means every subdomain
must support HTTPS indefinitely (removal takes 6+ months).

---

## A149 -- Brand / Typosquat Surface

**Action:** Register common typosquats and configure 301 redirects to
`https://oltigo.com`. Each typosquat domain should have identical
DNSSEC + CAA + DMARC posture.

Suggested domains to monitor/register:
- oltigoo.com, olltigo.com, oltgio.com, 0ltigo.com

---

## A150 -- Outbound Email Content

### A150-F1 (P1): List-Unsubscribe headers

**Status:** FIXED IN CODE (this PR).

Added `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
headers to all notification emails sent via `sendNotificationEmail()`.
Headers are passed through to the Resend API payload.

### A150-F2 (P2): Footer unsubscribe link

**Status:** FIXED IN CODE (this PR).

Added "Manage notification preferences" / "Gerer vos preferences de
notification" link in both `email-templates.ts` (English templates) and
`email.ts` (French notification wrapper), deep-linking to
`/patient/preferences`.

---

## A151 -- Inbound Email Hygiene

### A151-F1 (P2): Upstream mailbox spam rules

**Action:** Verify that the mailbox receiving Cloudflare Email Routing
forwarded mail has strict spam filtering enabled. Check the destination
provider's settings (Google Workspace, Microsoft 365, etc.).

### A151-F3 (P2): BEC / executive impersonation rules

**Action:** Configure impersonation protection rules at the destination
email provider:
1. Add executive names/emails to the protected users list
2. Enable external sender warnings for messages claiming to be from
   internal addresses
3. Document the policy in the team's security runbook

---

## Execution Order

1. **Week 1 (P1 blockers):**
   - Enable DNSSEC (A145-F1)
   - Add CAA records (A145-F2)
   - Add DMARC at quarantine (A144-F3)
   - Add Resend to SPF (A144-F1)
   - Rotate DKIM to 2048-bit (A144-F2)
   - Enable 2FA on registrar (A147-F2)
   - Enable auto-renew (A147-F3)

2. **Week 2-3 (P2 items):**
   - Configure custom Return-Path (A144-F5)
   - Add MTA-STS in testing mode (A145-F3)
   - Add TLS-RPT (A145-F4)
   - Registry lock (A147-F1)
   - Bulk-renew domain (A147-F4)
   - Verify OCSP stapling (A148-F4)

3. **Week 4-8 (P3 + DMARC ramp):**
   - Monitor DMARC aggregate reports
   - Move DMARC from quarantine to reject
   - Add BIMI record (A144-F4) after DMARC reject
   - MTA-STS from testing to enforce (A145-F3)
   - Check HSTS preload status (A148-F6)
