# Joiner-Mover-Leaver (JML) Policy
## Finding F-A183

> **Version:** 1.0 | **Owner:** People-Ops + CISO | **Review:** Annually

---

## Purpose

This policy defines the access lifecycle process for all Oltigo Health employees, contractors, and third-party service providers. JML stands for **Joiner** (new hire), **Mover** (role change), **Leaver** (departure).

---

## 1. Joiner Process

### Trigger: Employee contract signed / contractor engagement confirmed

**IT/DevOps (complete within 1 business day):**

- [ ] Create user in IdP (Google Workspace / Okta)
- [ ] Assign to appropriate security group (role-based)
- [ ] Enforce WebAuthn / hardware MFA enrollment before first login
- [ ] Grant access to Supabase dashboard at minimum required privilege
- [ ] Add to `CODEOWNERS` if engineering role
- [ ] Grant R2 / Cloudflare access with minimum necessary scopes
- [ ] Provision Sentry access (viewer or member, not admin)

**People-Ops (complete before first day):**

- [ ] Sign Information Security Policy acknowledgement
- [ ] Complete HIPAA/Law 09-08 PHI handling training (async course)
- [ ] Complete phishing awareness onboarding module
- [ ] Brief on clean desk / screen lock policy

**Engineering Manager (first week):**

- [ ] Pair new engineer with senior for first PR review
- [ ] Walk through `AGENTS.md` and security conventions
- [ ] Verify no access beyond role (principle of least privilege)

---

## 2. Mover Process

### Trigger: Role change (promotion, lateral move, team transfer)

**IT/DevOps (complete on effective date):**

- [ ] Revoke old role's group memberships
- [ ] Grant new role's group memberships
- [ ] Review and update Supabase user role (super_admin / clinic_admin / etc.)
- [ ] Update CODEOWNERS if applicable
- [ ] Review and revoke any elevated access granted for previous role

**Manager review:**

- [ ] Confirm new access is appropriate (no accumulation of privileges)
- [ ] If moving from engineering to non-engineering: revoke Supabase / R2 / GitHub access
- [ ] Log in `docs/audit/access-reviews.md`

---

## 3. Leaver Process

### Trigger: Resignation / termination / contract end

> ⚠️ Involuntary terminations: IT must be notified **before** the employee is told.

**Day of departure (IT/DevOps — within 1 hour for involuntary):**

- [ ] Disable IdP account (Google Workspace / Okta)
- [ ] Revoke all active sessions (force sign-out)
- [ ] Revoke API keys / personal access tokens in GitHub, Cloudflare, Supabase
- [ ] Remove from all security groups
- [ ] Rotate any shared secrets the person had access to
- [ ] Suspend hardware MFA device registration

**Within 24 hours:**

- [ ] Transfer ownership of any GitHub repos / Cloudflare zones
- [ ] Archive or reassign email/Slack (retain for legal hold if applicable)
- [ ] Remove from `CODEOWNERS`
- [ ] Remove from Sentry, Linear, Notion, etc.
- [ ] Update on-call rotation

**Within 7 days:**

- [ ] Final access review: confirm no lingering permissions
- [ ] Return equipment (laptop, YubiKey, access card)
- [ ] Sign separation agreement / NDA reaffirmation if required
- [ ] Log completion in `docs/audit/offboarding-log.csv`

---

## 4. Privileged Access (Break-Glass)

For super_admin accounts and production database access:

- Minimum 2 named individuals must hold each privileged role
- See `docs/break-glass.md` for the sealed envelope procedure
- Access is reviewed quarterly

---

## 5. Third-Party Access

- All contractors must complete onboarding steps (items above applicable to their scope)
- Access is time-bounded: set an IdP expiry date matching contract end
- No contractor receives production `service_role` key without CISO approval

---

## 6. Audit & Review

- JML log: `docs/audit/access-reviews.md`
- Access is reviewed quarterly against active HR roster
- Annual comprehensive access review (see `docs/iam-policy.md`)
