# Joiner / Mover / Leaver (JML) Checklist (A249)

Procedure for granting, modifying, and revoking access when team members join,
change roles, or leave the organization.

---

## Joiner (New Team Member)

### Day 1

- [ ] Create GitHub account invite to `groupsmix` org with appropriate team membership
- [ ] Grant Supabase project access (role: read-only by default; write access per approval)
- [ ] Grant Cloudflare account access (role: per job function)
- [ ] Create 1Password vault access (team-specific vault only)
- [ ] Issue VPN / ZeroTrust credentials (if applicable)
- [ ] Add to on-call rotation (if applicable) — update `docs/oncall.md`
- [ ] Conduct security onboarding briefing:
  - PHI handling rules (Law 09-08, GDPR)
  - Incident reporting procedure (`docs/incident-response.md`)
  - Acceptable use of AI tools with patient data
  - Password policy (min 12 chars, no known-breached passwords)

### Day 7

- [ ] Verify MFA is enabled on all accounts (GitHub, Supabase, Cloudflare, 1Password)
- [ ] Confirm access is scoped to minimum necessary (principle of least privilege)

---

## Mover (Role Change)

- [ ] Review current access against new role requirements
- [ ] Revoke access no longer needed for new role
- [ ] Grant any additional access required for new role
- [ ] Update team membership in GitHub org
- [ ] Update on-call rotation if applicable
- [ ] Document changes in the quarterly access review log

---

## Leaver (Offboarding)

### Within 4 hours of departure notification

- [ ] Revoke GitHub org membership (removes all repo access)
- [ ] Revoke Supabase project access
- [ ] Revoke Cloudflare account access
- [ ] Revoke 1Password vault access + deauthorize devices
- [ ] Revoke VPN / ZeroTrust credentials
- [ ] Rotate any shared secrets the leaver had access to:
  - [ ] CRON_SECRET (if applicable)
  - [ ] PROFILE_HEADER_HMAC_KEY (if applicable)
  - [ ] Any API keys the leaver personally created
- [ ] Remove from on-call rotation — update `docs/oncall.md`
- [ ] Remove from Slack channels (security, incident, on-call)
- [ ] Disable email forwarding / aliases

### Within 24 hours

- [ ] Audit recent activity logs for the leaver's user ID
- [ ] Verify no unauthorized data exports occurred
- [ ] Document the offboarding in the quarterly access review log

---

## Quarterly Access Review

Every quarter, the security lead must:

1. Export the list of users with access to each system (GitHub, Supabase, Cloudflare, 1Password)
2. Compare against the current team roster
3. Revoke any stale or over-privileged access
4. Document findings in `docs/audit/access-reviews/YYYY-QN.md`
5. File the review with the DPO for CNDP compliance records

---

## Contacts

| Role | Responsibility |
|------|---------------|
| Engineering Lead | GitHub + Supabase access |
| DevOps Lead | Cloudflare + infrastructure access |
| Security Lead | Quarterly review, secret rotation |
| HR | Departure notification trigger |
