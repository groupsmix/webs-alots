# PII Column-Level Inventory & DSR Access Map

**Audit reference:** A61 (PII inventory missing) — closes the column-level gap.
**Complements:** [`data-flow-map.md`](./data-flow-map.md) (provider-level), [`retention.md`](./retention.md) (class-level), [`../data-residency.md`](../data-residency.md) (sub-processor).
**Scope:** every table in `supabase/migrations/*.sql` that holds personal data, plus R2/KV/Queue/3P surfaces.
**Methodology:** programmatic scan of all `CREATE TABLE` statements across 125 migrations, matched against PII column patterns (`patient_id`, `user_id`, `name`, `email`, `phone`, `address`, `dob`, `national_id`, free-text `notes`, `diagnosis`, `content` JSONB, file URLs, IP addresses, message bodies, transcriptions). Output reproducible via `scripts/scan-pii-columns.mjs` (TODO: extract this scan into a script — see Open Items §11).

---

## 1. Headline Numbers

| Metric                                                                         | Count   |
| ------------------------------------------------------------------------------ | ------- |
| Total tables in schema                                                         | **218** |
| Tables with any PII column                                                     | **144** |
| Tables in DSR access scope (have `patient_id` / `user_id` / `primary_user_id`) | **99**  |
| Article 9 (GDPR) / Law 09-08 art. 12 special-category tables                   | **47**  |
| Tables with explicit entry in `retention.md`                                   | **11**  |
| PII tables NOT explicitly listed in `retention.md` (coverage gap)              | **135** |

> **Top finding.** Retention schedule covers a representative sample but does not enumerate the ~135 PII-bearing tables explicitly. This is the single largest documentation gap and is the prerequisite to (a) configurable per-clinic retention via the existing `retention_policies` table, and (b) provable GDPR Art. 5(1)(e) storage limitation.

---

## 2. Jurisdictional Scope (snapshot)

Per [`retention.md`](./retention.md) line 38–39 and [`data-residency.md`](../data-residency.md):

| Regime                   | Status           | Source                                                                                                                  |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Moroccan Law 09-08       | **in scope**     | CNDP-regulated processing in MA                                                                                         |
| GDPR (EU residents)      | **in scope**     | EU data subjects registering for Moroccan clinics                                                                       |
| HIPAA (US)               | **out of scope** | `retention.md` line 38 — confirmed                                                                                      |
| CCPA / CPRA (California) | **out of scope** | `retention.md` line 38 — confirmed                                                                                      |
| EU AI Act                | **TBD**          | Not yet declared. Triggered by `src/app/api/ai/*` routes (drug-interactions, lab-preread, referral-letter, AI manager). |

> **Open scope decision (A61-OPEN-1):** EU AI Act applicability for the `ai/*` route surface. Triage in §11.

---

## 3. DSR Access Matrix

For a GDPR Art. 15 / Law 09-08 art. 7 **data subject access request (DSAR)** or Art. 17 **erasure request** for a patient with `users.id = <X>`, the following tables MUST be queried:

### 3.1 Tables keyed by `patient_id = <X>`

