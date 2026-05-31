# PCI DSS v4.0 — SAQ-A Self-Assessment

> **Scope:** Oltigo Health (oltigo.com)
> **Assessment type:** SAQ-A (card-not-present, all cardholder data functions outsourced)
> **Last reviewed:** May 2026
> **Next review due:** May 2027

## 1. Scope Determination

Oltigo Health **never** receives, stores, processes, or transmits cardholder data (PAN, CVV, expiry).

- **Stripe:** Handles all international card payments via Stripe Checkout / Elements. PAN is captured client-side by Stripe.js and sent directly to Stripe's PCI-DSS Level 1 certified infrastructure. Only payment references (`pi_*`, `cs_*`) are stored in our database.
- **CMI (Centre Monétique Interbancaire):** Handles Moroccan interbank card payments. Patients are redirected to CMI's hosted payment page. Only the transaction reference and HMAC-verified callback status are stored.

**Conclusion:** Oltigo qualifies as **SAQ-A** — a merchant that has fully outsourced all cardholder data functions to PCI-validated third parties.

## 2. SAQ-A Requirements Checklist

| Req    | Description                      | Status    | Evidence                                                                                             |
| ------ | -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| 2.1    | Vendor default passwords changed | N/A       | No payment infrastructure under our control                                                          |
| 6.4.3  | Payment page scripts inventory   | Compliant | Stripe.js loaded via `@stripe/stripe-js` npm package; CSP `script-src` uses nonce + `strict-dynamic` |
| 8.3.6  | MFA for administrative access    | Compliant | `src/lib/middleware/mfa-enforcement.ts` enforces TOTP for super_admin                                |
| 9.4.1  | No physical media with CHD       | N/A       | SaaS-only, no physical media                                                                         |
| 11.6.1 | Payment page change detection    | Compliant | SHA-pinned GitHub Actions + cosign-signed SBOM + Cloudflare Workers immutable deploys                |
| 12.1   | Information security policy      | Compliant | `docs/compliance/information-security-policy.md`                                                     |
| 12.8   | Service provider management      | Compliant | DPA with Stripe; CMI operates under Moroccan banking regulation                                      |

## 3. Third-Party PCI Certifications

| Provider   | Role                            | PCI Level               | AOC Available                                                                                               |
| ---------- | ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Stripe     | Card processing (international) | Level 1                 | [stripe.com/docs/security](https://stripe.com/docs/security)                                                |
| CMI        | Card processing (Morocco)       | Level 1 (BAM-regulated) | Available on request                                                                                        |
| Supabase   | Database hosting                | N/A (no CHD stored)     | —                                                                                                           |
| Cloudflare | CDN / Workers                   | Level 1                 | [cloudflare.com/trust-hub/compliance-resources](https://www.cloudflare.com/trust-hub/compliance-resources/) |

## 4. Annual Actions

- [ ] Review and renew this SAQ-A assessment
- [ ] Verify Stripe and CMI PCI AOC certificates are current
- [ ] Confirm no new flows introduce direct card handling
- [ ] File updated SAQ-A with acquiring bank if required

## 5. CMI AOC Tracking (A65-F3)

> **Audit finding A65-F3:** CMI (Centre Monétique Interbancaire) Attestation of Compliance (AOC) is not tracked or retained in this repository. PCI DSS v4.0 Req 12.8.4 requires that service provider PCI compliance status is monitored at least annually.

### Current Status

| Item              | Value                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| CMI PCI level     | Level 1 (BAM-regulated)                                                |
| AOC last obtained | _Not yet obtained — **ACTION REQUIRED**_                               |
| AOC next renewal  | _TBD — set after first AOC is filed_                                   |
| Storage location  | `docs/compliance/aoc/cmi-aoc-YYYY.pdf`                                 |
| Contact           | CMI Compliance Dept. — request via acquiring bank relationship manager |

### How to Obtain the CMI AOC

1. Contact CMI's compliance department through your acquiring bank relationship manager (Attijariwafa, CIH, or Banque Populaire depending on your merchant agreement).
2. Request the current **Attestation of Compliance (AOC) — Service Provider** form for their PCI DSS certification.
3. Confirm the AOC covers the hosted payment page product used by Oltigo (CMI DirectPay / CMI Redirect).
4. Save the signed PDF to `docs/compliance/aoc/cmi-aoc-YYYY.pdf` (where `YYYY` = certificate year) and commit it.
5. Update the table above with the obtained date and next renewal date.

### Annual Reminder

Add a recurring calendar event each **January** to:

- Verify the CMI AOC on file has not expired.
- Request a renewed AOC if the existing one covers fewer than 6 months remaining.
- Repeat the Stripe AOC check at [stripe.com/docs/security](https://stripe.com/docs/security).

> Until the CMI AOC is obtained and filed, this requirement is **open**. No cardholder data flows through Oltigo's systems, but evidence of CMI's certification must be retained to satisfy PCI DSS 12.8.4.

## 6. ASV Scan & Penetration Test Evidence (A65-F1, A65-F2)

| Activity           | Cadence   | Last completed | Next due | Evidence location           |
| ------------------ | --------- | -------------- | -------- | --------------------------- |
| ASV external scan  | Quarterly | _Pending_      | _TBD_    | `docs/compliance/asv/`      |
| Penetration test   | Annual    | _Pending_      | _TBD_    | `docs/compliance/pentest/`  |
| Internal vuln scan | Quarterly | _Pending_      | _TBD_    | `docs/compliance/vulnscan/` |

> Track scan reports and remediation evidence in the directories listed above.
