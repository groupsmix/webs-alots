# Information Security Policy

**Document ID:** ISMS-POL-001
**Version:** 1.0
**Status:** DRAFT
**Last Updated:** 2026-04-30
**Owner:** CTO / Security Lead
**ISO 27001 Reference:** A.5.1 — Policies for information security

---

## 1. Purpose

This policy establishes the overarching information security framework for Oltigo Health. It defines the principles, responsibilities, and controls that govern the protection of information assets across the platform.

## 2. Scope

This policy applies to:

- All employees, contractors, and third-party service providers with access to Oltigo Health systems
- All information assets including source code, patient data (PHI), clinic configurations, and infrastructure credentials
- All environments: production, staging, development, and CI/CD pipelines

## 3. Information Security Objectives

1. **Confidentiality** — Patient health information (PHI) is accessible only to authorised users within the correct tenant boundary
2. **Integrity** — Data is accurate, complete, and protected from unauthorised modification
3. **Availability** — Services meet the SLOs defined in `docs/slo.md`

## 4. Principles

### 4.1 Defence in Depth

Security controls are layered:

- **Application layer:** `withAuth()` RBAC, Zod input validation, tenant scoping via `requireTenant()`
- **Database layer:** Row Level Security (RLS) policies scoped to `clinic_id`
- **Infrastructure layer:** Cloudflare Workers isolation, R2 encryption, TLS 1.3
- **Process layer:** PR reviews via CODEOWNERS, CodeQL/Semgrep scanning

### 4.2 Least Privilege

- Users are assigned the minimum role required (patient < doctor < receptionist < clinic_admin < super_admin)
- Service accounts use scoped API keys
- Database connections use role-specific credentials

### 4.3 Tenant Isolation

Every database operation MUST be scoped to a `clinic_id`. See `AGENTS.md` for enforcement rules.

### 4.4 Data Classification

| Classification | Examples | Controls |
|---|---|---|
| **Restricted (PHI)** | Patient records, prescriptions, documents | AES-256-GCM encryption, audit logging, tenant isolation |
| **Confidential** | API keys, credentials, internal configs | Environment variables, secret rotation, never logged |
| **Internal** | Source code, architecture docs, audit reports | Access-controlled repository, PR review |
| **Public** | Marketing site, API docs, privacy policy | No special controls |

## 5. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **CTO / Security Lead** | Policy ownership, risk assessment, incident response |
| **Engineering Team** | Secure coding practices, PR reviews, vulnerability remediation |
| **Clinic Administrators** | User access management within their tenant |
| **All Staff** | Compliance with this policy, security awareness training |

## 6. Key Controls

### 6.1 Access Control (A.5.15)

- Authentication via Supabase Auth (email/password + optional TOTP 2FA)
- Role-based access control enforced by `withAuth()` wrapper
- Middleware strips and re-derives tenant context from subdomain

### 6.2 Cryptography (A.8.24)

- PHI files encrypted with AES-256-GCM, unique IV per file
- TLS 1.3 for all data in transit
- Key rotation procedure documented in `scripts/rotate-phi-key.ts`

### 6.3 Secure Development (A.8.28)

- TypeScript strict mode, ESLint with jsx-a11y (error level)
- CodeQL and Semgrep in CI pipeline
- npm audit for dependency vulnerabilities
- CODEOWNERS-enforced PR reviews

### 6.4 Monitoring (A.8.16)

- Error tracking via Sentry (with PHI scrubbing)
- Analytics via Plausible (privacy-first, consent-gated)
- Audit logging for all state-changing operations

### 6.5 Incident Response

- Documented in `docs/incident-response.md`
- On-call procedures in `docs/oncall.md`

### 6.6 Business Continuity (A.5.30)

- Backup and recovery runbook in `docs/backup-recovery-runbook.md`
- Database rollback constraints in `docs/db-rollback-constraints.md`

## 7. Compliance

- **Moroccan Law 09-08:** PHI handling compliant with national data protection law
- **CNDP Registration:** Status tracked in `docs/compliance/cndp.md`
- **GDPR:** Data portability (export API), right to erasure (GDPR purge cron), consent management
- **EU AI Act:** AI-generated content labelling, prohibited-use assessment

## 8. Policy Review

This policy shall be reviewed:

- At least annually
- After any significant security incident
- When material changes are made to the platform architecture

## 9. Exceptions

Any exception to this policy must be documented, risk-assessed, and approved by the Security Lead before implementation.

---

**Approval:**

| Name | Role | Date | Signature |
|---|---|---|---|
| ___________________ | CTO | __________ | __________ |
| ___________________ | Security Lead | __________ | __________ |
