# Quarterly Access Review Template
## Finding F-A184

> **Version:** 1.0 | **Owner:** CISO + Engineering Lead | **Cadence:** Quarterly (Jan/Apr/Jul/Oct)  
> **Required by:** Moroccan Law 09-08, ISO 27001 A.9.2.5, SOC 2 CC6.3

---

## Access Review: Q[N] [YEAR]

| Field | Value |
|---|---|
| Review period | YYYY-MM-DD to YYYY-MM-DD |
| Reviewer | Name |
| Date completed | YYYY-MM-DD |
| Next review due | YYYY-MM-DD |

---

## Scope

This review covers ALL privileged and production access, including:

- [ ] Supabase dashboard (project-level access)
- [ ] Cloudflare dashboard (zone + Workers + R2)
- [ ] GitHub repository access + CODEOWNERS
- [ ] Sentry (admin vs. member)
- [ ] Stripe (restricted key vs. full access)
- [ ] Resend / Twilio API key holders
- [ ] Google Workspace / IdP group memberships
- [ ] Break-glass credential custodians (`docs/break-glass.md`)

---

## 1. Active Employees vs. HR Roster

| Employee | Role | System Access | Appropriate? | Action |
|---|---|---|---|---|
| Name | Engineer | GitHub: write, CF: edit | ✅ Yes | — |
| Name | Contractor | Supabase: viewer | ✅ Yes | Verify contract end date |
| Name | _Left 2025-03_ | GitHub: still active | ❌ No | Revoke immediately |

**Instructions:** Export user list from each system; cross-reference against current HR roster. Flag any access for users who have left or changed roles.

---

## 2. Principle of Least Privilege Check

For each active user, verify they do not have more access than their role requires:

| User | Role | Has | Needs | Delta |
|---|---|---|---|---|
| | | | | |

**Common over-provisioning patterns to check:**
- Developers with Supabase `service_role` key access
- Contractors with production write access
- Former clinic_admins still holding `super_admin` in DB

---

## 3. Privileged Accounts (super_admin, CF Super Admin, GitHub Admin)

List all holders of each privileged account and verify legitimacy:

| System | Account | Holder | Business Justification | MFA Active? |
|---|---|---|---|---|
| Supabase | service_role | | | |
| Cloudflare | Super Administrator | | | |
| GitHub | Admin | | | |
| Stripe | Full access | | | |

---

## 4. Dormant Accounts

Accounts with no login in the past 90 days must be reviewed:

```bash
# Extract last-login from Google Workspace Admin SDK
# Look for users with last_login_time > 90 days ago
```

| Account | Last Login | Status | Action |
|---|---|---|---|
| | | Active / Dormant | Disable / Keep |

**Policy:** Accounts dormant for 90+ days are disabled; dormant for 180+ days are deleted.

---

## 5. Service Accounts & API Keys

| Key/Token | System | Owner | Last Rotated | Expiry | Action |
|---|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | — | | 1 year | Rotate if >6 months |
| `CF_API_TOKEN` | Cloudflare | | | | |
| `STRIPE_SECRET_KEY` | Stripe | | | | |
| `OPENAI_API_KEY` | OpenAI | | | | |

Rotation SLAs: see `docs/SOP-SECRET-ROTATION.md`.

---

## 6. Break-Glass Custodians

Verify the break-glass custodians listed in `docs/break-glass.md` are still current employees:

| Role | Current Custodian | Still Employed? | Action |
|---|---|---|---|
| Primary | | | |
| Secondary | | | |

---

## 7. Action Items

| # | Finding | Owner | Due Date | Status |
|---|---|---|---|---|
| 1 | | | | Open |

---

## 8. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| CISO | | | |
| Engineering Lead | | | |
| People-Ops | | | |

---

## Filing

Save completed reviews as:  
`docs/audit/access-reviews/access-review-[YEAR]-Q[N].md`
