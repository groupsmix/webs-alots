# Emergency Change (P1 Hotfix) Policy

**Document ID:** ISMS-POL-007
**Version:** 1.0
**Status:** DRAFT
**Last Updated:** 2026-04-30
**Owner:** Engineering Lead
**ISO 27001 Reference:** A.8.32 — Change management

---

## 1. Purpose

This policy defines the process for deploying emergency changes (P1 hotfixes) to production when the standard PR review and CI pipeline cannot be followed within the required timeframe.

## 2. Scope

An **emergency change** is a code or configuration change that must be deployed to production within **2 hours** to address:

- Active security vulnerabilities being exploited
- Complete service outages affecting patient care
- Data integrity issues risking PHI exposure
- Regulatory compliance violations requiring immediate remediation

## 3. Authorisation

Emergency changes require verbal or written approval from **at least one** of:

- CTO
- Engineering Lead
- On-call incident commander (per `docs/oncall.md`)

## 4. Process

### 4.1 Declaration

1. Engineer declares an emergency change in the incident Slack channel
2. State the reason, affected systems, and estimated fix
3. Receive verbal approval from an authorised approver

### 4.2 Implementation

1. Create a branch from `main`: `hotfix/<description>`
2. Implement the minimal fix required — no feature work
3. Run the critical subset of checks:
   - `npx tsc --noEmit` (type safety)
   - `npm run test` (unit tests)
   - Manual smoke test of the affected flow
4. Create a PR with the `[EMERGENCY]` prefix in the title
5. **One reviewer** approves (reduced from the standard two)
6. Merge and deploy

### 4.3 Post-Deployment

1. Monitor Sentry and health checks for 30 minutes
2. Confirm the issue is resolved in the incident channel

### 4.4 Retrospective (within 48 hours)

1. Create a post-incident review document
2. Add any missing test coverage for the bug
3. If any CI checks were skipped, run the full pipeline and fix any failures
4. Update `CHANGELOG.md` with the hotfix entry
5. Review whether the emergency process was followed correctly

## 5. Audit Trail

All emergency changes must be logged in the incident tracking system with:

- Date and time of the change
- Approver name
- Reason for emergency classification
- PR link
- Post-incident review link

## 6. Limits

- Maximum **3 emergency changes per calendar month**. If exceeded, the standard change process must be reviewed for bottlenecks
- Emergency changes that affect tenant isolation or PHI encryption **always** require CTO approval regardless of time pressure
- No emergency change may disable RLS policies, authentication, or audit logging

---

**Approval:**

| Name | Role | Date | Signature |
|---|---|---|---|
| ___________________ | Engineering Lead | __________ | __________ |
| ___________________ | CTO | __________ | __________ |
