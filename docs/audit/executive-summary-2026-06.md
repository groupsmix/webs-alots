# Executive Summary — Repo-Grounded Audit

> Date: 2026-06-14  
> Scope: Repository evidence only (`webs-alots`)

## Bottom line

Oltigo Health has **strong security and tenancy foundations** for a multi-tenant healthcare SaaS. The codebase shows deliberate design around tenant isolation, PHI handling, audit logging, and CI supply-chain security. The most important repo-visible risks are **deployment/runtime complexity around OpenNext + Cloudflare Workers**, **low committed coverage floors**, **incomplete queue-consumer wiring with cron fallback**, and **continued dependence on correct operator-side configuration for critical runtime controls**.

## What is strong

- **Tenant isolation is explicit and central**
  - Evidence: `AGENTS.md`, `src/middleware.ts`, `src/lib/supabase-server.ts`
- **PHI/security posture is mature in design**
  - Evidence: encryption, audit-log, middleware, env validation, webhook verification paths
- **Incident response and SLO practices are documented**
  - Evidence: `docs/oncall.md`, `docs/incident-response.md`, `docs/post-mortem-template.md`
- **Supply-chain controls are stronger than a basic CI setup**
  - Evidence: `.github/workflows/ci.yml`, `.github/CODEOWNERS`
  - Includes SBOM, signing, provenance, CodeQL, Gitleaks, Semgrep

## What needs attention

### 1. Deployment/runtime complexity

- Evidence: `wrangler.toml`, `package.json`, `.github/workflows/deploy.yml`
- Queue consumer and Durable Object wiring remain deferred due to OpenNext export limitations.
- This is the clearest repo-visible reliability hotspot.

### 2. Coverage gap

- Evidence: `docs/audit/baseline.md`, `.vitest-coverage-floor.json`
- Current floors remain far below project targets.
- This is a real regression and governance risk for healthcare-critical paths.

### 3. Notification architecture incomplete

- Evidence: `wrangler.toml`
- Queue producer is configured, but queue consumer remains deferred.
- Cron fallback remains part of the current delivery model.

### 4. Runtime controls still depend on operator correctness

- Evidence: `wrangler.toml`, env handling, runbooks, health checks
- Important controls depend on secrets, Cloudflare resource bindings, environment separation, and external alert configuration.

## Important corrections to earlier audit language

Use these positions going forward:

- **SLOs are documented**; runtime enforcement is not fully verifiable from the repo.
- **Connection pooling support exists in code**; remaining risk is configuration and scale validation.
- **Backup and restore workflows exist**; recurring successful execution is not evidenced in repo alone.
- **PR build-preview validation exists**; live ephemeral runtime previews are not confirmed.
- **CI includes SBOM generation, signing, and provenance attestation**.

## Recommended next steps

### Immediate

1. Reduce OpenNext/Workers deployment fragility.
2. Raise coverage on healthcare/security-critical paths.
3. Finish queue-consumer architecture or formally accept cron fallback as an interim tradeoff.
4. Produce operator evidence for alert routing, backup/restore execution, and environment separation.

### Near term

1. Burst/load test the pooled Supabase path.
2. Build an enterprise/compliance evidence pack from existing controls and external runtime proof.
3. Reduce dependence on undocumented external platform state.

## Canonical detailed audit

For the full repo-grounded version, see:

- `docs/audit/repo-grounded-operational-audit-2026-06.md`
