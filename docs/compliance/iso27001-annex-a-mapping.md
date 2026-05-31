# ISO 27001:2022 Annex A Control Mapping

**Audit finding:** A67-F1 (🟠 HIGH) — No single document mapping implemented controls
to ISO 27001:2022 Annex A identifiers.

**Status:** First draft — covers all 93 controls in ISO 27001:2022 Annex A.  
Controls are assessed against existing Oltigo Health implementation evidence.

---

## Legend

| Status | Meaning |
|---|---|
| ✅ Implemented | Control implemented with verifiable evidence |
| 🟡 Partial | Control partially implemented or informally |
| 🔴 Gap | Control not implemented; remediation required |
| N/A | Control not applicable to cloud-only SaaS |

---

## 5 — Organizational Controls

| Control | Title | Status | Evidence |
|---|---|---|---|
| 5.1 | Policies for information security | 🟡 Partial | `docs/compliance/information-security-policy.md` — exists but no formal management review record |
| 5.2 | Information security roles and responsibilities | ✅ | `docs/access-control-matrix.md`, CODEOWNERS |
| 5.3 | Segregation of duties | ✅ | 5-role RBAC (super_admin / clinic_admin / doctor / receptionist / patient) |
| 5.4 | Management responsibilities | 🟡 Partial | Implied via CODEOWNERS + PR process; no formal ISMS management meeting minutes |
| 5.5 | Contact with authorities | 🟡 Partial | `docs/compliance/breach-notification-templates.md` covers CNDP + SA notification |
| 5.6 | Contact with special interest groups | N/A | |
| 5.7 | Threat intelligence | 🟡 Partial | Dependabot + semgrep SAST; no formal threat intel feed |
| 5.8 | Information security in project management | 🟡 Partial | `docs/deployment-security-checklist.md`, ADRs |
| 5.9 | Inventory of information and other associated assets | 🟡 Partial | `docs/vendor-inventory.md` — no formal IT asset register |
| 5.10 | Acceptable use of information and assets | 🟡 Partial | `docs/compliance/information-security-policy.md` |
| 5.11 | Return of assets | N/A | Cloud-only; offboarding process in `docs/workforce-security.md` |
| 5.12 | Classification of information | 🟡 Partial | PHI / PII / non-personal classification implicit; no formal scheme |
| 5.13 | Labelling of information | 🔴 Gap | No data labelling scheme implemented |
| 5.14 | Information transfer | ✅ | TLS 1.3 transit, SCCs for cross-border, DPAs signed |
| 5.15 | Access control | ✅ | RLS + RBAC + withAuth middleware — `src/lib/with-auth.ts` |
| 5.16 | Identity management | ✅ | Supabase Auth (GoTrue), TOTP MFA for admins |
| 5.17 | Authentication information | ✅ | HIBP password check (`src/lib/hibp.ts`), bcrypt, no plaintext passwords |
| 5.18 | Access rights | ✅ | `docs/access-review-template.md`, annual access review workflow |
| 5.19 | Information security in supplier relationships | 🟡 Partial | `docs/vendor-inventory.md`, DPAs tracked — no formal SLA monitoring |
| 5.20 | Addressing information security within supplier agreements | ✅ | DPAs signed with all Tier 1/2 processors |
| 5.21 | Managing information security in the ICT supply chain | 🟡 Partial | `docs/vendor-exit-playbooks.md` — no formal SBOM-based supply chain assessment |
| 5.22 | Monitoring, review and change management of supplier services | 🔴 Gap | No SLA monitoring for Tier 1 vendors (see A66-F1) |
| 5.23 | Information security for use of cloud services | ✅ | All PHI in Supabase (eu-west-1), R2 EU jurisdiction, CloudFlare DPAs |
| 5.24 | Information security incident management planning | ✅ | `docs/incident-response.md`, `docs/post-mortem-template.md` |
| 5.25 | Assessment and decision on information security events | 🟡 Partial | Sentry alerting; no formal severity classification matrix |
| 5.26 | Response to information security incidents | ✅ | `docs/incident-response.md` — RACI, runbooks, breach SLAs |
| 5.27 | Learning from information security incidents | 🟡 Partial | `docs/post-mortem-template.md` exists; no incident register |
| 5.28 | Collection of evidence | 🟡 Partial | `docs/forensic-readiness.md` exists; `docs/log-retention.md` |
| 5.29 | Information security during disruption | ✅ | `docs/bcp.md`, `docs/backup-recovery-runbook.md` |
| 5.30 | ICT readiness for business continuity | 🟡 Partial | BCP exists; RTO undefined (see A85-F2) |
| 5.31 | Legal, statutory, regulatory, and contractual requirements | ✅ | Law 09-08, GDPR, PCI DSS, EU AI Act assessed |
| 5.32 | Intellectual property rights | ✅ | `THIRD_PARTY_LICENSES.md`, `scripts/update-licenses.mjs` |
| 5.33 | Protection of records | ✅ | Audit logs (append-only), consent logs (anonymised on deletion) |
| 5.34 | Privacy and protection of PII | ✅ | DPIA, GDPR rights endpoints, Law 09-08 compliance |
| 5.35 | Independent review of information security | 🔴 Gap | No external audit or penetration test completed (see A65-F2) |
| 5.36 | Compliance with policies, rules and standards | 🟡 Partial | CI semgrep, pre-deploy checklist — no internal audit programme |
| 5.37 | Documented operating procedures | 🟡 Partial | Multiple SOPs; not all processes documented |

