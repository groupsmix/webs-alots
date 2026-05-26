# DNS & Infrastructure Security Checklist

> **Audit findings:** A144–A151 | **Last updated:** May 2026

This checklist covers DNS, email authentication, domain security, and
certificate management. These items require action in external dashboards
(Namecheap, Cloudflare, Resend) — they cannot be fixed in code alone.

---

## Email Authentication (A144)

### SPF (Sender Policy Framework)

- [ ] **A144-F1**: Add Resend to SPF record
  ```
  v=spf1 include:_spf.mx.cloudflare.net include:spf.resend.com ~all
  ```
  **Where:** Namecheap DNS → TXT record on `@`

### DKIM (DomainKeys Identified Mail)

- [ ] **A144-F2**: Rotate DKIM key to 2048-bit
  - Resend Dashboard → Domain Settings → Rotate DKIM Key
  - Verify new DNS records are published
  - Test with: `dig TXT resend._domainkey.oltigo.com`

### DMARC (Domain-based Message Authentication)

- [ ] **A144-F3**: Add DMARC record (start with p=none, escalate to quarantine)
  ```
  _dmarc.oltigo.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@oltigo.com; pct=100; adkim=s; aspf=s"
  ```
  **Where:** Namecheap DNS → TXT record on `_dmarc`

---

## DNS Security (A145)

### DNSSEC

- [ ] **A145-F1**: Enable DNSSEC
  - Cloudflare Dashboard → DNS → DNSSEC → Enable
  - Copy DS record to Namecheap → Advanced DNS → DNSSEC

### CAA Records

- [ ] **A145-F2**: Add CAA records to restrict certificate issuance
  ```
  @ CAA 0 issue "letsencrypt.org"
  @ CAA 0 issue "pki.goog"
  @ CAA 0 issue "sectigo.com"
  @ CAA 0 issuewild "letsencrypt.org"
  @ CAA 0 iodef "mailto:security@oltigo.com"
  ```
  **Where:** Cloudflare Dashboard → DNS → Add CAA records

### MTA-STS

- [x] **A145-F3**: MTA-STS file published at `/.well-known/mta-sts.txt`
  - File exists in `public/.well-known/mta-sts.txt`
  - [ ] Add DNS TXT record: `_mta-sts.oltigo.com TXT "v=STSv1; id=20260501T000000"`

---

## Domain Security (A147)

- [ ] **A147-F1**: Enable `serverTransferProhibited` lock
  - Namecheap → Domain → Transfer Lock → Enable
- [ ] **A147-F2**: Enable 2FA + hardware key on registrar
  - Namecheap → Account → Security → Enable TOTP + FIDO2/WebAuthn
- [x] **A147-F3**: Auto-renew verified (domain expires 2027-03-24)

---

## Cloudflare Security (A36)

### WAF

- [ ] **A36-F2**: Enable Cloudflare Managed Ruleset
  - Cloudflare Dashboard → Security → WAF → Managed Rules → Enable
- [ ] **A36-F3**: Enable Bot Fight Mode
  - Cloudflare Dashboard → Security → Bots → Bot Fight Mode → On
- [ ] **A36-F4**: Enable rate limiting rules
  - Cloudflare Dashboard → Security → WAF → Rate Limiting Rules

### TLS

- [ ] **A36-F1**: Set minimum TLS version to 1.2
  - Cloudflare Dashboard → SSL/TLS → Edge Certificates → Minimum TLS Version → 1.2
- [ ] **A36-F5**: Enable HSTS preload
  - Cloudflare Dashboard → SSL/TLS → Edge Certificates → HSTS → Enable with preload

### Geo-restrictions

- [ ] **A36-F6**: Block traffic from high-risk countries (beyond app-level sanctions blocking)
  - Cloudflare Dashboard → Security → WAF → Custom Rules → Block by country

---

## R2 Bucket Security (A37)

- [ ] **A37-F1**: Enable Object Lock (WORM) on PHI backup bucket
  - Cloudflare Dashboard → R2 → Bucket Settings → Object Lock
- [ ] **A37-F2**: Enable bucket versioning on PHI bucket
- [ ] **A37-F3**: Configure lifecycle policy for old versions
- [ ] **A37-F4**: Disable public bucket access (confirm)

---

## GitHub Branch Protection (A175)

- [ ] Require at least 1 CODEOWNER review on `main`
- [ ] Require status checks to pass (lint, typecheck, tests)
- [ ] Require signed commits (GPG/SSH)
- [ ] Disable force push on `main`
- [ ] Enable auto-delete head branches after merge

**Where:** GitHub → Repository Settings → Branches → Branch protection rules

---

## Verification Commands

```bash
# Check SPF
dig TXT oltigo.com | grep spf

# Check DKIM
dig TXT resend._domainkey.oltigo.com

# Check DMARC
dig TXT _dmarc.oltigo.com

# Check DNSSEC
dig +dnssec oltigo.com

# Check CAA
dig CAA oltigo.com

# Check MTA-STS
dig TXT _mta-sts.oltigo.com
curl -s https://oltigo.com/.well-known/mta-sts.txt

# Check HSTS preload readiness
curl -sI https://oltigo.com | grep -i strict-transport-security

# Verify SSL certificate
echo | openssl s_client -connect oltigo.com:443 -servername oltigo.com 2>/dev/null | openssl x509 -noout -dates
```
