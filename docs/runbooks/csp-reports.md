# CSP Report Review Runbook

> Audience: on-call engineers, security reviewers
> Source of truth: CSP reports are emitted to Sentry and/or the local `/api/csp-report` endpoint depending runtime configuration.

---

## Purpose

Content Security Policy violations are useful only if they are reviewed.
This runbook defines a lightweight review loop so blocked scripts, inline
violations, and suspicious `blocked-uri` spikes do not disappear into logs.

---

## Weekly review procedure

1. Open Sentry and filter issues/events for CSP violations.
2. Group by:
   - `blocked-uri`
   - `document-uri`
   - violated directive
3. Check whether the spike is:
   - expected application drift (false positive)
   - third-party integration drift
   - suspicious or hostile traffic
4. If the violation is legitimate application behavior:
   - fix the application to comply with current CSP, or
   - update CSP intentionally with a documented justification
5. If the violation looks hostile:
   - capture evidence
   - file an incident or security review item
   - consider adding rate limits or WAF rules if traffic is volumetric

---

## What to look for

### Usually benign / expected drift

- newly added third-party origin not yet reflected in policy
- analytics/embed changes
- inline style/script regressions introduced by a frontend change

### Investigate immediately

- repeated `blocked-uri` values pointing to unknown domains
- spikes in `script-src` or `connect-src` violations
- repeated violations on auth, booking, billing, or PHI-bearing routes
- reports that include suspicious query-string payloads or reflected input

---

## Operational notes

- `/api/csp-report` is a public endpoint and should stay small, rate-limited,
  and reviewable.
- Do not copy raw CSP payloads containing sensitive URLs into tickets or chat
  without redaction.
- Prefer linking to Sentry events/issues instead of pasting full request data.

---

## Recommended alerting

Create an alert for either of these patterns:

- sudden spike in CSP violations for the same `blocked-uri`
- sustained CSP violations on `/login`, `/register`, `/booking`, `/billing`, or `/api/*`

Suggested response target:

- triage within 1 business day for low-volume drift
- immediate review for spikes that suggest XSS probing or script injection attempts

---

## Evidence capture

For audits or postmortems, record:

- date reviewed
- reviewer name
- top violating directives
- top blocked origins
- whether action was required
- link to the Sentry search or saved view
