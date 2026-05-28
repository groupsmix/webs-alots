# Quarterly Access Review Template

> **Audit finding:** A183 (JML Process) | **Last updated:** May 2026

## Purpose

Quarterly review of all user access to production systems, cloud platforms,
and third-party services. Required by SOC 2 CC6.1, ISO 27001 A.9.2.5,
and CNDP best practices.

## Review Schedule

| Quarter | Due Date   | Reviewer | Status  |
| ------- | ---------- | -------- | ------- |
| Q3 2026 | 2026-07-15 | [CTO]    | Pending |
| Q4 2026 | 2026-10-15 | [CTO]    | Pending |
| Q1 2027 | 2027-01-15 | [CTO]    | Pending |

---

## 1. Cloud Platform Access

### Cloudflare

| User / Email | Role      | Last Active | Action                    |
| ------------ | --------- | ----------- | ------------------------- |
|              | Admin     |             | Keep / Revoke / Downgrade |
|              | Developer |             | Keep / Revoke / Downgrade |

### Supabase

| User / Email | Role      | Last Active | Action                    |
| ------------ | --------- | ----------- | ------------------------- |
|              | Owner     |             | Keep / Revoke / Downgrade |
|              | Developer |             | Keep / Revoke / Downgrade |

### GitHub (groupsmix)

| User / Handle | Role       | Last Active | Action                    |
| ------------- | ---------- | ----------- | ------------------------- |
|               | Owner      |             | Keep / Revoke / Downgrade |
|               | Maintainer |             | Keep / Revoke / Downgrade |

## 2. Application Super-Admin Access

| User | Email | Role         | Clinic(s) | Action        |
| ---- | ----- | ------------ | --------- | ------------- |
|      |       | super_admin  | All       | Keep / Revoke |
|      |       | clinic_admin | [Clinic]  | Keep / Revoke |

### Verification Steps

1. Export super_admin users: `SELECT id, email, role FROM users WHERE role = 'super_admin';`
2. Confirm each super_admin is a current, active team member
3. Verify no orphaned accounts from departed team members

## 3. API Keys & Service Accounts

| Key Name                  | Service    | Last Rotated | Scope          | Action              |
| ------------------------- | ---------- | ------------ | -------------- | ------------------- |
| SUPABASE_SERVICE_ROLE_KEY | Supabase   |              | Full DB        | Rotate if > 90 days |
| OPENAI_API_KEY            | OpenAI     |              | AI features    | Rotate if > 90 days |
| CLOUDFLARE_API_TOKEN      | Cloudflare |              | Workers deploy | Rotate if > 90 days |
| STRIPE_SECRET_KEY         | Stripe     |              | Billing        | Rotate if > 90 days |
| RESEND_API_KEY            | Resend     |              | Email          | Rotate if > 90 days |

## 4. Third-Party Integrations

| Service         | OAuth App / Integration | Permissions      | Action        |
| --------------- | ----------------------- | ---------------- | ------------- |
| Meta (WhatsApp) | WABA                    | Send messages    | Keep / Review |
| Stripe          | Connected account       | Payments         | Keep / Review |
| Sentry          | Project access          | Error monitoring | Keep / Review |

## 5. Departures Since Last Review

| Name | Departure Date | Systems Deprovisioned | Verified By |
| ---- | -------------- | --------------------- | ----------- |
|      |                |                       |             |

## Sign-Off

| Role               | Name | Date | Signature |
| ------------------ | ---- | ---- | --------- |
| Reviewer           |      |      |           |
| Approver (CEO/CTO) |      |      |           |

---

**Note:** This review must be completed within 15 business days of the due
date. Store completed reviews in `docs/compliance/access-reviews/` with
the naming convention `access-review-YYYY-QN.md`.
