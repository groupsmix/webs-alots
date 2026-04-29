# Data Protection Impact Assessment (DPIA)

**C-01: Required by Moroccan Law 09-08 (Loi relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel) and GDPR-equivalent obligations.**

## 1. Processing Activities

| Activity | Data Categories | Lawful Basis | Retention |
|---|---|---|---|
| Patient registration | Name, email, phone, DOB, gender | Contractual necessity | Until account deletion + 5 years |
| Appointment booking | Patient ID, doctor ID, date/time, notes | Contractual necessity | 10 years (medical records) |
| Prescription management | Patient ID, medications, dosage, notes | Legal obligation (healthcare) | 10 years |
| Payment processing | Amount, method, gateway reference | Contractual necessity | 10 years (tax) |
| WhatsApp notifications | Phone number, message content | Legitimate interest (with consent) | 90 days |
| Audit logging | User actions, IP addresses, timestamps | Legal obligation | 2 years |
| Analytics (Plausible) | Page views, anonymized visitor data | Legitimate interest | 2 years |

## 2. Data Flows

See [data-flow-map.md](./data-flow-map.md) for per-provider flows.

## 3. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-tenant data leak | Low | Critical | RLS + application-level clinic_id scoping + middleware tenant isolation |
| PHI exposure in logs | Medium | High | Structured logger with PHI redaction, Sentry beforeSend hooks |
| Unauthorized access to medical records | Low | Critical | Role-based access control (5 roles), MFA for admin |
| Payment data breach | Low | High | No card data stored; CMI/Stripe handle PCI compliance |
| R2 file exposure | Low | High | AES-256-GCM encryption, signed URLs, tenant-scoped paths |

## 4. Data Subject Rights

- **Right of access**: Patient export endpoint (`/api/patient/export`)
- **Right to erasure**: Patient delete endpoint (`/api/patient/delete-account`) with GDPR purge cron
- **Right to rectification**: Profile editing in patient dashboard
- **Right to data portability**: JSON export via patient export endpoint
- **Consent management**: Consent logging API (`/api/consent`) with processing_consents table

## 5. Review Schedule

This DPIA must be reviewed:
- Annually (minimum)
- When new processing activities are added
- When data flows to new third-party providers are introduced
- After any data breach incident

Last reviewed: 2026-04-29
Next review due: 2027-04-29
