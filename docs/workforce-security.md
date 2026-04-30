# Workforce Security Policies

> **Audit findings:** A179-A186 | **Last updated:** April 2026

This document consolidates workforce IAM, privileged access, break-glass,
endpoint, JML (Joiner-Mover-Leaver), insider risk, and training policies.

---

## 1. Workforce IAM & SSO (A179)

### Current State

- **Application users** authenticate via Supabase Auth with TOTP MFA.
- **Workforce (operators/developers)** -- policy below.

### Requirements

Once the team exceeds 3 people, enforce:

| System | IdP / SSO | MFA Requirement |
|--------|-----------|-----------------|
| GitHub (org) | GitHub SSO or SAML (Google/Okta/Entra) | WebAuthn (passkey) for org owners |
| Cloudflare | Cloudflare Access with SSO | WebAuthn for admins |
| Supabase | Supabase Dashboard SSO (if available) or shared 1Password vault | TOTP minimum |
| Sentry | SAML SSO | TOTP minimum |
| Stripe | Stripe Dashboard SSO | TOTP minimum |
| Resend | Email + MFA | TOTP minimum |

### Conditional Access Rules

- Block logins from countries outside Morocco, France, and known team locations.
- Require re-authentication for sensitive operations (secret rotation, DB access).
- JIT (Just-In-Time) elevation for production database access (see Break-Glass below).

---

## 2. Privileged Role Map (A180)

**Rule:** Every critical system must have at least 2 named humans with admin access. No shared accounts.

| System | Role | Person 1 | Person 2 | Last Recert |
|--------|------|----------|----------|-------------|
| GitHub (org owner) | `groupsmix` org owner | _TBD_ | _TBD_ | _TBD_ |
| Supabase (service-role) | Project admin | _TBD_ | _TBD_ | _TBD_ |
| Cloudflare (super admin) | Account admin | _TBD_ | _TBD_ | _TBD_ |
| Stripe (account owner) | Account owner | _TBD_ | _TBD_ | _TBD_ |
| Meta Business (WhatsApp) | Business admin | _TBD_ | _TBD_ | _TBD_ |
| DNS (registrar) | Domain admin | _TBD_ | _TBD_ | _TBD_ |

### Recertification

- **Quarterly:** Export user lists from GitHub, Cloudflare, Supabase, Stripe.
- **Review:** Confirm each account is still needed, role is appropriate.
- **Sign-off:** Security Officer / DPO signs recertification record.
- **Store:** Recertification records in `docs/recertification/YYYY-QN.md`.

---

## 3. Break-Glass Accounts (A181)

### Purpose

Emergency-only accounts for when normal authentication is unavailable
(IdP outage, account lockout, MFA device loss).

### Accounts

| System | Account Name | Credential Storage | Alert On Use |
|--------|-------------|-------------------|--------------|
| GitHub | `oltigo-breakglass` (org owner) | 1Password vault (split: Person A has password, Person B has MFA recovery) | Sentry alert + PagerDuty |
| Supabase | Supabase project owner (email-based) | 1Password vault (split custody) | Sentry alert |
| Cloudflare | `breakglass@oltigo.com` | 1Password vault (split custody) | Cloudflare audit log alert |

### Procedures

1. **Two-person authorization** required to access break-glass credentials.
2. **Every use** must trigger a high-priority alert (configure in Sentry/PagerDuty).
3. **Every use** requires a post-mortem within 48 hours documenting:
   - Why break-glass was needed
   - What actions were taken
   - Timeline of access
   - Whether normal access has been restored
4. **Annual drill:** Test break-glass login once per year to verify credentials work.

### Drill Schedule

| System | Last Drill | Next Drill | Owner |
|--------|-----------|------------|-------|
| GitHub | _Not yet_ | Q3 2026 | Security Officer |
| Supabase | _Not yet_ | Q3 2026 | Security Officer |
| Cloudflare | _Not yet_ | Q3 2026 | Security Officer |

---

## 4. Endpoint Security (A182)

### Requirements

Any device that accesses production data (Supabase, Cloudflare dashboard,
patient data via the app) must meet:

| Control | Requirement | Enforcement |
|---------|------------|-------------|
| Full Disk Encryption (FDE) | Enabled (FileVault / BitLocker / LUKS) | MDM policy |
| Auto screen lock | < 5 minutes | MDM policy |
| OS patching | Within 14 days of release | MDM compliance check |
| Antivirus / EDR | Active (macOS: built-in XProtect; Windows: Defender) | MDM policy |
| USB mass storage | Blocked on devices with PHI access | MDM policy |
| Browser extensions | Security-reviewed allowlist only | MDM policy |
| BYOD | Not permitted for PHI access | Policy |

