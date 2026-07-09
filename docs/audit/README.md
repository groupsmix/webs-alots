# Audit Documentation Guide

This folder mixes three kinds of material:

1. **Canonical current guidance**
2. **Historical baselines and trackers**
3. **Archived point-in-time audit snapshots**

The main cleanup goal is to stop contradictory audit reports from competing as if they are all current.

## Canonical Documents

Use these first:

- `docs/audit/CURRENT-STATUS.md`
  - Stable entry point for the current audit position.
- `docs/audit/executive-summary-2026-06.md`
  - Short, leadership-friendly summary.
- `docs/audit/repo-grounded-operational-audit-2026-06.md`
  - Detailed audit grounded in repository-visible evidence.
- `docs/audit/baseline.md`
  - Frozen historical baseline for comparing cleanup progress.
- `docs/audit/remediation-tracker-2026-06.md`
  - Remediation tracking.
- `docs/audit/open-actions.md`
  - Active findings and follow-up work.

## Historical / Archived Reports

Archived full-text snapshots now live under:

- `docs/audit/archive/2026-06/`

These are retained for provenance and comparison, but they may contain:

- superseded counts
- outdated “production-ready” claims
- point-in-time sprint status
- language that overstates what can be proven from the repository alone

## How To Interpret Audit Material

- Treat **current CI/build/test results** as the first indicator of repo health.
- Treat **repo-grounded audits** as stronger than broad summary narratives.
- Treat **historical snapshots** as evidence of how understanding evolved, not as the current truth.

## Superseded Files

The following top-level files in this folder now act as short redirects to archived copies because they were redundant, preliminary, or conflicting:

- `COMPREHENSIVE-TECHNICAL-AUDIT-2026.md`
- `COMPREHENSIVE-END-TO-END-AUDIT-2026-06.md`
- `COMPREHENSIVE-AUDIT-VERIFICATION-2026.md`
- `FINAL-AUDIT-STATUS-2026-06-14.md`
- `ULTIMATE-AUDIT-2026-06-14-SUMMARY.md`
- `FIX-VERIFICATION-2026-06-14.md`
- `FIX-VERIFICATION-2026-06-14-UPDATE.md`
- `REMAINING-AUDIT-FINDINGS-2026-06.md`
- `REMAINING-TASKS-TO-FIX.md`
- `K6-repord.md`
- `audit_report.md`
