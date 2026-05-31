/**
 * src/lib/compliance/dsr-tables.ts — A62 DSR foundation.
 *
 * Typed catalog of every table that holds personal data subject to GDPR
 * Art. 15 (access), Art. 16 (rectification), Art. 17 (erasure), Art. 18
 * (restriction), Art. 21 (objection) — and the equivalent Moroccan Law 09-08
 * art. 7 rights for data subjects.
 *
 * SOURCE OF TRUTH: docs/compliance/_generated/pii-columns.json, produced by
 * scripts/scan-pii-columns.mjs. The companion test
 * src/lib/__tests__/dsr-tables.test.ts fails CI if this module drifts from
 * the JSON output — which happens automatically when a new migration adds
 * a PII column. The fix is always: re-run the scan, regenerate this module.
 *
 * Companion document: docs/compliance/pii-column-inventory.md (this module
 * implements §3 DSR Access Matrix).
 *
 * @see docs/compliance/dsr-design.md for endpoint design.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Article 9 GDPR / Loi 09-08 art. 12 special-category sub-classification.
 * Drives prioritisation, consent-banner copy, and DPIA scope.
 */
export type Article9Category =
  | "core_phi"
  | "mental_health"
  | "reproductive_sexual"
  | "physical_health_invasive"
  | "imaging_phi"
  | "genetic_biometric";

/**
 * How a DSR endpoint locates a data subject's rows in this table.
 */
export type DsrKey = "patient_id" | "user_id" | "primary_user_id";

