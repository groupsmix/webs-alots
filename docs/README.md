# Documentation Index

This `docs/` directory contains both **living operational documentation** and **historical point-in-time analysis**.

If you are new to the repo, start with the canonical documents below instead of opening old audit snapshots at random.

## Start Here

### Architecture

- `docs/architecture.md` — canonical architecture overview
- `docs/architecture/` — focused architecture maps and guardrails
- `docs/adr/` — architectural decisions and rationale

### Current audit / quality status

- `docs/audit/README.md` — how to read the audit folder
- `docs/audit/CURRENT-STATUS.md` — stable entry point for current audit status
- `docs/audit/executive-summary-2026-06.md` — concise leadership summary
- `docs/audit/repo-grounded-operational-audit-2026-06.md` — detailed repo-grounded audit
- `docs/audit/baseline.md` — frozen historical baseline for cleanup comparisons
- `docs/audit/remediation-tracker-2026-06.md` — tracked remediation work

### Security, compliance, and operations

- `docs/security.md` — security posture overview
- `docs/DPIA.md` — data protection impact assessment
- `docs/compliance/` — regulatory and compliance templates/material
- `docs/incident-response.md` — incident response runbook
- `docs/oncall.md` — on-call process
- `docs/slo.md` — SLOs and error-budget guidance
- `docs/deployment.md` — deployment guidance
- `docs/ENVIRONMENTS.md` — environment layout and expectations
- `docs/launch-signoff.md` — launch readiness/sign-off checklist

### Exercises, templates, and runbooks

- `docs/runbooks/` — focused operational runbooks
- `docs/tabletop/README.md` — tabletop exercise program
- `docs/comms-templates/README.md` — incident communications templates
- `docs/post-mortem-template.md` — post-incident review template

## Directory Map

| Path                          | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `docs/adr/`                   | Architecture decision records                              |
| `docs/ai/`                    | AI-specific reviews and notes                              |
| `docs/architecture/`          | Living architecture reference docs                         |
| `docs/architecture-analysis/` | Historical one-off architecture analyses                   |
| `docs/audit/`                 | Audit summaries, trackers, baselines, and archived reports |
| `docs/chaos-experiments/`     | Chaos and resilience exercise docs                         |
| `docs/comms-templates/`       | Incident/customer/regulator communication templates        |
| `docs/compliance/`            | Compliance and regulatory documentation                    |
| `docs/qa/`                    | QA plans and related materials                             |
| `docs/runbooks/`              | Operational procedures                                     |
| `docs/security/`              | Security-specific supporting docs                          |
| `docs/tabletop/`              | Tabletop exercise program and scenarios                    |

## Reading Rules

1. Prefer **living docs** over point-in-time snapshots.
2. Treat `docs/audit/archive/` and `docs/architecture-analysis/` as **historical context**, not the current source of truth.
3. For current repo health, trust recent CI/build/test results and the canonical audit docs above rather than older “production-ready” declarations.