### MDM Options (Choose One)

| Tool | Platform | Cost |
|------|----------|------|
| **Kandji** | macOS, iOS | $$ |
| **Jamf** | macOS, iOS | $$$ |
| **Microsoft Intune** | Windows, macOS, iOS, Android | $$ (included with M365 E3) |
| **Mosyle** | macOS, iOS | $ |

### Action Items

- [ ] Select and deploy MDM solution
- [ ] Enroll all team devices
- [ ] Create compliance dashboard
- [ ] Block non-compliant devices from production access

---

## 5. Joiner-Mover-Leaver (JML) Process (A183)

### Onboarding (Joiner)

Ticket required for every new team member. Checklist:

- [ ] Create accounts: GitHub (add to org), Cloudflare, Supabase (if needed)
- [ ] Assign role per Privileged Role Map (principle of least privilege)
- [ ] Enroll device in MDM
- [ ] Enable MFA on all accounts
- [ ] Complete security training (see Section 7)
- [ ] Sign acceptable-use policy
- [ ] Add to on-call rotation if applicable
- [ ] Document in `docs/team-roster.md`

### Role Change (Mover)

- [ ] Review current access and adjust per new role
- [ ] Revoke access no longer needed
- [ ] Update Privileged Role Map
- [ ] Re-complete role-specific security training if role changes scope

### Offboarding (Leaver)

Ticket required. Signed exit checklist:

- [ ] Revoke GitHub org access
- [ ] Revoke Cloudflare access
- [ ] Revoke Supabase access
- [ ] Revoke Stripe access
- [ ] Revoke Meta Business / WhatsApp access
- [ ] Revoke Sentry access
- [ ] Revoke Resend access
- [ ] Remove from 1Password shared vaults
- [ ] Wipe device (if company-owned) or remove MDM profile (if BYOD)
- [ ] Rotate any shared secrets the person had access to
- [ ] Remove from on-call rotation
- [ ] Update `docs/team-roster.md`
- [ ] Exit checklist signed by: Security Officer / DPO (`security@oltigo.com`)

### Quarterly Access Review

1. Export user lists from: GitHub, Cloudflare, Supabase, Stripe, Sentry.
2. Compare against `docs/team-roster.md`.
3. Remove any orphaned accounts.
4. Document review in `docs/recertification/YYYY-QN.md`.

---

## 6. Insider Risk Telemetry (A184)

### Application-Level (Existing)

- `logAuditEvent()` captures all state-changing operations with `user_id`,
  `clinic_id`, `action`, `ip_address`, `user_agent`.

### Operator-Level (New -- Action Required)

Configure alerts for:

| Signal | Source | Alert Destination |
|--------|--------|-------------------|
| Supabase service-role key usage outside CI IPs | Supabase Dashboard logs | Sentry / PagerDuty |
| GitHub mass clone / bulk download events | GitHub Audit Log | Sentry |
| Cloudflare admin login from new geolocation | Cloudflare Audit Log | Email alert |
| `SELECT *` on production tables (bulk export) | Supabase query logs | Manual review weekly |
| Off-hours admin activity (outside 07:00-22:00 Africa/Casablanca) | Supabase + Cloudflare logs | Sentry |

### Shadow IT (A185)

For teams < 10 people, a semi-annual finance review of SaaS subscriptions
is sufficient. Add a check for unsanctioned AI tools (ChatGPT, Claude, etc.)
being used with patient data.

---

## 7. Workforce Security Training (A186)

### Requirements

| Training | Audience | Frequency | Format |
|----------|----------|-----------|--------|
| Security onboarding | All new hires | On join | Self-paced module + quiz |
| Annual security awareness | All team members | Annual | Self-paced module + quiz |
| Phishing simulation | All team members | Annual (minimum) | Simulated phishing campaign |
| PHI handling | Anyone with PHI access | Annual | Role-based module |
| Incident response | On-call engineers | Annual | Tabletop exercise (see A189) |
| Secure coding | Developers | Annual | OWASP Top 10 review + code review exercise |

### Training Records

Maintain records in `docs/training/YYYY-name.md` with:
- Date completed
- Training type
- Pass/fail status
- Next due date

### Reporting Channel

Security concerns hotline: `security@oltigo.com` (already established in SECURITY.md).

---

## Related Documents

- [Incident Response Runbook](./incident-response.md)
- [SECURITY.md](../SECURITY.md)
- [Data Residency & Sub-Processors](./data-residency.md)
- [SOP: Secret Rotation](./SOP-SECRET-ROTATION.md)
