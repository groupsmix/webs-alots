# Personal Data Inventory (Data Map)
## Reference: Moroccan Law 09-08 Art.5, Art.24 — CNDP Notification Requirements

> **Version:** 1.0 | **Owner:** DPO + Engineering Lead | **Review:** Annual + after schema changes  
> **Status:** Active | **Last Updated:** 2026-05-08

---

## Overview

This inventory documents all categories of personal data collected, processed, and stored by Oltigo Health. It satisfies the data mapping obligation under Moroccan Law 09-08 Art.5 (purpose limitation, data minimization) and supports DPIA, CNDP notification, and subject access requests.

---

## Data Categories by Table

### 1. `users` — Patient and Staff Profiles

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `id` | Identifier | Low | System reference | Life of account | Contract |
| `auth_id` | Identifier | Medium | Supabase auth linkage | Life of account | Contract |
| `email` | Contact | **HIGH (PII)** | Login, notifications | Life of account + 1y | Contract |
| `phone` | Contact | **HIGH (PII)** | WhatsApp notifications, booking OTP | Life of account + 1y | Contract |
| `name` | Identity | **HIGH (PII)** | Display, appointment booking | Life of account + 1y | Contract |
| `role` | Operational | Low | RBAC | Life of account | Contract |
| `clinic_id` | Operational | Low | Tenant scoping | Life of account | Contract |
| `is_active` | Operational | Low | Soft delete | Life of account | Legitimate interest |
| `deleted_at` | Operational | Low | Soft delete audit | 7 years | Law 09-08 |

**Transfers:** Email addresses transferred to Resend (email provider) for notification delivery. Phone numbers transferred to Meta (WhatsApp API) for appointment reminders. Both are governed by DPAs.

---

### 2. `appointments` — Patient Appointments

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `patient_id` | Identifier | **HIGH (PHI)** | Links to patient | 7 years (medical) | Art.9(2)(h) |
| `doctor_id` | Identifier | Medium | Links to doctor | 7 years | Contract |
| `appointment_date` | Health | **HIGH (PHI)** | Scheduling | 7 years | Art.9(2)(h) |
| `status` | Operational | Low | Appointment lifecycle | 7 years | Art.9(2)(h) |
| `notes` | Health | **CRITICAL (PHI)** | Clinical notes | 10 years | Art.9(2)(h) |
| `cancellation_reason` | Health | High | Cancellation tracking | 7 years | Legitimate interest |
| `diagnosis` | Health | **CRITICAL (PHI)** | Medical record | 10 years | Art.9(2)(h) |

---

### 3. `patient_files` — Encrypted PHI File Attachments

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `r2_key` | Identifier | High | R2 storage reference | 10 years | Art.9(2)(h) |
| `file_name` | Metadata | Medium | Display | 10 years | Art.9(2)(h) |
| `content_type` | Metadata | Low | Browser rendering | 10 years | Art.9(2)(h) |
| `patient_id` | Identifier | **HIGH (PHI)** | Ownership | 10 years | Art.9(2)(h) |
| `clinic_id` | Identifier | Low | Tenant scoping | 10 years | Art.9(2)(h) |

**Encryption:** All files encrypted AES-256-GCM with per-file IV before R2 upload. Key stored in `PHI_ENCRYPTION_KEY` (Cloudflare Secret).

---

### 4. `payments` — Financial Records

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `amount` | Financial | Medium | Billing | 10 years (financial) | Legal obligation |
| `stripe_payment_intent_id` | Identifier | Medium | Payment reconciliation | 10 years | Legal obligation |
| `patient_id` | Identifier | **HIGH (PHI)** | Links payment to patient | 10 years | Contract |
| `status` | Operational | Low | Payment lifecycle | 10 years | Legal obligation |

**Transfers:** Payment data processed by Stripe (international) and CMI (Moroccan interbank). Both governed by DPAs and PCI-DSS certification.

---

### 5. `activity_logs` — Audit Trail (WORM)

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `actor` | Identifier | Medium | Audit trail | 7 years (immutable) | Legal obligation |
| `clinic_id` | Identifier | Low | Tenant scoping | 7 years | Legal obligation |
| `action` | Operational | Low | Audit event type | 7 years | Law 09-08 Art.24 |
| `description` | Metadata | Low | Human-readable audit | 7 years | Law 09-08 Art.24 |
| `ip_address` | Network | Medium | Security audit | 7 years | Legitimate interest |
| `timestamp` | Temporal | Low | Event timing | 7 years | Law 09-08 Art.24 |

