# Data Protection Impact Assessment (DPIA)

**C-01: Required by Moroccan Law 09-08 (Loi relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel) and GDPR-equivalent obligations.**

## 0. Children's Data Assessment (A61-F1 Gap Resolution)

**Audit finding:** A61-F1 (🟠 HIGH) — DPIA did not address whether the patient population
includes minors (children < 16). This section resolves that gap.

### Assessment

A Moroccan clinic platform processing health records **will** encounter minor patients.
Paediatric, dental, general practice, and family medicine clinics regularly treat children,
and the platform's registration form accepts any DOB.

### Applicable Law

| Jurisdiction           | Rule                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| **GDPR Art.8**         | Consent for under-16s requires parental/guardian authorisation          |
| **Moroccan Law 09-08** | Heightened safeguards for sensitive data; minors cannot provide consent |

### Technical Controls Implemented

| Control                             | Implementation                                  | File                                |
| ----------------------------------- | ----------------------------------------------- | ----------------------------------- |
| Minor detection from DOB            | `isMinorByDob(dob)` function                    | `src/lib/minors.ts`                 |
| Minor AI processing audit log       | `logMinorAIProcessing()`                        | `src/lib/ai/config.ts`              |
| Minor consent enforcement migration | Migration `00097_minor_consent_enforcement.sql` | `supabase/migrations/`              |
| `is_minor` flag in patient metadata | `PatientMetadata.is_minor` field                | `src/lib/types/patient-metadata.ts` |

### Remaining Gaps

1. **Parental consent workflow:** No UI exists for a parent/guardian to give consent on
   behalf of a minor patient. This is required before a minor can be registered and have
   AI features applied. Tracked as a P1 feature in the product backlog.

2. **No profiling of minors:** AI features MUST NOT profile or use historical data for
   minors without explicit parental consent. The `is_minor` flag SHOULD gate AI routes —
   currently only `patient-summary` checks this flag via `logMinorAIProcessing()`.

3. **Age verification at registration:** The registration form accepts any DOB without
   routing minors to a parental consent flow. This must be added before production launch
   with minor patients.

### Required Actions Before Serving Minor Patients

- [ ] Implement parental consent capture at registration (route minor DOB to guardian consent form)
- [ ] Gate all AI routes behind `is_minor` check — refuse AI processing for minors without parental consent
- [ ] Add `guardian_name`, `guardian_phone`, `guardian_relationship` fields to patient schema
- [ ] Update Privacy Policy to address children's data processing
- [ ] Obtain CNDP guidance on minor health data (Law 09-08 does not specify an age threshold; CNDP may align with GDPR's Art.8)

---

## 1. Processing Activities

| Activity                   | Data Categories                                                 | Lawful Basis                                                       | Retention                                                  |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Patient registration       | Name, email, phone, DOB, gender                                 | Contractual necessity                                              | Until account deletion + 5 years                           |
| Appointment booking        | Patient ID, doctor ID, date/time, notes                         | Contractual necessity                                              | 10 years (medical records)                                 |
| Prescription management    | Patient ID, medications, dosage, notes                          | Legal obligation (healthcare)                                      | 10 years                                                   |
| Payment processing         | Amount, method, gateway reference                               | Contractual necessity                                              | 10 years (tax)                                             |
| WhatsApp notifications     | Phone number, message content                                   | Legitimate interest (with consent)                                 | 90 days                                                    |
| Audit logging              | User actions, IP addresses, timestamps                          | Legal obligation                                                   | 2 years                                                    |
| AI prescription generation | Diagnosis, symptoms, allergies, medications, chronic conditions | Legitimate interest (clinical decision support) + explicit consent | Session-only (pseudonymised before transmission to OpenAI) |
| AI drug interaction check  | Medication list, patient age, allergies, chronic conditions     | Legitimate interest (patient safety) + explicit consent            | Session-only (pseudonymised before transmission to OpenAI) |
| AI patient summary         | Patient history, notes, lab results                             | Legitimate interest (clinical workflow) + explicit consent         | Session-only (pseudonymised before transmission to OpenAI) |
| Analytics (Plausible)      | Page views, anonymized visitor data                             | Legitimate interest                                                | 2 years                                                    |

## 2. Data Flows

See [data-flow-map.md](./data-flow-map.md) for per-provider flows.

## 3. Risk Assessment

| Risk                                   | Likelihood | Impact   | Mitigation                                                                                                  |
| -------------------------------------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Cross-tenant data leak                 | Low        | Critical | RLS + application-level clinic_id scoping + middleware tenant isolation                                     |
| PHI exposure in logs                   | Medium     | High     | Structured logger with PHI redaction, Sentry beforeSend hooks                                               |
| Unauthorized access to medical records | Low        | Critical | Role-based access control (5 roles), MFA for admin                                                          |
| Payment data breach                    | Low        | High     | No card data stored; CMI/Stripe handle PCI compliance                                                       |
| R2 file exposure                       | Low        | High     | AES-256-GCM encryption, signed URLs, tenant-scoped paths                                                    |
| AI PHI leakage to OpenAI               | Medium     | High     | PHI pseudonymisation (F-AI-04), OPENAI_BASE_URL allowlist (F-AI-05), DPA with OpenAI, kill-switch (F-AI-01) |
| AI hallucination in prescriptions      | Medium     | High     | Doctor review required (AI disclaimer), eval harness (F-AI-03), model pinning (F-AI-07)                     |
| AI prompt injection                    | Medium     | Medium   | Input sanitisation (F-AI-06), UNTRUSTED delimiters, anti-phishing rules (F-AI-09)                           |

## 4. Data Subject Rights

- **Right of access**: Patient export endpoint (`/api/patient/export`)
- **Right to erasure**: Patient delete endpoint (`/api/patient/delete-account`) with GDPR purge cron
- **Right to rectification**: Profile editing in patient dashboard
- **Right to data portability**: JSON export via patient export endpoint
- **Consent management**: Consent logging API (`/api/consent`) with processing_consents table

## 5. Jurisdictional Scope (A63-1)

| Regulation                 | Applicable? | Notes                                                                      |
| -------------------------- | ----------- | -------------------------------------------------------------------------- |
| **Law 09-08** (Morocco)    | **Yes**     | Primary jurisdiction. CNDP registration required before production.        |
| **GDPR** (EU)              | **Yes**     | If EU residents register. DPAs in place, SCCs for US transfers.            |
| **CCPA/CPRA** (California) | **No**      | Product targets Moroccan clinics/patients. No California residents served. |
| **HIPAA** (US)             | **No**      | No US patients or covered entities. Re-assess if US market entered.        |

> If the served population ever includes California residents, add GPC honoring
> (treat `Sec-GPC: 1` as opt-out of analytics/sale) and data-subject request endpoints.

## 6. Review Schedule

This DPIA must be reviewed:

- Annually (minimum)
- When new processing activities are added
- When data flows to new third-party providers are introduced
- After any data breach incident

Last reviewed: 2026-04-29
Next review due: 2027-04-29