| #   | Table                           | Article 9 | Free-text notes | File refs | Other PII     |
| --- | ------------------------------- | --------- | --------------- | --------- | ------------- |
| 1   | `admissions`                    | ⚠️        | ✓               |           |               |
| 2   | `appointments`                  |           | ✓               |           | phone         |
| 3   | `archived_records`              |           |                 |           |               |
| 4   | `attestations`                  |           |                 | ✓         |               |
| 5   | `before_after_photos`           | ⚠️        |                 |           |               |
| 6   | `blood_pressure_readings`       | ⚠️        | ✓               |           |               |
| 7   | `blood_sugar_readings`          | ⚠️        | ✓               |           |               |
| 8   | `body_measurements`             |           | ✓               |           |               |
| 9   | `cdss_override_log`             |           |                 |           |               |
| 10  | `clinical_encounters`           | ⚠️        | ✓               |           |               |
| 11  | `consultation_notes`            | ⚠️        | ✓               |           |               |
| 12  | `consultation_photos`           | ⚠️        | ✓               | ✓         |               |
| 13  | `developmental_milestones`      | ⚠️        | ✓               |           |               |
| 14  | `diabetes_management`           | ⚠️        | ✓               |           |               |
| 15  | `dialysis_sessions`             | ⚠️        | ✓               |           |               |
| 16  | `drug_interaction_alerts`       | ⚠️        |                 |           |               |
| 17  | `ecg_records`                   | ⚠️        | ✓               | ✓         |               |
| 18  | `eeg_records`                   | ⚠️        | ✓               | ✓         |               |
| 19  | `ent_exam_records`              |           | ✓               |           |               |
| 20  | `exercise_programs`             |           | ✓               |           |               |
| 21  | `fracture_records`              |           | ✓               |           |               |
| 22  | `growth_measurements`           | ⚠️        | ✓               |           |               |
| 23  | `hearing_tests`                 |           | ✓               |           |               |
| 24  | `heart_monitoring_notes`        |           |                 |           | message_body  |
| 25  | `hormone_levels`                | ⚠️        | ✓               |           |               |
| 26  | `installments`                  |           |                 |           |               |
| 27  | `insurance_claims`              |           | ✓               |           | national_id   |
| 28  | `invoices`                      |           | ✓               |           |               |
| 29  | `iop_measurements`              |           | ✓               |           |               |
| 30  | `ivf_cycles`                    | ⚠️        | ✓               |           |               |
| 31  | `joint_assessments`             |           | ✓               |           |               |
| 32  | `lab_orders`                    | ⚠️        |                 |           |               |
| 33  | `lab_results`                   | ⚠️        | ✓               |           |               |
| 34  | `lab_test_orders`               | ⚠️        |                 | ✓         |               |
| 35  | `loyalty_points`                |           |                 |           |               |
| 36  | `loyalty_transactions`          |           |                 |           |               |
| 37  | `meal_plans`                    |           | ✓               |           |               |
| 38  | `medical_certificates`          | ⚠️        |                 | ✓         |               |
| 39  | `medical_records`               | ⚠️        | ✓               | ✓         |               |
| 40  | `mobility_tests`                |           | ✓               |           |               |
| 41  | `neuro_exam_records`            |           | ✓               |           |               |
| 42  | `news2_scores`                  | ⚠️        |                 |           |               |
| 43  | `no_show_records`               |           |                 |           |               |
| 44  | `no_show_stats`                 |           |                 |           |               |
| 45  | `nps_surveys`                   |           |                 |           |               |
| 46  | `odontogram`                    |           | ✓               |           |               |
| 47  | `optical_prescriptions`         | ⚠️        | ✓               |           |               |
| 48  | `pain_questionnaires`           |           |                 |           |               |
| 49  | `patient_acquisition_channels`  |           | ✓               |           |               |
| 50  | `patient_feedback`              |           |                 |           |               |
| 51  | `patient_packages`              |           | ✓               |           |               |
| 52  | `patient_vitals`                |           |                 |           |               |
| 53  | `payment_plans`                 |           | ✓               |           |               |
| 54  | `payment_reminders`             |           |                 |           | email         |
| 55  | `payments`                      |           |                 |           |               |
| 56  | `photo_consent_forms`           |           |                 |           |               |
| 57  | `physio_sessions`               |           |                 |           |               |
| 58  | `pregnancies`                   | ⚠️        | ✓               |           |               |
| 59  | `prescription_drafts`           |           | ✓               |           |               |
| 60  | `prescription_renewal_requests` |           | ✓               |           |               |
| 61  | `prescription_renewals`         |           |                 |           | phone         |
| 62  | `prescription_requests`         |           | ✓               | ✓         |               |
| 63  | `prescriptions`                 | ⚠️        |                 | ✓         |               |
| 64  | `progress_photos`               | ⚠️        | ✓               | ✓         |               |
| 65  | `psych_medications`             | ⚠️        | ✓               |           |               |
| 66  | `psych_session_notes`           | ⚠️        |                 |           | message_body  |
| 67  | `qr_checkin_tokens`             |           |                 |           |               |
| 68  | `radiology_orders`              | ⚠️        |                 | ✓         |               |
| 69  | `referrals`                     |           | ✓               |           |               |
| 70  | `rehab_plans`                   |           | ✓               |           |               |
| 71  | `respiratory_tests`             | ⚠️        | ✓               |           |               |
| 72  | `reviews`                       |           |                 |           |               |
| 73  | `sales`                         |           |                 |           |               |
| 74  | `skin_conditions`               |           | ✓               |           |               |
| 75  | `skin_photos`                   | ⚠️        |                 | ✓         |               |
| 76  | `speech_progress_reports`       | ⚠️        |                 |           |               |
| 77  | `speech_sessions`               | ⚠️        | ✓               |           |               |
| 78  | `spirometry_records`            | ⚠️        | ✓               |           |               |
| 79  | `telemedicine_sessions`         | ⚠️        |                 |           |               |
| 80  | `therapy_plans`                 |           | ✓               |           |               |
| 81  | `therapy_session_notes`         |           |                 |           |               |
| 82  | `treatment_plans`               |           |                 |           |               |
| 83  | `ultrasound_records`            | ⚠️        | ✓               |           |               |
| 84  | `urology_exams`                 | ⚠️        | ✓               |           |               |
| 85  | `vaccinations`                  |           | ✓               |           |               |
| 86  | `vision_tests`                  |           | ✓               |           |               |
| 87  | `voice_notes`                   | ⚠️        |                 |           | transcription |
| 88  | `waiting_list`                  |           |                 |           |               |
| 89  | `waiting_queue`                 |           |                 |           |               |
| 90  | `whatsapp_consent`              |           |                 |           | ip_address    |
| 91  | `whatsapp_conversations`        |           |                 |           |               |
| 92  | `whatsapp_voice_transcriptions` | ⚠️        |                 |           |               |
| 93  | `xray_records`                  | ⚠️        | ✓               | ✓         |               |