**Immutability:** Triggers block UPDATE/DELETE. Rows archived to R2 WORM bucket (Object Lock, Governance, 7 years).

---

### 6. `notification_log` — WhatsApp/SMS Message Log

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `phone_number` | Contact | **HIGH (PII)** | Message delivery | 1 year | Legitimate interest |
| `message_body` | Content | High | Message audit | 1 year | Legitimate interest |
| `status` | Operational | Low | Delivery tracking | 1 year | Legitimate interest |
| `patient_id` | Identifier | **HIGH (PHI)** | Attribution | 1 year | Art.9(2)(h) |

---

### 7. `ai_token_usage` — AI Usage Tracking

| Field | Category | Sensitivity | Purpose | Retention | Legal Basis |
|---|---|---|---|---|---|
| `clinic_id` | Identifier | Low | Budget tracking | 1 year | Contract |
| `tokens_used` | Operational | Low | Budget enforcement | 1 year | Contract |
| `model` | Metadata | Low | Cost attribution | 1 year | Contract |

**Note:** AI endpoints are prohibited from logging patient names or PHI. Only UUIDs are passed to AI budget tracking. Patient data sent to OpenAI is governed by the Data Processing Agreement with OpenAI.

---

## Data Flow Diagram (Summary)

```
Patient (Browser) ──HTTPS──> Cloudflare Edge Workers
    │
    ├──> Supabase PostgreSQL (PHI: appointments, patients, files)
    │       RLS scoped per clinic_id
    │
    ├──> Cloudflare R2 (Encrypted PHI files)
    │       AES-256-GCM, Object Lock for audit logs
    │
    ├──> OpenAI API (De-identified clinical text)
    │       Governed by OpenAI DPA (EU SCCs)
    │
    ├──> Meta Cloud API (Phone number + appointment reminder text)
    │       Governed by Meta DPA
    │
    ├──> Resend / SMTP (Email address + appointment details)
    │       Governed by Resend DPA
    │
    ├──> Stripe (Payment intent + amount)
    │       PCI-DSS Level 1, Stripe DPA
    │
    └──> CMI (Payment form fields)
            Moroccan interbank, CMI DPA
```

---

## Third-Party Processors

| Processor | Data Shared | DPA Executed | Adequacy/SCCs |
|---|---|---|---|
| Supabase | All PHI | Yes (Supabase DPA) | EU SCCs + US adequacy |
| Cloudflare | IP, request metadata, R2 PHI | Yes (CF DPA) | EU adequacy |
| OpenAI | De-identified clinical text | Yes (OpenAI DPA) | EU SCCs |
| Meta (WhatsApp) | Phone numbers, message text | Yes (Meta DPA) | EU SCCs |
| Resend | Email addresses, appointment text | Yes (Resend DPA) | EU SCCs |
| Stripe | Payment data, email | Yes (Stripe DPA) | PCI-DSS |
| CMI | Payment form fields | Yes (CMI Agreement) | Moroccan entity |

---

## Subject Rights (Law 09-08 Art.7)

| Right | How to Exercise | SLA |
|---|---|---|
| Access (Art.7.1) | Patient portal → "My Data" | 30 days |
| Rectification (Art.7.2) | Contact clinic staff | 30 days |
| Erasure (Art.7.3) | Request via DPO | 30 days (subject to medical retention) |
| Objection (Art.7.4) | Contact DPO | 30 days |

Medical records (10-year retention) cannot be erased during retention period under Art.9(2)(h). A pseudonymized copy is retained; identifying fields are redacted.

---

## CNDP Notification Status

This data processing is registered with the CNDP (Commission Nationale de contrôle de la Protection des Données à caractère personnel) under:
- **Notification reference:** [PENDING — submit before go-live]
- **Processing category:** Health data, Art.9 derogation (Art.9(2)(h)) — medical purposes
- **Data controller:** Oltigo Health SARL
- **DPO contact:** dpo@oltigo.com