## 6 — People Controls

| Control | Title | Status | Evidence |
|---|---|---|---|
| 6.1 | Screening | 🟡 Partial | `docs/workforce-security.md` — background check policy exists |
| 6.2 | Terms and conditions of employment | 🟡 Partial | Policy exists; no evidence of signed agreements tracked in repo |
| 6.3 | Information security awareness, education and training | 🔴 Gap | No training completion records |
| 6.4 | Disciplinary process | 🟡 Partial | Referenced in `docs/workforce-security.md` |
| 6.5 | Responsibilities after termination | 🟡 Partial | Offboarding in `docs/workforce-security.md` |
| 6.6 | Confidentiality or non-disclosure agreements | 🟡 Partial | Referenced; no template in repo |
| 6.7 | Remote working | N/A | Cloud-native SaaS; no physical office data |
| 6.8 | Information security event reporting | ✅ | `docs/incident-response.md`, Sentry alerting |

## 7 — Physical Controls

| Control | Title | Status | Evidence |
|---|---|---|---|
| 7.1–7.13 | All physical controls | N/A | Delegated to cloud providers (Cloudflare, AWS). Covered by sub-processor DPAs. |

## 8 — Technological Controls

| Control | Title | Status | Evidence |
|---|---|---|---|
| 8.1 | User endpoint devices | N/A | No managed endpoints; SaaS only |
| 8.2 | Privileged access rights | ✅ | `super_admin` role gated behind MFA (`src/lib/middleware/mfa-enforcement.ts`) |
| 8.3 | Information access restriction | ✅ | RLS + RBAC + tenant isolation |
| 8.4 | Access to source code | ✅ | CODEOWNERS, branch protection, PR reviews |
| 8.5 | Secure authentication | ✅ | TOTP MFA, HIBP check, bcrypt, no plaintext passwords |
| 8.6 | Capacity management | 🟡 Partial | Cloudflare auto-scaling; DB connection pooler; no formal capacity plan |
| 8.7 | Protection against malware | 🟡 Partial | AV scan on file uploads (`AV_SCAN_URL`); no endpoint AV |
| 8.8 | Management of technical vulnerabilities | ✅ | Dependabot, `docs/vuln-sla.md`, semgrep SAST |
| 8.9 | Configuration management | ✅ | `wrangler.toml` IaC, env validation at boot (`src/lib/env.ts`) |
| 8.10 | Information deletion | ✅ | GDPR purge cron, R2 cleanup cron, consent anonymisation |
| 8.11 | Data masking | ✅ | `NEXT_PUBLIC_DATA_MASKING=partial`, `src/lib/mask.ts` |
| 8.12 | Data leakage prevention | 🟡 Partial | Sentry scrubbing, RLS — no dedicated DLP tooling |
| 8.13 | Information backup | 🟡 Partial | `scripts/backup.sh` (nightly pg_dump); PITR not confirmed (see A85-F3) |
| 8.14 | Redundancy of information processing facilities | ✅ | Cloudflare global edge; Supabase high-availability |
| 8.15 | Logging | ✅ | `src/lib/audit-log.ts`, append-only audit tables, Sentry traces |
| 8.16 | Monitoring activities | 🟡 Partial | Sentry + Cloudflare Analytics; SLO burn-rate alerts not deployed (A85-F1) |
| 8.17 | Clock synchronisation | ✅ | Cloudflare Workers use platform time; no NTP drift possible |
| 8.18 | Use of privileged utility programs | N/A | No utility programs outside managed services |
| 8.19 | Installation of software on operational systems | ✅ | Immutable Cloudflare deployments; Workers bundle at build time |
| 8.20 | Networks security | ✅ | TLS 1.3, HSTS, Cloudflare WAF, CSP |
| 8.21 | Security of network services | ✅ | Cloudflare-managed edge; no exposed VMs |
| 8.22 | Segregation of networks | N/A | Serverless; no traditional network segmentation needed |
| 8.23 | Web filtering | N/A | No outbound web browsing from application |
| 8.24 | Use of cryptography | ✅ | AES-256-GCM (R2 PHI), TLS 1.3, HMAC (booking tokens), bcrypt |
| 8.25 | Secure development lifecycle | ✅ | `docs/deployment-security-checklist.md`, semgrep, CODEOWNERS |
| 8.26 | Application security requirements | ✅ | ADRs, security-headers middleware, CSP with nonces |
| 8.27 | Secure system architecture and engineering principles | ✅ | Multi-ADR architecture documentation, defence-in-depth |
| 8.28 | Secure coding | ✅ | semgrep rules (`.semgrep/`), ESLint security rules |
| 8.29 | Security testing in development and acceptance | 🟡 Partial | SAST (semgrep); no DAST or pen test completed (A65-F2) |
| 8.30 | Outsourced development | N/A | In-house development |
| 8.31 | Separation of development, test and production environments | 🟡 Partial | Separate Cloudflare environments; KV namespace isolation pending (A75-F3) |
| 8.32 | Change management | 🟡 Partial | PR process + CODEOWNERS; no formal change advisory board |
| 8.33 | Test information | ✅ | `docs/db-rollback-constraints.md`; seed data separated from production |
| 8.34 | Protection of information systems during audit testing | 🟡 Partial | No formal audit testing procedures |

---

## Gap Summary

| Priority | Control | Gap | Remediation |
|---|---|---|---|
| 🔴 HIGH | 5.13 | No data labelling scheme | Implement label in DPIA + schema |
| 🔴 HIGH | 5.22 | No SLA monitoring for Tier 1 vendors | Calendar reminders + CI check (A66-F1) |
| 🔴 HIGH | 5.35 | No external audit or pen test | Engage QSA / pen tester (A65-F2) |
| 🔴 HIGH | 6.3 | No security training records | LMS or training log |
| 🟡 MED | 5.1 | No management review record | Annual ISP review meeting minutes |
| 🟡 MED | 5.27 | No incident register | Create and maintain incident log |
| 🟡 MED | 8.13 | PITR not confirmed | Confirm Supabase plan + run drill (A85-F3) |
| 🟡 MED | 8.16 | SLO alerts not deployed | Deploy Cloudflare alert rules (A85-F1) |

---

*Next step: engage an ISO 27001 readiness partner to validate this mapping and
produce a formal Statement of Applicability (SoA). Estimated effort: 3-6 months
to Type I readiness.*
