# Oltigo Health — Morocco Pilot Checklist

This runbook is the operational checklist for launching a **3–5 clinic closed pilot** in Morocco. It assumes the platform is operating in **Lane A** mode (operations-only: scheduling, reminders, billing, website, and WhatsApp). Clinical modules that store PHI remain feature-flagged off until the CNDP / Loi 09-08 compliance checklist is signed.

## Pilot Target Profile

Target 3–5 clinics in one of these profiles:

1. General-practice / single-doctor clinic
2. Dental / para-pharmacy clinic
3. Specialist office (dermatology, ophthalmology, gynecology)

All pilots must have a decision-maker and a daily receptionist/operator who uses WhatsApp.

---

## Phase 1 — Tenant & Payments Setup

| #   | Task                                                                                                               | Owner    | Verification                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| 1.1 | Create clinic record and set `tier` to pilot.                                                                      | Ops      | Row in `clinics` with `tier = 'pilot'`                                 |
| 1.2 | Configure subdomain and verify DNS routing.                                                                        | Platform | `https://<slug>.oltigo.com` resolves to tenant                         |
| 1.3 | Set `country = 'MA'`, `timezone = 'Africa/Casablanca'`, `currency = 'MAD'`.                                        | Ops      | Clinic profile config                                                  |
| 1.4 | Enable Lane A features only: `appointments`, `billing`, `notifications`, `website`, `whatsapp`.                    | Product  | `features_config` JSON                                                 |
| 1.5 | Verify **all PHI clinical modules are OFF**: prescriptions, vitals, radiology, patient documents, timeline/export. | Product  | `clinic_types.features_config` and UI sidebar                          |
| 1.6 | Record CMI merchant credentials and Stripe keys in clinic-specific vault.                                          | Finance  | `clinic_whatsapp_credentials` / secret manager                         |
| 1.7 | Configure a CMI test transaction and Stripe test card.                                                             | Finance  | Successful `api/payments/cmi` and `api/payments/create-checkout` calls |
| 1.8 | Verify payment idempotency (duplicate webhook callback returns `ACTION=POSTAUTH` without double payment).          | Eng      | `api/payments/cmi/callback` replay test                                |

---

## Phase 2 — WhatsApp Journey

| #   | Task                                                                                                            | Owner      | Verification                                           |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| 2.1 | Link clinic WhatsApp Business Account (WABA) and verify phone number.                                           | Ops        | `clinics.whatsapp_phone_id` is set                     |
| 2.2 | Submit the 10 standard Darija/French/Arabic templates to Meta.                                                  | Ops        | All templates show `APPROVED` status                   |
| 2.3 | Set default patient locale per clinic (`fr`, `ar`, or `ary`) and opt-in preference.                             | Ops        | `patient_preferences` row                              |
| 2.4 | Verify opt-in audit log: `whatsapp_consent` table records `granted`/`revoked` with `method = 'whatsapp_reply'`. | Compliance | Consent audit log entry                                |
| 2.5 | Send test booking confirmation, 24h reminder, and NPS follow-up.                                                | Ops        | Successful `send` log with `clinicId` and `messageId`  |
| 2.6 | Confirm Sentry alert `whatsapp_failure` fires if a message fails.                                               | Eng        | Sentry issue with `alert:whatsapp_failure` tag         |
| 2.7 | Test no-show rescheduling via WhatsApp reply (`OUI`/`NON`) in Darija and French.                                | Ops        | Conversation state updated and appointment rescheduled |

---

## Phase 3 — Staff, Services & Schedule

| #   | Task                                                                                           | Owner  | Verification                                          |
| --- | ---------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| 3.1 | Create admin/receptionist user and doctor user.                                                | Clinic | Both users in `users` with `clinic_id` set            |
| 3.2 | Define services with durations, prices in MAD, and CNSS/AMO/CMIM insurance flags.              | Clinic | Rows in `services`                                    |
| 3.3 | Configure working hours and doctor availability.                                               | Clinic | `doctor_schedules` and `availability` rows            |
| 3.4 | Place a test booking via the public booking page and confirm it appears in the admin calendar. | Ops    | Appointment in `appointments` with status `confirmed` |
| 3.5 | Run a patient-side cancellation and verify the slot is released.                               | Ops    | Appointment status `cancelled` and slot available     |

---

## Phase 4 — Website & Branding

| #   | Task                                                          | Owner  | Verification                                        |
| --- | ------------------------------------------------------------- | ------ | --------------------------------------------------- |
| 4.1 | Upload logo, brand colors, and clinic contact info.           | Clinic | Public website renders with correct branding        |
| 4.2 | Configure landing sections: hero, services, contact, booking. | Clinic | `/` and `/book` render correctly on mobile          |
| 4.3 | Verify website is localized in French and Arabic (RTL).       | Clinic | `/ar` route renders without literal-string fallback |
| 4.4 | Run Lighthouse and confirm mobile performance > 60.           | Eng    | Lighthouse report                                   |

---

## Phase 5 — Business Validation

Run the **3–5 clinic business validation checklist** in `PILOT_BUSINESS_VALIDATION.md` at the end of the operational setup.

---

## Post-Pilot

1. Schedule a 1-hour retro with each clinic.
2. Export `audit_logs` and `notification_queue` logs for the pilot period.
3. Review Sentry alerts for `payment_failure`, `whatsapp_failure`, and `payment_tampering`.
4. Decide whether to re-enable any Lane B clinical modules based on signed DPA and CNDP compliance.
5. Update `PILOT_CHECKLIST.md` with findings before the next batch.
