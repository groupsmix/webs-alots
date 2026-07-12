# PHI & Moroccan Compliance Checklist

This checklist is the gate before any feature that stores, processes, or displays Protected Health Information (PHI) is re-enabled (e.g. prescriptions, radiology, patient documents, vitals, lab results, full medical timeline).

> **Scope:** Oltigo Health Lane A (operational SaaS) currently stores minimal patient-identifiable data (name, phone, appointments, billing). Re-opening Lane B (clinical PHI) requires every item below to be signed off by the DPO/founder and, where noted, externally validated.

---

## 1. Legal & Regulatory (Morocco)

| #   | Item                                                                                                                                                             | Owner          | Evidence      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| 1.1 | **DPA in place** with each clinic — defines roles (Oltigo = processor, clinic = controller), subprocessors, data categories, retention, and breach notification. | Founder/ Legal | Signed PDFs   |
| 1.2 | **CNDP notification** filed for the platform and each clinic acting as controller.                                                                               | Legal          | CNDP receipts |
| 1.3 | **Loi 09-08** mapping completed: legal basis, consent, patient rights, cross-border transfer, and security measures documented.                                  | DPO            | Risk register |
| 1.4 | **CNSS / AMO / CMIM** insurance-claims data handling reviewed and approved by legal if claims module is enabled.                                                 | Legal          | Memo          |

---

## 2. Tenant Isolation & Access Control

| #   | Item                                                                                              | Test                                                            |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2.1 | Every `SELECT/INSERT/UPDATE/DELETE` from app code filters by `clinic_id`.                         | `scripts/check-scope-enforcement.mjs`                           |
| 2.2 | RLS policies exist on every PHI table and enforce `clinic_id` matching request context.           | `src/lib/__tests__/integration/rls-*.test.ts`                   |
| 2.3 | Cross-tenant stress tests pass: 5+ clinics, all PHI tables, `SELECT/INSERT/UPDATE/DELETE`.        | `src/lib/__tests__/integration/tenant-isolation-stress.test.ts` |
| 2.4 | Service role key is not used in app code; only for migrations, cron, and Supabase Edge Functions. | grep for `SUPABASE_SERVICE_ROLE_KEY` outside scripts/edge       |
| 2.5 | `x-clinic-id` header is stripped by middleware and re-derived from subdomain.                     | `src/middleware.ts` tests                                       |

---

## 3. Encryption & Storage

| #   | Item                                                                                                          | Evidence                                          |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 3.1 | PHI files encrypted with AES-256-GCM, unique IV per file, keys stored in `SUPABASE_PHI_ENCRYPTION_KEY` / KMS. | `src/lib/encryption.ts`                           |
| 3.2 | Database backups encrypted at rest and access-logged.                                                         | Supabase dashboard / DPA addendum                 |
| 3.3 | `patient_files` RLS policy blocks cross-tenant read of `r2_key` / `encryption_iv`.                            | `supabase/migrations/00180_patient_files_rls.sql` |
| 3.4 | No PHI stored in `stdout`, `console.log`, Sentry breadcrumbs, or unstructured logs.                           | `npm run lint` + `grep -R "console.log" src/lib`  |

---

## 4. Audit & Logging

| #   | Item                                                                                          | Test                       |
| --- | --------------------------------------------------------------------------------------------- | -------------------------- |
| 4.1 | `logAuditEvent` called for every create/update/delete of PHI, billing, and user-role changes. | Static grep + route tests  |
| 4.2 | Audit logs include `clinic_id`, actor, action, resource, and before/after hash.               | `src/lib/audit-log.ts`     |
| 4.3 | Audit logs are append-only and cannot be edited by clinic admins.                             | RLS policy on `audit_logs` |

---

## 5. Patient Rights (Loi 09-08)

| #   | Item                                                                                                     | Status                                           |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 5.1 | **Right to access**: patient can request and receive a copy of their data within 30 days.                | Workflow in `patient/settings`                   |
| 5.2 | **Right to rectification**: patient can request correction of inaccurate data.                           | Support ticket / admin UI                        |
| 5.3 | **Right to erasure**: documented procedure to delete or anonymize a patient record and cascade to files. | `scripts/purge-junk-clinics.ts` adapted for DSAR |
| 5.4 | **Right to object / restrict**: patient can opt out of WhatsApp/SMS reminders; queue respects this.      | `src/lib/notification-queue.ts`                  |

---

## 6. Data Retention & Disposal

| #   | Item                                                                                            | Evidence                           |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| 6.1 | Retention schedule by data type documented (appointments, prescriptions, invoices, audit logs). | This doc + `docs/adr/retention.md` |
| 6.2 | Automated deletion or anonymization of records past retention.                                  | Cron job or Supabase pg_cron       |
| 6.3 | Hard-deleted PHI removed from backups within 30 days (or kept in immutable legal hold).         | Backup policy                      |

---

## 7. Incident & Breach

| #   | Item                                                                                              | Evidence                    |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| 7.1 | Breach notification process: 72h internal triage, 48h to CNDP, patient notification if high risk. | `docs/INCIDENT_RESPONSE.md` |
| 7.2 | Sentry alerts on cross-tenant DB errors, failed auth spikes, and PHI file access anomalies.       | Sentry alert rules          |

---

## 8. Go/No-Go Sign-off

| Role                          | Name | Date | Sign-off |
| ----------------------------- | ---- | ---- | -------- |
| Founder / DPO                 |      |      |          |
| Engineering Lead              |      |      |          |
| External Legal / CNDP counsel |      |      |          |

> **Do not enable `prescriptions`, `radiology`, `patient documents`, `vitals`, `lab results`, or `full medical timeline` until all sign-offs are collected and the RLS stress tests pass in CI.**
