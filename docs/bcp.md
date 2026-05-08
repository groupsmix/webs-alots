# Business Continuity Plan (BCP)

> **Audit finding:** A192 | **Last updated:** April 2026

This plan addresses business-level continuity -- not just technical disaster
recovery (covered in `backup-recovery-runbook.md`). It ensures Oltigo Health
can continue operating if critical infrastructure, vendors, or team members
become unavailable.

---

## 1. Vendor Concentration Analysis

| Vendor | Services Provided | Concentration Risk | Mitigation |
|--------|------------------|-------------------|------------|
| **Cloudflare** | Workers (compute), R2 (storage), KV (cache), CDN, DNS | **HIGH** -- 5 critical services from one vendor | R2 replicated to secondary; DNS exportable; exit playbook documented |
| **Supabase** | PostgreSQL (DB), Auth, RLS | **HIGH** -- core data + auth from one vendor | Nightly pg_dump to R2; exit playbook documented |
| **Meta** | WhatsApp Business API | **MEDIUM** -- primary patient notification | Twilio SMS fallback integrated |
| **Stripe** | International payments | **MEDIUM** -- payment processing | CMI (domestic) as partial fallback |
| **Resend** | Transactional email | **LOW** -- easily replaceable | AWS SES / Postmark as alternatives |
| **GitHub** | Source code, CI/CD, secrets | **MEDIUM** -- all code + automation | Local clones; secrets documented in SOP |
| **Sentry** | Error monitoring | **LOW** -- non-critical | Degrade gracefully; app works without Sentry |

---

## 2. Business Function Continuity

### 2.1 Patient Appointment Booking

| Scenario | Impact | Fallback |
|----------|--------|----------|
| Supabase down | Booking API unavailable | Maintenance mode; clinics take phone bookings manually |
| Cloudflare down | Entire platform unreachable | Point DNS to a static "under maintenance" page hosted elsewhere |
| Both down | Complete outage | Phone-based booking; clinics use paper records temporarily |

**RTO:** < 2 hours | **RPO:** < 24 hours (nightly backup)

### 2.2 Patient Notifications

| Scenario | Impact | Fallback |
|----------|--------|----------|
| WhatsApp (Meta) down | No WhatsApp reminders | Auto-switch to Twilio SMS (`src/lib/sms.ts`) |
| Twilio down | No SMS fallback | Email via Resend |
| Resend down | No email notifications | In-app notifications only; WhatsApp/SMS still work |
| All notification channels down | No automated notifications | Manual phone calls by clinic staff |

**RTO:** < 30 minutes (auto-failover for WhatsApp -> SMS)

### 2.3 Payment Processing

| Scenario | Impact | Fallback |
|----------|--------|----------|
| Stripe down | International payments fail | CMI (domestic) still operational; queue Stripe payments for retry |
| CMI down | Domestic MAD payments fail | Stripe as fallback (higher fees); manual bank transfer |
| Both down | No online payments | Manual invoicing; record payment intent in DB for later reconciliation |

**RTO:** < 1 hour (manual fallback)

### 2.4 Team Operations

| Scenario | Impact | Fallback |
|----------|--------|----------|
| Slack / Google Workspace down | Team communication disrupted | WhatsApp group (pre-established); personal phones |
| GitHub down | No deploys, no CI | Local development continues; hotfix via `wrangler deploy` directly |
| IdP (Google SSO) down | Cannot log into vendor dashboards | Break-glass accounts (see `workforce-security.md` Section 3) |
| Key team member unavailable | Knowledge gap | On-call rotation (`docs/oncall.md`); documented runbooks |

---

## 3. Payroll & Financial Continuity

| Function | Provider | Fallback |
|----------|----------|----------|
| Payroll | _TBD (document current provider)_ | Manual bank transfers |
| Invoicing | Stripe Billing / manual | Manual invoices via email |
| Accounting | _TBD_ | Exported CSV from Stripe + CMI dashboards |

---

## 4. Communication Plan During BCP Activation

| Audience | Channel | Responsible | Template |
|----------|---------|-------------|----------|
| Team | WhatsApp emergency group | IC / Security Officer | Verbal / ad-hoc |
| Clinics (customers) | Email + in-app banner | Support lead | `docs/comms-templates/README.md` |
| Patients | WhatsApp / SMS / email | Automated (if channels up) | Existing notification templates |
| Regulators (CNDP) | Email to `contact@cndp.ma` | DPO | `docs/compliance/breach-notification-templates.md` |
| Press (if needed) | Prepared statement | CEO / Legal | _TBD -- prepare holding statement_ |

---

## 5. BCP Activation Criteria

| Trigger | Severity | Who Activates |
|---------|----------|---------------|
| Platform fully down > 1 hour | SEV-1 | IC (Incident Commander) |
| Tier-1 vendor down > 4 hours | SEV-1 | IC + Engineering Lead |
| Data breach confirmed | SEV-1 | Security Officer |
| Key person incapacitated + no backup | SEV-2 | Engineering Lead |
| Office / HQ inaccessible | SEV-3 | Remote by default (low impact) |

---

## 6. Testing & Review

| Activity | Frequency | Last Done | Next Due |
|----------|-----------|-----------|----------|
| BCP document review | Semi-annual | _Not yet_ | Q3 2026 |
| Tabletop exercise (vendor outage scenario) | Quarterly | _Not yet_ | Q3 2026 |
| Backup restore drill | Quarterly | Via `restore-test.yml` | Ongoing |
| Communication channel test | Annual | _Not yet_ | Q4 2026 |

---

## Related Documents

- [Backup & Recovery Runbook](./backup-recovery-runbook.md)
- [Incident Response Runbook](./incident-response.md)
- [Vendor Exit Playbooks](./vendor-exit-playbooks.md)
- [Workforce Security](./workforce-security.md)
- [Communications Templates](./comms-templates/README.md)
- [On-Call Rotation](./oncall.md)
