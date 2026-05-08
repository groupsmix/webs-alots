# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Oltigo Health, please report it responsibly. **Do not open a public GitHub issue.**

### Contact

- **Email:** [security@oltigo.com](mailto:security@oltigo.com)
- **Subject line:** `[SECURITY] Brief description of the issue`

### What to Include

- Description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- Affected component (e.g., auth, RLS, PHI encryption, payment processing)
- Potential impact assessment
- Any suggested remediation

### Response Timeline

| Stage | Target |
|---|---|
| Acknowledgement | Within **48 hours** |
| Initial triage | Within **5 business days** |
| Status update | Within **10 business days** |
| Fix deployed | Within **30 days** for critical/high severity |

### Scope

The following areas are **in scope** for security reports:

- Authentication and authorization (Supabase Auth, RBAC, impersonation)
- Row Level Security (RLS) and tenant isolation
- PHI encryption at rest (AES-256-GCM)
- Payment processing (Stripe, CMI gateway, webhook verification)
- CSRF, CSP, and other HTTP security headers
- File upload validation and path traversal prevention (R2 storage)
- WhatsApp webhook signature verification
- API rate limiting bypass
- Cross-tenant data leakage

The following are **out of scope**:

- Issues in third-party dependencies (report upstream)
- Social engineering attacks
- Denial of service (DoS) attacks
- Issues requiring physical access

### Safe Harbor

Oltigo Health supports safe harbor for security researchers who:

1. Make a good-faith effort to avoid privacy violations, data destruction, and service disruption.
2. Only interact with accounts they own or with explicit permission of the account holder.
3. Do not exploit a security issue for purposes beyond what is necessary to demonstrate the vulnerability.
4. Report the vulnerability through the channels described above before disclosing publicly.
5. Allow a reasonable time (at least 90 days) for remediation before any public disclosure.

**We will not pursue civil or criminal legal action, or send notice to law enforcement, against researchers who follow these guidelines.** If legal action is initiated by a third party against a researcher who has complied with this policy, we will take steps to make it known that the researcher's actions were conducted in compliance with this policy.

## Supported Versions

| Version | Supported |
|---|---|
| Latest `main` | Yes |
| `staging` | Best-effort |
| Older commits | No |

## Security Architecture Overview

Oltigo Health implements defense-in-depth security:

1. **Middleware layer** — Strips tenant headers from incoming requests to prevent spoofing; enforces CSRF Origin checks on mutations
2. **Row Level Security** — Every table uses `clinic_id`-scoped RLS policies enforced at the database level
3. **Seed user guard** — Runtime + database-level blocking of seed users with well-known passwords (3-layer protection)
4. **PHI encryption** — AES-256-GCM with unique IV per file for patient health information at rest
5. **CSP** — Per-request nonce generation with violation reporting to Sentry
6. **Rate limiting** — 3-tier backend (Cloudflare KV → Supabase → in-memory fallback) with per-endpoint limits

## PHI Masking Defaults

The UI masks Protected Health Information (PHI) — phone numbers, emails,
CIN — based on `NEXT_PUBLIC_DATA_MASKING`:

| Value     | Behaviour                                              |
|-----------|--------------------------------------------------------|
| `full`    | Aggressive masking (demos, public screens)             |
| `partial` | Moderate masking — staff who need partial visibility   |
| `none`    | No masking (authorized personnel only)                 |

**Production default is `partial`.** It is configured in two places that
must agree:

- `wrangler.toml` → `[vars] NEXT_PUBLIC_DATA_MASKING = "partial"` (and `[env.staging.vars]`)
- `.env.production.example` → `NEXT_PUBLIC_DATA_MASKING=partial`

### Startup enforcement

`enforcePhiMaskingPolicy()` in `src/lib/env.ts` runs from the Next.js
instrumentation hook (`src/instrumentation.ts`) and refuses to boot when:

```
NODE_ENV === "production"
&& NEXT_PUBLIC_DATA_MASKING === "none"
&& ALLOW_UNMASKED_PHI !== "true"
```

This prevents an accidental config drift from exposing patient data in
the UI of a production deployment.

### `ALLOW_UNMASKED_PHI` escape hatch

Setting `ALLOW_UNMASKED_PHI=true` (alongside `NEXT_PUBLIC_DATA_MASKING=none`)
is the only supported way to disable PHI masking in a production build.

It is intended for narrow, audited scenarios — for example, an internal
staff-only deployment behind additional access controls where unmasked
PHI is required to perform clinical work.

**Authorization to set `ALLOW_UNMASKED_PHI=true`:**

- Only the **Security Officer / Data Protection Officer (DPO)** may
  approve setting this flag.
- It must be set as a **Cloudflare Workers secret**
  (`wrangler secret put ALLOW_UNMASKED_PHI`) — never committed to the repo.
- The change must be recorded in the security change log with business
  justification, the approving DPO, and the planned review date.
- A startup warning is logged whenever the flag is active so the
  degraded posture is visible in monitoring.

If you are not the DPO, do not set this variable — request a masking
level of `partial` or `full` instead.

## Compliance

This platform handles Protected Health Information (PHI) under Moroccan **Law 09-08** (Protection of Individuals with Regard to the Processing of Personal Data). All security reports related to PHI handling are treated as **critical priority**.
