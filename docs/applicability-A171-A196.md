# Applicability Audit: A171-A196

> **Source:** Security audit April 2026
> **Project:** Oltigo Health (groupsmix/webs-alots)
> **Last updated:** April 2026

## Project Profile

Multi-tenant healthcare SaaS (Next.js 16 + Supabase + Cloudflare Workers + R2).
Handles PHI under Moroccan Law 09-08 / CNDP. Serves doctors, dentists,
pharmacies in Morocco. Closed-source / private. Uses WhatsApp, Twilio,
Stripe/CMI, Sentry, Plausible, OpenAI, Resend, Meta APIs.

## Legend

| Status | Meaning |
|--------|---------|
| **STRONG** | Already covered well in repo, only minor gaps |
| **PARTIAL** | Partly covered, real work to do |
| **GAP** | Relevant to this project but no prior evidence in repo |
| **N/A** | Does not apply to this project's profile |
| DONE | Addressed in this PR |

---

## Supply-Chain & Vendor (A171-A178)

| ID | Title | Status | Remediation | Document |
|----|-------|--------|-------------|----------|
| A171 | Vendor inventory (criticality, evidence, sub-processors, breach SLA) | PARTIAL -> DONE | Added 4 columns to sub-processor table | [data-residency.md](./data-residency.md) |
| A172 | Tier-1 vendor exit plan | GAP -> DONE | Created exit playbooks for Supabase, Cloudflare, Resend, Meta | [vendor-exit-playbooks.md](./vendor-exit-playbooks.md) |
| A173 | OSS supply chain (typosquat, license drift) | PARTIAL | Socket / OpenSSF Scorecard in CI + license allowlist -- **future PR** | -- |
| A174 | SBOM attached to every release, vuln SLA | PARTIAL -> DONE | Created vuln-sla.md; SBOM-as-release-asset is a CI task -- **future PR** | [vuln-sla.md](./vuln-sla.md) |
| A175 | SLSA L3+ build provenance | PARTIAL | Branch protection rules (>= 1 reviewer, required status checks) -- **manual config** | -- |
| A176 | Code/artifact signing: compromise procedure | PARTIAL -> DONE | Added signing-identity compromise section to SOP | [SOP-SECRET-ROTATION.md](./SOP-SECRET-ROTATION.md) |
| A177 | M&A / acquired code | N/A | No acquired code in this project | -- |
| A178 | OSS outbound (CLA, SPDX headers) | N/A | Closed-source / private repo | -- |

## Workforce / IAM / Endpoint (A179-A186)

| ID | Title | Status | Remediation | Document |
|----|-------|--------|-------------|----------|
| A179 | IAM/SSO, phishing-resistant MFA | GAP -> DONE | Documented SSO requirements, conditional access | [workforce-security.md](./workforce-security.md) Section 1 |
| A180 | Privileged role map (>= 2 humans, no shared accts) | GAP -> DONE | Created role map template with recertification schedule | [workforce-security.md](./workforce-security.md) Section 2 |
| A181 | Break-glass account | GAP -> DONE | Defined break-glass for GitHub, Supabase, Cloudflare | [workforce-security.md](./workforce-security.md) Section 3 |
| A182 | Endpoint security (FDE, MDM, EDR) | GAP -> DONE | Documented requirements and MDM options | [workforce-security.md](./workforce-security.md) Section 4 |
| A183 | JML processes (joiner/mover/leaver) | GAP -> DONE | Created onboarding, role-change, offboarding checklists | [workforce-security.md](./workforce-security.md) Section 5 |
| A184 | Insider-risk telemetry / UEBA | PARTIAL -> DONE | Documented operator-level alert signals | [workforce-security.md](./workforce-security.md) Section 6 |
| A185 | Shadow IT discovery | GAP -> DONE | Documented semi-annual finance review approach | [workforce-security.md](./workforce-security.md) Section 6 |
| A186 | Workforce training | GAP -> DONE | Defined training matrix, phishing sim, record-keeping | [workforce-security.md](./workforce-security.md) Section 7 |

## Incident Response & Resilience (A187-A196)

| ID | Title | Status | Remediation | Document |
|----|-------|--------|-------------|----------|
| A187 | IR plan: comms templates, legal hold, chain of custody | PARTIAL -> DONE | Created comms templates, legal hold notice, CoC log | [comms-templates/README.md](./comms-templates/README.md) |
| A188 | Log retention/immutability, SIEM, MTTD/MTTR | PARTIAL -> DONE | Documented WORM archive plan, retention schedule, metrics | [log-retention.md](./log-retention.md) |
| A189 | Tabletop exercises quarterly | GAP -> DONE | Created scenario library and exercise template | [tabletop/README.md](./tabletop/README.md) |
| A190 | Breach notification readiness (CNDP, GDPR) | PARTIAL -> DONE | Created CNDP + GDPR + data-subject notification templates | [compliance/breach-notification-templates.md](./compliance/breach-notification-templates.md) |
| A191 | DR plan: failback, multi-region | PARTIAL -> DONE | Added failback procedure and multi-region risk acceptance | [backup-recovery-runbook.md](./backup-recovery-runbook.md) Section 9 |
| A192 | BCP (business continuity) | GAP -> DONE | Created BCP with vendor concentration analysis | [bcp.md](./bcp.md) |
| A193 | Forensic readiness | PARTIAL -> DONE | Documented evidence sources, correlation IDs, collection procedures | [forensic-readiness.md](./forensic-readiness.md) |
| A194 | VDP/bug-bounty: security.txt, safe harbor | PARTIAL -> DONE | Created security.txt, added safe harbor to SECURITY.md | [public/.well-known/security.txt](../public/.well-known/security.txt), [SECURITY.md](../SECURITY.md) |
| A195 | _Not assigned in this audit_ | -- | -- | -- |
| A196 | _Not assigned in this audit_ | -- | -- | -- |

## DNS & Email Security (A144-A151)

| ID | Title | Status | Remediation | Document |
|----|-------|--------|-------------|----------|
| A144-A150 | DMARC, SPF, CAA, MTA-STS, TLS-RPT, BIMI | GAP -> DONE | Copy-paste DNS records documented | [dns-email-security.md](./dns-email-security.md) |
| A151-F6 | Reporting mailboxes unverified | GAP -> DONE | Mailbox verification checklist created | [dns-email-security.md](./dns-email-security.md) Section 1 |
| -- | MTA-STS policy file | GAP -> DONE | Policy file created at .well-known path | [public/.well-known/mta-sts.txt](../public/.well-known/mta-sts.txt) |

---

## Remaining Work (Future PRs)

Items that require infrastructure changes, CI modifications, or manual
configuration rather than documentation:

1. **A173:** Add Socket or OpenSSF Scorecard to CI pipeline; add license allowlist check
2. **A174:** Attach SBOM as release artifact in `deploy.yml`
3. **A175:** Configure GitHub branch protection (>= 1 reviewer from CODEOWNERS, required status checks, no force pushes)
4. **A188:** Create R2 bucket with Object Lock; add nightly audit-log export to `backup.yml`
5. **A193:** Propagate `request_id` through audit log metadata and Sentry tags
6. **DNS:** Apply the DNS records from `docs/dns-email-security.md` in Cloudflare Dashboard
7. **Mailboxes:** Create and verify `dmarc@`, `tls-rpt@`, `abuse@`, `postmaster@` mailboxes