export interface DsrTable {
  /** Postgres table name in the `public` schema. */
  readonly name: string;
  /** Column to filter by when locating rows for a subject. */
  readonly key: DsrKey;
  /** Article 9 sub-class, or `null` for non-special-category PII. */
  readonly article9: Article9Category | null;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** Tables keyed by `patient_id` — primary DSR scope (93 tables). */
export const PATIENT_SCOPE_TABLES: readonly DsrTable[] = [
  { name: "admissions", key: "patient_id", article9: "core_phi" },
  { name: "appointments", key: "patient_id", article9: null },
  { name: "archived_records", key: "patient_id", article9: null },
  { name: "attestations", key: "patient_id", article9: null },
  { name: "before_after_photos", key: "patient_id", article9: "imaging_phi" },
  { name: "blood_pressure_readings", key: "patient_id", article9: "physical_health_invasive" },
  { name: "blood_sugar_readings", key: "patient_id", article9: "physical_health_invasive" },
  { name: "body_measurements", key: "patient_id", article9: null },
  { name: "cdss_override_log", key: "patient_id", article9: null },
  { name: "clinical_encounters", key: "patient_id", article9: "core_phi" },
  { name: "consultation_notes", key: "patient_id", article9: "core_phi" },
  { name: "consultation_photos", key: "patient_id", article9: "imaging_phi" },
  { name: "developmental_milestones", key: "patient_id", article9: "genetic_biometric" },
  { name: "diabetes_management", key: "patient_id", article9: "physical_health_invasive" },
  { name: "dialysis_sessions", key: "patient_id", article9: "physical_health_invasive" },
  { name: "drug_interaction_alerts", key: "patient_id", article9: "core_phi" },
  { name: "ecg_records", key: "patient_id", article9: "physical_health_invasive" },
  { name: "eeg_records", key: "patient_id", article9: "physical_health_invasive" },
  { name: "ent_exam_records", key: "patient_id", article9: null },
  { name: "exercise_programs", key: "patient_id", article9: null },
  { name: "fracture_records", key: "patient_id", article9: null },
  { name: "growth_measurements", key: "patient_id", article9: "genetic_biometric" },
  { name: "hearing_tests", key: "patient_id", article9: null },
  { name: "heart_monitoring_notes", key: "patient_id", article9: null },
  { name: "hormone_levels", key: "patient_id", article9: "physical_health_invasive" },
  { name: "installments", key: "patient_id", article9: null },
  { name: "insurance_claims", key: "patient_id", article9: null },
  { name: "invoices", key: "patient_id", article9: null },
  { name: "iop_measurements", key: "patient_id", article9: null },
  { name: "ivf_cycles", key: "patient_id", article9: "reproductive_sexual" },
  { name: "joint_assessments", key: "patient_id", article9: null },
  { name: "lab_orders", key: "patient_id", article9: "core_phi" },
  { name: "lab_results", key: "patient_id", article9: "core_phi" },
  { name: "lab_test_orders", key: "patient_id", article9: "core_phi" },
  { name: "loyalty_points", key: "patient_id", article9: null },
  { name: "loyalty_transactions", key: "patient_id", article9: null },
  { name: "meal_plans", key: "patient_id", article9: null },
  { name: "medical_certificates", key: "patient_id", article9: "core_phi" },
  { name: "medical_records", key: "patient_id", article9: "core_phi" },
  { name: "mobility_tests", key: "patient_id", article9: null },
  { name: "neuro_exam_records", key: "patient_id", article9: null },
  { name: "news2_scores", key: "patient_id", article9: "physical_health_invasive" },
  { name: "no_show_records", key: "patient_id", article9: null },
  { name: "no_show_stats", key: "patient_id", article9: null },
  { name: "nps_surveys", key: "patient_id", article9: null },
  { name: "odontogram", key: "patient_id", article9: null },
  { name: "optical_prescriptions", key: "patient_id", article9: "core_phi" },
  { name: "pain_questionnaires", key: "patient_id", article9: null },
  { name: "patient_acquisition_channels", key: "patient_id", article9: null },
  { name: "patient_feedback", key: "patient_id", article9: null },
  { name: "patient_packages", key: "patient_id", article9: null },
  { name: "patient_vitals", key: "patient_id", article9: null },
  { name: "payment_plans", key: "patient_id", article9: null },
  { name: "payment_reminders", key: "patient_id", article9: null },
  { name: "payments", key: "patient_id", article9: null },
  { name: "photo_consent_forms", key: "patient_id", article9: null },
  { name: "physio_sessions", key: "patient_id", article9: null },
  { name: "pregnancies", key: "patient_id", article9: "reproductive_sexual" },
  { name: "prescription_drafts", key: "patient_id", article9: null },
  { name: "prescription_renewal_requests", key: "patient_id", article9: null },
  { name: "prescription_renewals", key: "patient_id", article9: null },
  { name: "prescription_requests", key: "patient_id", article9: null },
  { name: "prescriptions", key: "patient_id", article9: "core_phi" },
  { name: "progress_photos", key: "patient_id", article9: "imaging_phi" },
  { name: "psych_medications", key: "patient_id", article9: "mental_health" },
  { name: "psych_session_notes", key: "patient_id", article9: "mental_health" },
  { name: "qr_checkin_tokens", key: "patient_id", article9: null },
  { name: "radiology_orders", key: "patient_id", article9: "imaging_phi" },
  { name: "referrals", key: "patient_id", article9: null },
  { name: "rehab_plans", key: "patient_id", article9: null },
  { name: "respiratory_tests", key: "patient_id", article9: "physical_health_invasive" },
  { name: "reviews", key: "patient_id", article9: null },
  { name: "sales", key: "patient_id", article9: null },
  { name: "skin_conditions", key: "patient_id", article9: null },
  { name: "skin_photos", key: "patient_id", article9: "imaging_phi" },
  { name: "speech_progress_reports", key: "patient_id", article9: "mental_health" },
  { name: "speech_sessions", key: "patient_id", article9: "mental_health" },
  { name: "spirometry_records", key: "patient_id", article9: "physical_health_invasive" },
  { name: "telemedicine_sessions", key: "patient_id", article9: "mental_health" },
  { name: "therapy_plans", key: "patient_id", article9: null },
  { name: "therapy_session_notes", key: "patient_id", article9: null },
  { name: "treatment_plans", key: "patient_id", article9: null },
  { name: "ultrasound_records", key: "patient_id", article9: "imaging_phi" },
  { name: "urology_exams", key: "patient_id", article9: "reproductive_sexual" },
  { name: "vaccinations", key: "patient_id", article9: null },
  { name: "vision_tests", key: "patient_id", article9: null },
  { name: "voice_notes", key: "patient_id", article9: "mental_health" },
  { name: "waiting_list", key: "patient_id", article9: null },
  { name: "waiting_queue", key: "patient_id", article9: null },
  { name: "whatsapp_consent", key: "patient_id", article9: null },
  { name: "whatsapp_conversations", key: "patient_id", article9: null },
  { name: "whatsapp_voice_transcriptions", key: "patient_id", article9: "mental_health" },
  { name: "xray_records", key: "patient_id", article9: "imaging_phi" },
] as const;

/** Tables keyed by `user_id` only (cross-role: includes operator surfaces) — 5 tables. */
export const USER_SCOPE_TABLES: readonly DsrTable[] = [
  { name: "ai_agent_conversations", key: "user_id", article9: null },
  { name: "consent_logs", key: "user_id", article9: null },
  { name: "documents", key: "user_id", article9: null },
  { name: "notifications", key: "user_id", article9: null },
  { name: "processing_consents", key: "user_id", article9: null },
] as const;

/** Tables keyed by `primary_user_id` — family / dependent linkage (1 tables). */
export const FAMILY_SCOPE_TABLES: readonly DsrTable[] = [
  { name: "family_members", key: "primary_user_id", article9: null },
] as const;

/** Convenience union: every DSR-scope table in stable, deterministic order. */
export const ALL_DSR_TABLES: readonly DsrTable[] = [
  ...PATIENT_SCOPE_TABLES,
  ...USER_SCOPE_TABLES,
  ...FAMILY_SCOPE_TABLES,
] as const;

// ---------------------------------------------------------------------------
// Per-Article action policy
// ---------------------------------------------------------------------------

/**
 * Columns on `users` that a subject can self-rectify under GDPR Art. 16 / Loi
 * 09-08 art. 7. Clinical fields are out of scope — those require a doctor.
 */
export const USER_RECTIFICATION_ALLOWED_COLUMNS: readonly string[] = [
  "name",
  "phone",
  "email",
] as const;

/**
 * Tables that MUST NOT be deleted in response to an Art. 17 erasure request
 * because they discharge a legal obligation (accounting, prescribing). Instead,
 * the subject's identifier is replaced with the tombstone sentinel and the
 * row is anonymised in place.
 *
 * Aligns with retention.md (e.g. payments = 10y for tax, prescriptions = 10y).
 */
export const ERASURE_ANONYMISE_INSTEAD: readonly string[] = [
  // Billing. Loi 09-08 art. 26(2) / Moroccan Code de Commerce art. 22
  // require 10-year retention. Anonymise the patient FK + free-text fields;
  // keep totals, tax IDs, and bookkeeping references.
  "payments",
  "invoices",
  "lab_invoices",
  // Prescriptions. Loi 17-04 (pharmacy code) requires the prescriber to
  // retain a copy for at least 10 years. Anonymise patient identifiers,
  // keep clinical content tied to the doctor's record.
  "prescriptions",
  // Medical certificates. Conseil National de l'Ordre des Medecins requires
  // 20-year retention of issued certificates for liability defence.
  "medical_certificates",
  // GDPR Art. 7(1). Proof of consent must be kept for the lifetime of the
  // processing relationship + statute of limitations. Anonymise the subject
  // FK, keep the consent record + timestamp + version.
  "consent_logs",
  // TODO(A62-followup): once the dedicated audit-log schema migration lands
  // (planned: immutable_audit_log, activity_logs, audit_logs), add them here.
  // They are anonymise-instead targets for the same GDPR Art. 17(3)(b/e)
  // reasons. The current catalog only references tables that exist in the
  // inventory at docs/compliance/_generated/pii-columns.json.
] as const;

/**
 * Sentinel user id used when anonymising rows in {@link ERASURE_ANONYMISE_INSTEAD}.
 * Created once by migration and referenced by all anonymised foreign keys.
 */
export const TOMBSTONE_USER_SENTINEL = "00000000-0000-0000-0000-000000000000" as const;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Article 9 subset across every scope, useful for export prioritisation. */
export const ARTICLE_9_DSR_TABLES: readonly DsrTable[] = ALL_DSR_TABLES.filter(
  (t): t is DsrTable => t.article9 !== null,
);

/** Quick boolean — does this table require anonymise-in-place on erasure? */
export function shouldAnonymiseOnErasure(table: string): boolean {
  return (ERASURE_ANONYMISE_INSTEAD as readonly string[]).includes(table);
}

/** Total table count exposed for the parity test against the JSON inventory. */
export const DSR_TABLE_COUNT = ALL_DSR_TABLES.length;