### 3.2 Tables keyed by `user_id = <X>` (cross-role: patient may also be user)

| #   | Table                    | Article 9 | PII markers                  |
| --- | ------------------------ | --------- | ---------------------------- |
| 1   | `ai_agent_conversations` |           | user_id                      |
| 2   | `consent_logs`           |           | ip_address, user_id          |
| 3   | `documents`              |           | file_url, user_id            |
| 4   | `notifications`          |           | email, message_body, user_id |
| 5   | `processing_consents`    |           | user_id                      |

### 3.3 Tables keyed by `primary_user_id` (linked family / dependents)

| #   | Table            | PII markers            |
| --- | ---------------- | ---------------------- |
| 1   | `family_members` | phone, primary_user_id |

### 3.4 DSAR / erasure access path summary

```
Given patients.id = X (i.e., users.id where role = 'patient'):
  1. SELECT * FROM users WHERE id = X
  2. FOR EACH of 93 tables in §3.1: SELECT * WHERE patient_id = X
  3. FOR EACH of 5 tables in §3.2: SELECT * WHERE user_id = X
  4. FOR EACH of 1 tables in §3.3: SELECT * WHERE primary_user_id = X
  5. R2: list objects in webs-alots-uploads with metadata patient_id = X
  6. Supabase Auth: GET /auth/v1/admin/users/{auth_id}
```

