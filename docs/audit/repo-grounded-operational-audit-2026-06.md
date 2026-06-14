# Repo-Grounded Operational Audit

> Date: 2026-06-14  
> Scope: Evidence visible in the `webs-alots` repository only  
> Purpose: Replace broad or overstated audit claims with a repo-grounded view that distinguishes confirmed facts from runtime/operator assumptions.

---

## Executive Summary

Oltigo Health shows strong architectural intent for a multi-tenant healthcare SaaS: tenant isolation is explicit, security controls are well represented in code and docs, and CI/CD has meaningful supply-chain safeguards. The largest repo-visible risks are not architectural novelty but operational fragility and verification gaps:

1. **Deployment/runtime complexity remains high** due to the OpenNext + Cloudflare Workers integration.
2. **Test coverage floors remain low** relative to the repo's stated targets.
3. **Several critical controls depend on operator configuration** rather than being fully self-proving in code.
4. **Observability and incident readiness are documented**, but runtime enforcement and dashboard completeness cannot be proven from the repo alone.

Bottom line: the codebase looks more mature than a “no operational rigor” assessment suggests, but production confidence still depends heavily on correct environment setup, external platform configuration, and continued hardening.

---

## Methodology

Each claim below is classified as one of:

- **Confirmed in repo** — directly supported by code, config, tests, or docs.
- **Documented but runtime-unverified** — described in repo, but actual deployment/alert state lives outside Git.
- **Not evident in repo** — no supporting evidence found here.
- **Inference** — reasonable interpretation, but not directly provable from repository contents.

---

## Confirmed Findings

### 1. Multi-tenant isolation is a first-class architectural rule

**Evidence**
- `AGENTS.md`
- `src/middleware.ts`
- `src/lib/supabase-server.ts`

**Details**
- The repo explicitly requires `clinic_id` scoping.
- Middleware strips inbound tenant headers and re-derives tenant context server-side.
- Tenant-aware Supabase access is centralized and guarded.

**Assessment**
- This is one of the strongest parts of the system.

### 2. Deployment complexity is real and explicitly documented

**Evidence**
- `wrangler.toml`
- `package.json`
- `.github/workflows/deploy.yml`

**Details**
- The Worker deployment path depends on OpenNext build output and post-build patching.
- `wrangler.toml` documents deferred Durable Object and Queue consumer wiring because OpenNext does not re-export those handlers/classes cleanly.
- Deploy comments describe real failure modes rather than hypothetical ones.

**Assessment**
- This is a genuine operational complexity risk.

### 3. Coverage is currently low versus project targets

**Evidence**
- `docs/audit/baseline.md`
- `.vitest-coverage-floor.json`

**Details**
- Floor file currently shows low baseline values.
- The project documents much higher long-term targets.

**Assessment**
- This remains a justified concern, especially for healthcare/security-sensitive paths.

### 4. Connection pooler support exists in application code

**Evidence**
- `src/lib/env.ts`
- `src/lib/supabase-server.ts`
- `src/lib/connection-pooling.ts`
- `src/app/api/health/internal/route.ts`

**Details**
- Server-side Supabase client creation prefers `SUPABASE_POOLER_URL`.
- Pooler verification is surfaced in the internal health route.
- The getter now normalizes empty/whitespace values to avoid invalid fallback behavior.

**Assessment**
- “Connection pooling not implemented” is no longer accurate.
- The remaining risk is operational configuration and capacity, not absence of code support.

### 5. SLO/error-budget concepts are documented

**Evidence**
- `docs/oncall.md`
- linked `docs/slo.md`

**Details**
- On-call docs reference error-budget burn alerts and latency thresholds.
- Runbooks connect alerts to operational actions.

**Assessment**
- “No SLOs/error budgets defined” is inaccurate.
- The correct concern is runtime verification of those alerts.

### 6. Incident response and postmortem processes are documented

**Evidence**
- `docs/incident-response.md`
- `docs/post-mortem-template.md`
- `docs/oncall.md`

**Assessment**
- “No incident response process” is inaccurate.
- What remains unknown is drill cadence and operational adherence.

### 7. Backup and restore workflows exist in CI

**Evidence**
- `.github/workflows/backup.yml`
- `.github/workflows/restore-test.yml`

**Details**
- Scheduled encrypted backups to R2 are defined.
- A monthly restore drill workflow is defined.

**Assessment**
- “No backup verification / restore testing” is overstated.
- Actual success history is not visible from repo alone.

### 8. Supply-chain controls are stronger than a basic npm-audit setup

**Evidence**
- `.github/workflows/ci.yml`
- `.github/CODEOWNERS`
- `.gitleaks.toml`

