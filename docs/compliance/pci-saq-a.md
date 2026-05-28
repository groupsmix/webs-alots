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
