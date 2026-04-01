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

## Compliance

This platform handles Protected Health Information (PHI) under Moroccan **Law 09-08** (Protection of Individuals with Regard to the Processing of Personal Data). All security reports related to PHI handling are treated as **critical priority**.