**Details**
- CI runs npm audit, CodeQL, Gitleaks, Semgrep.
- CI generates a CycloneDX SBOM.
- CI signs the SBOM with cosign and records build provenance.
- CODEOWNERS protects critical paths.

**Assessment**
- “No SBOM / no provenance / no signing” is false for this repo.

---

## Documented but Runtime-Unverified

These controls appear in the repository, but actual runtime state cannot be fully validated here.

### 9. Branch protection and required checks

**Evidence**
- `.github/CODEOWNERS`
- docs mentioning branch protection and required checks

**Assessment**
- Likely intended and probably configured, but GitHub repo settings are external.

### 10. Monitoring dashboards and alert routing

**Evidence**
- `docs/oncall.md`
- `docs/incident-response.md`
- Sentry config files

**Assessment**
- The expected operating model is documented.
- Dashboard completeness, alert tuning, and delivery paths need external verification.

### 11. Staging/production environment separation

**Evidence**
- `wrangler.toml`
- `deploy.yml`
- README deployment notes

**Assessment**
- The repo shows strong intent to separate environments.
- Secret values, Cloudflare bindings, and Workers Build settings are external.

### 12. Preview validation exists, but live ephemeral envs are not confirmed

**Evidence**
- `.github/workflows/pr-preview.yml`

**Assessment**
- PRs have a build-preview workflow.
- This is not the same as a live per-PR application environment.

---

## Not Evident in Repo

These may exist operationally, but were not verifiable from repository contents.

- Recent penetration test results
- Third-party SOC 2 / ISO audit reports
- Real incident history and postmortems from production
- Capacity-planning reports
- Cost dashboards / billing alerts
- Cloudflare dashboard rule state (WAF/Bot Management/live rate-limit settings)
- PagerDuty service configuration and escalation policy state

---

## High-Value Risks Still Worth Carrying Forward

### A. OpenNext/Workers integration remains a reliability hotspot

This is the clearest repo-visible platform risk because it already forced deferred infrastructure bindings and patch scripts.

### B. Low coverage remains a governance risk

Even with many tests in the tree, the committed coverage floor shows the baseline is still far below target.

### C. Operator-side configuration is part of the control plane

Several important protections depend on correct secret/config setup:
- `SUPABASE_POOLER_URL`
- production/staging binding separation
- secret rotation acknowledgements
- geo restriction flags
- Cloudflare resources referenced by `wrangler.toml`

### D. Queue-driven notification architecture is incomplete

`wrangler.toml` shows producer-side queueing, but consumer-side processing remains deferred, leaving cron fallback in place.

---

## Recommended Wording Adjustments for Future Audits

Use these formulations to stay precise:

- Prefer **“not evident in repo”** over **“does not exist”** for external systems.
- Prefer **“documented but runtime-unverified”** over **“missing”** when a runbook or workflow exists.
- Prefer **“operator-side risk”** over **“not implemented”** when code support exists but correct deployment is required.

Examples:

- Instead of: “No SLOs defined”  
  Use: “SLO/error-budget concepts are documented; runtime alert enforcement is unverified.”

- Instead of: “No SBOM/provenance”  
  Use: “CI generates SBOM and provenance artifacts; downstream verification/enforcement should be checked.”

- Instead of: “No backup verification”  
  Use: “Backup and restore workflows are defined, but successful recurring execution was not verified here.”

---

## Local Validation Notes (2026-06-14)

While validating the new tests in this workspace, Vitest was blocked by a local native dependency failure unrelated to the changed source files:

- Repo pin: `.nvmrc` specifies `22.13.0`
- Actual local runtime during validation: `node v24.14.0`, `npm 11.9.0`
- Failing package: `@rolldown/binding-win32-x64-msvc`
- Direct repro: `node -e "require('./node_modules/@rolldown/binding-win32-x64-msvc')"`
- Error: `rolldown-binding.win32-x64-msvc.node is not a valid Win32 application`

This strongly suggests a local Node/native-binary compatibility issue (or corrupt optional dependency install) rather than an application-code regression. The most likely successful remediation path is:

1. switch the shell/runtime to Node `22.13.0`
2. remove `node_modules`
3. run a clean `npm install`
4. rerun the Vitest command

## Current Repo-Grounded Conclusion

This repository supports a stronger conclusion than “architecturally good, operationally immature across the board.” A more accurate summary is:

> Oltigo Health has strong security and tenancy foundations, meaningful CI supply-chain controls, and documented incident/SLO processes. Its main repo-visible weaknesses are low coverage floors, high deployment complexity around OpenNext/Workers, incomplete queue-consumer wiring, and continued dependence on correct operator-side configuration for several critical runtime controls.

That is still a serious operational agenda, but it is narrower and more defensible than the original broad assessment.
