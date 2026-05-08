# Endpoint Decommission Policy
## Finding F-A182

> **Version:** 1.0 | **Owner:** Engineering + CISO | **Review:** Quarterly

---

## Purpose

This policy defines the process for safely decommissioning API endpoints, features, and service integrations. Endpoints that are orphaned (no callers, no documentation) create security risk — they may bypass authentication, contain unpatched vulnerabilities, or expose PHI.

---

## Endpoint Inventory

All active API endpoints are catalogued in:
- `src/app/api/**` — Next.js App Router routes
- `docs/api-catalogue.md` — human-readable API catalogue (maintained by Engineering)

Run the inventory script quarterly:
```bash
npm run audit:endpoints
```

---

## Decommission Trigger Conditions

An endpoint must enter the decommission process if **any** of the following:

- Zero authenticated callers in the past 90 days (check Cloudflare Analytics / logs)
- Feature flag permanently disabled in all tenants
- Replaced by a newer version (e.g. `/api/v1/` → `/api/v2/`)
- PHI-touching endpoint whose data category has been deprecated
- Third-party integration (webhook, OAuth partner) whose contract has ended

---

## Decommission Process

### Phase 1 — Announce (D-30)

1. Open a decommission issue in GitHub with label `decommission`.
2. Document: endpoint URL, purpose, last known callers, planned removal date.
3. Add a `Deprecation` response header to the endpoint:
   ```
   Deprecation: true
   Sunset: <RFC 7231 date>
   Link: <https://oltigo.com/changelog#endpoint-removed>; rel="deprecation"
   ```
4. Notify any known API key holders via email (check `clinics.config.api_key_hash`).
5. If the endpoint is public, publish in the changelog and developer newsletter.

### Phase 2 — Disable (D-7)

1. Return `HTTP 410 Gone` instead of `HTTP 404` for all requests.
2. Log every 410 response with the caller's clinic_id for 7 days.
3. Monitor for unexpected callers — delay removal if active calls found.

### Phase 3 — Remove (D-0)

1. Delete the route file from `src/app/api/`.
2. Remove from middleware matchers if applicable.
3. Update `docs/api-catalogue.md`.
4. Close the GitHub decommission issue.
5. File in `docs/audit/decommissioned-endpoints.md`:

```
| endpoint | removed_date | reason | removed_by | pr_link |
```

---

## Emergency Decommission (Security Incident)

If an endpoint must be removed immediately due to a vulnerability:

1. Add a runtime guard at the top of the handler:
   ```typescript
   if (process.env.DISABLE_ENDPOINT_XYZ === "true") {
     return apiError("This endpoint is temporarily disabled", 503, "MAINTENANCE");
   }
   ```
2. Set `DISABLE_ENDPOINT_XYZ=true` in Cloudflare Workers env (takes effect without redeploy).
3. File a GitHub issue tracking the permanent removal within 72 hours.

---

## Orphaned Endpoint Audit

Run quarterly via CI:
```bash
# lists routes with no corresponding test coverage and no caller in last 90 days
npm run audit:orphaned-endpoints
```

Results filed in `docs/audit/orphaned-endpoints-YYYY-QN.md`.