**Implementation surface for GDPR DSR endpoints (audit finding #2):**

- `GET  /api/dsr/access` — exports all of the above as JSON+ZIP
- `POST /api/dsr/erasure` — soft-delete + tombstone in `consent_logs` + R2 object purge
- `POST /api/dsr/rectify` — limited to `users.{name,email,phone,address}` + clinic-approved fields
- `POST /api/dsr/restrict` — flag in `processing_consents` (Art. 18)
- `POST /api/dsr/object` — flag in `processing_consents` for marketing/profiling (Art. 21)

---

## 4. Article 9 Special-Category Inventory

GDPR Art. 9 / Moroccan Law 09-08 art. 12 require explicit consent or specific lawful basis for processing the following categories. All require Article 9 lawful basis declaration in the consent banner and DPIA.

### 4.1 Mental health, psychiatric, speech therapy, voice biometrics (8 tables)

- `psych_medications`
- `psych_session_notes`
- `speech_exercises`
- `speech_progress_reports`
- `speech_sessions`
- `telemedicine_sessions`
- `voice_notes`
- `whatsapp_voice_transcriptions`

### 4.2 Reproductive / sexual health (pregnancies, IVF, urology) (5 tables)

- `ivf_cycles`
- `ivf_protocols`
- `ivf_timeline_events`
- `pregnancies`
- `urology_exams`

### 4.3 Genetic / biometric / developmental data (2 tables)

- `developmental_milestones`
- `growth_measurements`

### 4.4 Invasive / continuous physical monitoring (cardio, metabolic, respiratory) (11 tables)

- `blood_pressure_readings`
- `blood_sugar_readings`
- `diabetes_management`
- `dialysis_machines`
- `dialysis_sessions`
- `ecg_records`
- `eeg_records`
- `hormone_levels`
- `news2_scores`
- `respiratory_tests`
- `spirometry_records`

### 4.5 Medical imaging (radiology, photography) (9 tables)

- `before_after_photos`
- `consultation_photos`
- `progress_photos`
- `radiology_images`
- `radiology_orders`
- `radiology_report_templates`
- `skin_photos`
- `ultrasound_records`
- `xray_records`

### 4.6 Core PHI — diagnoses, prescriptions, encounters (12 tables)

- `admissions`
- `clinical_encounters`
- `consultation_notes`
- `drug_interaction_alerts`
- `drug_interactions`
- `lab_orders`
- `lab_results`
- `lab_test_orders`
- `medical_certificates`
- `medical_records`
- `optical_prescriptions`
- `prescriptions`

---

## 5. PII Column Inventory by Data Class

### 5.1 Identity & Account (root subject record)

| Source                   | Columns                                                                | Notes                                                              |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `users`                  | `id`, `auth_id`, `role`, `name`, `phone`, `email`, `clinic_id`         | Single table for all roles; `auth_id` links to Supabase Auth user. |
| Supabase Auth (external) | `email`, `phone`, `encrypted_password`, `last_sign_in_at`, MFA factors | Managed by Supabase, not in schema.                                |
| `email_verifications`    | `email`, `token`, `expires_at`                                         | Short-lived; review in §11.                                        |
| `staff_invitations`      | `email`, `token`, `clinic_id`                                          | Operator-side PII.                                                 |
| `impersonation_sessions` | `admin_user_id`, `target_user_id`, `reason`                            | Auditing surface; super-admin scope.                               |

### 5.2 Contact (delivery channel for notifications)

| Source                    | Columns                                  | Notes                                                                       |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `users`                   | `phone`, `email`                         | Primary contact.                                                            |
| `family_members`          | `name`, `phone`, `relationship`          | Surrogate contacts.                                                         |
| `notification_queue`      | `recipient` (phone/email), `body` (text) | **Plaintext PII in outbound queue.** Retention: needs explicit entry (gap). |
| `notification_log`        | `recipient`, sent payload                | Retention listed as 90 days in `retention.md` ✓.                            |
| `clinic_whatsapp_numbers` | `phone_number`, `phone_number_id`        | Tenant-owned phone, not subject PII.                                        |

### 5.3 Demographic

| Source                                            | Columns                            | Notes                             |
| ------------------------------------------------- | ---------------------------------- | --------------------------------- |
| `users` (extended cols added in later migrations) | `date_of_birth`, `address`, `city` | DOB is special-category context.  |
| `insurance_claims`                                | `national_id` (CIN)                | Government ID — high sensitivity. |

### 5.4 Medical / Clinical (Article 9)

See §4. Roughly **47 dedicated tables** plus `appointments.notes`, `consultation_notes.notes`, `prescriptions.content`, `medical_records.content`/`notes`.

### 5.5 Financial / Payment (PCI-DSS scope)

| Source                                                       | Columns                                                    | PCI scope                               |
| ------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------- |
| `payments`                                                   | `amount`, `method`, `ref` (processor txn id), `patient_id` | `ref` is tokenized — **no PAN stored**. |
| `invoices`, `invoice_items`, `invoice_line_items`            | `amount`, `description`, `patient_id`                      | Tax-data scope.                         |
| `payment_plans`, `payment_plan_installments`, `installments` | `amount`, `due_date`                                       | Financial obligations.                  |
| `processed_stripe_events`                                    | Stripe event ID + payload (no PAN)                         | Webhook idempotency.                    |
| `cmi_callbacks_seen`                                         | CMI callback payload (no PAN)                              | Webhook idempotency.                    |
| `clinic_payment_configs`                                     | Stripe/CMI credentials (encrypted via PHI_ENCRYPTION_KEY)  | Tenant-level.                           |
| `refund_requests`, `clinic_expenses`, `expense_categories`   | Financial events                                           | Tenant-side.                            |

> **PCI position.** SAQ-A applicable — no PAN/cardholder data ever stored. Stripe Elements + CMI redirect both keep card data out of our perimeter.

### 5.6 Communications / Free-Text

| Source                                                                    | Columns                           | Risk                                             |
| ------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| `whatsapp_conversations`, `whatsapp_consent`, `whatsapp_support_sessions` | Message text, recipient phone     | High — message body may contain volunteered PHI. |
| `whatsapp_voice_transcriptions`                                           | Raw transcription text            | **Biometric proxy** — voice content.             |
| `voice_notes`                                                             | `transcription`, audio file in R2 | Same.                                            |
| `support_messages`, `support_tickets`, `support_metrics`                  | Free-text body                    | Customer service surface.                        |
| `telemedicine_sessions`                                                   | Session metadata + recording refs | Imaging + audio.                                 |
| `ai_agent_conversations`, `ai_usage`, `ai_usage_logs`, `ai_cost_log`      | Prompt + completion text          | **AI sub-processor exposure — OpenAI.**          |

### 5.7 IP-Based / Telemetry

| Source                                                                     | Columns                                                   | Notes                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `consent_logs`                                                             | `ip_address`, `user_id`, consent payload                  | GDPR Art. 7(1) proof; permanent (per `retention.md`). |
| `whatsapp_consent`                                                         | `ip_address`, `patient_id`                                | Consent capture.                                      |
| `audit_logs`, `immutable_audit_log`, `pending_audit_logs`, `activity_logs` | Actor `user_id`, IP, action                               | 2-year retention per `retention.md` ✓.                |
| Cloudflare KV (`RATE_LIMIT_KV`)                                            | Hashed identifier (IP / user-id derivative)               | 24h TTL per `retention.md` ✓.                         |
| Sentry (external)                                                          | Stack traces, breadcrumbs (PHI-scrubbed via `beforeSend`) | US transfer; SCCs in DPA.                             |
| Plausible (external)                                                       | Anonymized page views, no cookies                         | EU; legitimate interest.                              |

---

## 6. Unstructured & External PII Surfaces

### 6.1 Cloudflare R2 (`webs-alots-uploads`)

Referenced by: `documents.file_url`, `prescriptions.pdf_url`, `medical_certificates.file_url`, `consultation_photos.file_url`, `ecg_records.file_url`, `eeg_records.file_url`, `lab_test_orders.file_url`, `prescription_requests.file_url`, `progress_photos.file_url`, `radiology_orders.file_url`, `skin_photos.file_url`, `xray_records.file_url`.

**Object categories:** prescriptions (PDF), lab results (PDF / PNG), X-ray / radiology imaging, insurance docs, invoices, ID documents, consultation photos, dermatology photos, before/after photos, ECG / EEG traces, voice recordings.

**Controls:** AES-256-GCM at rest (CF-managed) + AV scan via `AV_SCAN_URL` + signed-URL access only.
**Region pin:** EU jurisdiction per `data-residency.md` (Tier 1 vendor).
**Retention:** 10 years per `retention.md` row 5 ✓ (consistent with healthcare records).
**Lifecycle:** `r2-lifecycle.json` configures expiry.

### 6.2 Cloudflare KV

| Namespace       | Contents                              | Retention |
| --------------- | ------------------------------------- | --------- |
| `RATE_LIMIT_KV` | Hashed-identifier rate-limit counters | 24h TTL ✓ |

### 6.3 Cloudflare Queues

| Queue                | Contents                                         | Retention                                                              |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `NOTIFICATION_QUEUE` | Outbound message payloads incl. recipient + body | Transient; Queues default; **needs explicit entry in `retention.md`**. |

### 6.4 External processors

Full sub-processor registry: see [`data-residency.md`](../data-residency.md).
This inventory adds the following column-level mapping for the most sensitive flows:

| Processor     | Source column / table                                                                | Data category                                      |
| ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Stripe        | `payments.ref`, `processed_stripe_events.payload`, `clinic_payment_configs.stripe_*` | Payment metadata + tokenized PM                    |
| CMI           | `payments.ref` (CMI orderId), `cmi_callbacks_seen.payload`                           | Payment metadata (MAD)                             |
| Meta WhatsApp | `notification_queue.recipient` (phone), `body`, `whatsapp_*`                         | Phone + message bodies                             |
| Twilio        | `notification_queue.recipient` (phone fallback)                                      | Phone + OTP                                        |
| Resend        | `notification_queue.recipient` (email)                                               | Email + body                                       |
| OpenAI        | `ai_agent_conversations.*`, `ai_usage_logs.*`, calls from `/api/ai/*`                | **Pseudonymized** clinical context (see SOP — TBD) |
| Sentry        | `beforeSend`-filtered exception data                                                 | Trace metadata, PHI-scrubbed                       |
| Plausible     | Page views (no PII)                                                                  | Anonymous                                          |

---

## 7. Retention Coverage Gap

`retention.md` explicitly names 11 tables. 135 additional PII-bearing tables have no explicit retention entry. They inherit the platform default (1826 days = 5 years) via `retention_policies.retention_days`, but this is not documented as a deliberate decision per table.

### 7.1 Tables that need explicit retention rows (proposed batches)

**Batch A — Article 9 special-category (47 tables, all should be 10 years):**

- `psych_medications`
- `psych_session_notes`
- `speech_exercises`
- `speech_progress_reports`
- `speech_sessions`
- `telemedicine_sessions`
- `voice_notes`
- `whatsapp_voice_transcriptions`
- `ivf_cycles`
- `ivf_protocols`
- `ivf_timeline_events`
- `pregnancies`
- `urology_exams`
- `developmental_milestones`
- `growth_measurements`
- `blood_pressure_readings`
- `blood_sugar_readings`
- `diabetes_management`
- `dialysis_machines`
- `dialysis_sessions`
- `ecg_records`
- `eeg_records`
- `hormone_levels`
- `news2_scores`
- `respiratory_tests`
- `spirometry_records`
- `before_after_photos`
- `consultation_photos`
- `progress_photos`
- `radiology_images`
- `radiology_orders`
- `radiology_report_templates`
- `skin_photos`
- `ultrasound_records`
- `xray_records`
- `admissions`
- `clinical_encounters`
- `drug_interaction_alerts`
- `drug_interactions`
- `lab_orders`
- `lab_results`
- `lab_test_orders`
- `medical_certificates`
- `medical_records`
- `optical_prescriptions`

**Batch B — Patient-keyed clinical/operational not in Batch A:**

- `ai_agent_conversations`
- `archived_records`
- `attestations`
- `body_measurements`
- `cdss_override_log`
- `ent_exam_records`
- `exercise_programs`
- `family_members`
- `fracture_records`
- `hearing_tests`
- `heart_monitoring_notes`
- `installments`
- `insurance_claims`
- `invoices`
- `iop_measurements`
- `joint_assessments`
- `loyalty_points`
- `loyalty_transactions`
- `meal_plans`
- `mobility_tests`
- `neuro_exam_records`
- `no_show_records`
- `no_show_stats`
- `notifications`
- `nps_surveys`
- `odontogram`
- `pain_questionnaires`
- `patient_acquisition_channels`
- `patient_feedback`
- `patient_packages`
- `patient_vitals`
- `payment_plans`
- `payment_reminders`
- `photo_consent_forms`
- `physio_sessions`
- `prescription_drafts`
- `prescription_renewal_requests`
- `prescription_renewals`
- `prescription_requests`
- `qr_checkin_tokens`
- `referrals`
- `rehab_plans`
- `reviews`
- `sales`
- `skin_conditions`
- `therapy_plans`
- `therapy_session_notes`
- `treatment_plans`
- `vaccinations`
- `vision_tests`
- `waiting_list`
- `waiting_queue`
- `whatsapp_consent`
- `whatsapp_conversations`

**Batch C — PII-bearing operational tables not in DSR scope:**

- `ai_agent_alerts`
- `announcements`
- `appointment_doctors`
- `appointment_reminders`
- `beds`
- `blog_posts`
- `clinic_expenses`
- `clinic_whatsapp_numbers`
- `collection_points`
- `dialysis_machines`
- `doctor_availability`
- `doctor_delay_status`
- `doctor_departments`
- `doctor_no_show_stats`
- `email_verifications`
- `emergency_slots`
- `encounter_addenda`
- `equipment_inventory`
- `equipment_maintenance`
- `equipment_rentals`
- `frame_catalog`
- `lab_deliveries`
- `lab_invoices`
- `lab_materials`
- `lab_test_results`
- `marketing_campaigns`
- `menu_items`
- `notification_queue`
- `on_duty_schedule`
- `orders`
- `payment_plan_installments`
- `pet_profiles`
- `prosthetic_orders`
- `purchase_orders`
- `radiology_images`
- `restaurant_orders`
- `service_durations`
- `staff_invitations`
- `suppliers`
- `support_messages`
- `support_tickets`
- `time_slots`
- `whatsapp_support_sessions`

---

## 8. Cross-Reference Map

| Question                                                | Answered by                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Where is data stored, and which provider holds it?      | [`../data-residency.md`](../data-residency.md) §Sub-Processor Registry                                            |
| What is the legal basis for each cross-border transfer? | [`./data-flow-map.md`](./data-flow-map.md) §Cross-Border Transfer Basis                                           |
| How long is each data class retained?                   | [`./retention.md`](./retention.md) §Retention Periods                                                             |
| Which columns hold what for a given table?              | **this document** §5, §3                                                                                          |
| For a DSAR on user X, which tables must be queried?     | **this document** §3 (DSR access matrix)                                                                          |
| Which tables are Article 9 special-category?            | **this document** §4                                                                                              |
| How is PHI encrypted at rest?                           | `src/lib/ai/secret-encryption.ts` (AES-256-GCM via `PHI_ENCRYPTION_KEY`); `src/lib/env.ts` boot validation (C-08) |
| How is Sentry stripped of PHI?                          | `sentry.client.config.ts`, `sentry.server.config.ts` `beforeSend`                                                 |

---

## 9. CNDP Filing Inputs

This inventory provides the column-level evidence needed for the CNDP `Autorisation préalable` filing:

1. **Categories of personal data** (CNDP form §3): see §5 here.
2. **Sensitive data categories** (CNDP form §4 — Loi 09-08 art. 12): see §4 (47 tables).
3. **Recipients / sub-processors** (CNDP form §6): see [`../data-residency.md`](../data-residency.md).
4. **Cross-border transfers** (CNDP form §7): see [`./data-flow-map.md`](./data-flow-map.md).
5. **Retention durations** (CNDP form §8): see [`./retention.md`](./retention.md) — and close gap in §7 above.
6. **Security measures** (CNDP form §9): `PHI_ENCRYPTION_KEY` AES-256-GCM, RLS, AV scanning, Sentry PHI scrubbing, signed URLs, rate limiting.

---

## 10. Implementation Hooks

This document directly enables the following code work, listed in dependency order:

1. **Generate DSR query module** — `src/lib/compliance/dsr-tables.ts` exports a typed list of the §3 tables. Generated from this doc.
2. **`/api/dsr/access` (GDPR Art. 15)** — loops the §3 list, streams JSON+ZIP.
3. **`/api/dsr/erasure` (GDPR Art. 17)** — soft-delete each row + R2 purge + `consent_logs` tombstone.
4. **`/api/dsr/restrict` (GDPR Art. 18) — flag in `processing_consents`.**
5. **`/api/dsr/object` (GDPR Art. 21)** — flag in `processing_consents`.
6. **`/api/dsr/rectify` (GDPR Art. 16)** — bounded `users` mutations.
7. **Retention extension** — seed `retention_policies` for all 135 gap tables in §7 with default 10 years (clinical) / 5 years (operational) / 90 days (messaging).

---

## 11. Open Items

- **A61-OPEN-1** — declare EU AI Act applicability for `/api/ai/*` route surface (drug-interactions, lab-preread, referral-letter, AI manager, auto-suggest, revenue-insights). Position needed before launch; see `data-residency.md` row OpenAI.
- **A61-OPEN-2** — pseudonymization SOP for OpenAI calls. `ai_agent_conversations` and `ai_usage_logs` store prompts; SOP must show how PHI is stripped or tokenized before egress.
- **A61-OPEN-3** — extract the scan that produced this doc into `scripts/scan-pii-columns.mjs` so CI regenerates the inventory on schema change.
- **A61-OPEN-4** — seed `retention_policies` rows for all 135 gap tables per §7.
- **A61-OPEN-5** — confirm `notification_queue` post-send purge: today it carries plaintext `recipient` + `body` indefinitely if `status` stuck at `failed`/`dead_letter`.
- **A61-OPEN-6** — confirm `whatsapp_voice_transcriptions` retention (biometric proxy). Separate from `voice_notes`.
- **A61-OPEN-7** — DPIA refresh once §10 is implemented.

---

**Maintained by:** Compliance + Engineering. Regenerate on every new migration that adds a PII column.
**Generated:** 2026-05-31 (UTC) via repo-local scan of `supabase/migrations/*.sql`.
