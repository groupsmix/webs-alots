"use client";

/**
 * Data fetching & mutation helpers for medical specialist modules.
 * Tasks 9–15: Dermatologist, Cardiologist, ENT, Orthopedist,
 * Psychiatrist, Neurologist, and remaining specialists.
 */

import { createClient } from "@/lib/supabase-client";

// ── Generic fetch helper (mirrors client.ts) ──

async function fetchRows<T>(
  table: string,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
    order?: [string, { ascending: boolean }];
    limit?: number;
  },
): Promise<T[]> {
  const supabase = createClient();
  let q = supabase.from(table).select(opts?.select ?? "*");
  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val);
    }
  }
  if (opts?.order) q = q.order(opts.order[0], opts.order[1]);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.error(`[specialists] ${table}:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

// ═══════════════════════════════════════════════
// TASK 9: DERMATOLOGIST
// ═══════════════════════════════════════════════

export interface SkinPhotoView {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  bodyRegion: string;
  description: string;
  imageUrl: string;
  photoDate: string;
  tags: string[];
}

export async function fetchSkinPhotos(clinicId: string, patientId?: string): Promise<SkinPhotoView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; body_region: string;
    description: string | null; image_url: string | null; photo_date: string;
    tags: string[] | null; created_at: string; updated_at: string;
  }>("skin_photos", { eq, order: ["photo_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    doctorId: r.doctor_id,
    bodyRegion: r.body_region,
    description: r.description ?? "",
    imageUrl: r.image_url ?? "",
    photoDate: r.photo_date,
    tags: r.tags ?? [],
  }));
}

export async function createSkinPhoto(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  body_region: string; description?: string; image_url?: string;
  photo_date?: string; tags?: string[];
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("skin_photos").insert(data).select("id").single();
  if (error) { console.error("[specialists] create skin photo:", error.message); return null; }
  return result?.id ?? null;
}

export interface SkinConditionView {
  id: string;
  patientId: string;
  patientName: string;
  conditionName: string;
  bodyRegion: string;
  severity: string;
  status: string;
  diagnosisDate: string;
  notes: string;
  treatments: { name: string; startDate: string; endDate?: string; notes?: string }[];
}

export async function fetchSkinConditions(clinicId: string, patientId?: string): Promise<SkinConditionView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; condition_name: string; body_region: string;
    severity: string | null; status: string; diagnosis_date: string; notes: string | null;
    treatments: { name: string; startDate: string; endDate?: string; notes?: string }[] | null;
    created_at: string; updated_at: string;
  }>("skin_conditions", { eq, order: ["diagnosis_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    conditionName: r.condition_name,
    bodyRegion: r.body_region,
    severity: r.severity ?? "mild",
    status: r.status,
    diagnosisDate: r.diagnosis_date,
    notes: r.notes ?? "",
    treatments: r.treatments ?? [],
  }));
}

export async function createSkinCondition(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  condition_name: string; body_region: string; severity?: string;
  notes?: string; treatments?: unknown[];
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("skin_conditions").insert(data).select("id").single();
  if (error) { console.error("[specialists] create skin condition:", error.message); return null; }
  return result?.id ?? null;
}

export async function updateSkinCondition(
  id: string,
  data: { status?: string; severity?: string; notes?: string; treatments?: unknown[] },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("skin_conditions")
    .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("[specialists] update skin condition:", error.message); return false; }
  return true;
}

// ═══════════════════════════════════════════════
// TASK 10: CARDIOLOGIST
// ═══════════════════════════════════════════════

export interface ECGRecordView {
  id: string;
  patientId: string;
  patientName: string;
  recordDate: string;
  fileUrl: string;
  heartRate: number | null;
  rhythm: string;
  interpretation: string;
  notes: string;
  isAbnormal: boolean;
}

export async function fetchECGRecords(clinicId: string, patientId?: string): Promise<ECGRecordView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; record_date: string; file_url: string | null;
    heart_rate: number | null; rhythm: string | null; interpretation: string | null;
    notes: string | null; is_abnormal: boolean; created_at: string;
  }>("ecg_records", { eq, order: ["record_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    recordDate: r.record_date,
    fileUrl: r.file_url ?? "",
    heartRate: r.heart_rate,
    rhythm: r.rhythm ?? "",
    interpretation: r.interpretation ?? "",
    notes: r.notes ?? "",
    isAbnormal: r.is_abnormal ?? false,
  }));
}

export async function createECGRecord(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  record_date?: string; file_url?: string; heart_rate?: number;
  rhythm?: string; interpretation?: string; notes?: string; is_abnormal?: boolean;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("ecg_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create ECG record:", error.message); return null; }
  return result?.id ?? null;
}

export interface BloodPressureView {
  id: string;
  patientId: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  readingDate: string;
  position: string;
  arm: string;
  notes: string;
}

export async function fetchBloodPressureReadings(clinicId: string, patientId?: string): Promise<BloodPressureView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; systolic: number; diastolic: number;
    heart_rate: number | null; reading_date: string; position: string | null;
    arm: string | null; notes: string | null; created_at: string;
  }>("blood_pressure_readings", { eq, order: ["reading_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    systolic: r.systolic,
    diastolic: r.diastolic,
    heartRate: r.heart_rate,
    readingDate: r.reading_date,
    position: r.position ?? "sitting",
    arm: r.arm ?? "left",
    notes: r.notes ?? "",
  }));
}

export async function createBloodPressureReading(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  systolic: number; diastolic: number; heart_rate?: number;
  position?: string; arm?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("blood_pressure_readings").insert(data).select("id").single();
  if (error) { console.error("[specialists] create BP reading:", error.message); return null; }
  return result?.id ?? null;
}

export interface HeartMonitoringNoteView {
  id: string;
  patientId: string;
  noteDate: string;
  category: string;
  title: string;
  content: string;
  severity: string;
  isAlert: boolean;
}

export async function fetchHeartMonitoringNotes(clinicId: string, patientId?: string): Promise<HeartMonitoringNoteView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; note_date: string; category: string;
    title: string; content: string | null; severity: string; is_alert: boolean; created_at: string;
  }>("heart_monitoring_notes", { eq, order: ["note_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    noteDate: r.note_date,
    category: r.category,
    title: r.title,
    content: r.content ?? "",
    severity: r.severity,
    isAlert: r.is_alert ?? false,
  }));
}

export async function createHeartMonitoringNote(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  title: string; content?: string; category?: string;
  severity?: string; is_alert?: boolean;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("heart_monitoring_notes").insert(data).select("id").single();
  if (error) { console.error("[specialists] create heart note:", error.message); return null; }
  return result?.id ?? null;
}

// ═══════════════════════════════════════════════
// TASK 11: ENT SPECIALIST
// ═══════════════════════════════════════════════

export interface HearingTestView {
  id: string;
  patientId: string;
  patientName: string;
  testDate: string;
  testType: string;
  leftEarData: Record<string, number>;
  rightEarData: Record<string, number>;
  interpretation: string;
  hearingLossType: string;
  hearingLossDegree: string;
  notes: string;
}

export async function fetchHearingTests(clinicId: string, patientId?: string): Promise<HearingTestView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; test_date: string; test_type: string;
    left_ear_data: Record<string, number> | null; right_ear_data: Record<string, number> | null;
    interpretation: string | null; hearing_loss_type: string | null;
    hearing_loss_degree: string | null; notes: string | null; created_at: string;
  }>("hearing_tests", { eq, order: ["test_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    testDate: r.test_date,
    testType: r.test_type,
    leftEarData: r.left_ear_data ?? {},
    rightEarData: r.right_ear_data ?? {},
    interpretation: r.interpretation ?? "",
    hearingLossType: r.hearing_loss_type ?? "",
    hearingLossDegree: r.hearing_loss_degree ?? "",
    notes: r.notes ?? "",
  }));
}

export async function createHearingTest(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  test_type?: string; left_ear_data?: Record<string, number>;
  right_ear_data?: Record<string, number>; interpretation?: string;
  hearing_loss_type?: string; hearing_loss_degree?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("hearing_tests").insert(data).select("id").single();
  if (error) { console.error("[specialists] create hearing test:", error.message); return null; }
  return result?.id ?? null;
}

export interface ENTExamView {
  id: string;
  patientId: string;
  patientName: string;
  examDate: string;
  templateType: string;
  findings: Record<string, string>;
  diagnosis: string;
  plan: string;
}

export async function fetchENTExams(clinicId: string, patientId?: string): Promise<ENTExamView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; exam_date: string; template_type: string;
    findings: Record<string, string> | null; diagnosis: string | null; plan: string | null; created_at: string;
  }>("ent_exam_records", { eq, order: ["exam_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    examDate: r.exam_date,
    templateType: r.template_type,
    findings: r.findings ?? {},
    diagnosis: r.diagnosis ?? "",
    plan: r.plan ?? "",
  }));
}

export async function createENTExam(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  template_type?: string; findings?: Record<string, string>;
  diagnosis?: string; plan?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("ent_exam_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create ENT exam:", error.message); return null; }
  return result?.id ?? null;
}

// ═══════════════════════════════════════════════
// TASK 12: ORTHOPEDIST
// ═══════════════════════════════════════════════

export interface XRayRecordView {
  id: string;
  patientId: string;
  patientName: string;
  recordDate: string;
  bodyPart: string;
  imageUrl: string;
  annotations: { x: number; y: number; label: string }[];
  findings: string;
  diagnosis: string;
}

export async function fetchXRayRecords(clinicId: string, patientId?: string): Promise<XRayRecordView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; record_date: string; body_part: string;
    image_url: string | null; annotations: { x: number; y: number; label: string }[] | null;
    findings: string | null; diagnosis: string | null; created_at: string;
  }>("xray_records", { eq, order: ["record_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    recordDate: r.record_date,
    bodyPart: r.body_part,
    imageUrl: r.image_url ?? "",
    annotations: r.annotations ?? [],
    findings: r.findings ?? "",
    diagnosis: r.diagnosis ?? "",
  }));
}

export async function createXRayRecord(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  body_part: string; image_url?: string; annotations?: unknown[];
  findings?: string; diagnosis?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("xray_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create X-ray record:", error.message); return null; }
  return result?.id ?? null;
}

export interface FractureRecordView {
  id: string;
  patientId: string;
  patientName: string;
  location: string;
  fractureType: string;
  severity: string;
  status: string;
  injuryDate: string;
  diagnosisDate: string;
  expectedHealingDate: string;
  notes: string;
  xrayRecordId: string;
}

export async function fetchFractureRecords(clinicId: string, patientId?: string): Promise<FractureRecordView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; location: string; fracture_type: string;
    severity: string; status: string; injury_date: string; diagnosis_date: string;
    expected_healing_date: string | null; notes: string | null;
    xray_record_id: string | null; created_at: string; updated_at: string;
  }>("fracture_records", { eq, order: ["diagnosis_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    location: r.location,
    fractureType: r.fracture_type,
    severity: r.severity,
    status: r.status,
    injuryDate: r.injury_date,
    diagnosisDate: r.diagnosis_date,
    expectedHealingDate: r.expected_healing_date ?? "",
    notes: r.notes ?? "",
    xrayRecordId: r.xray_record_id ?? "",
  }));
}

export async function createFractureRecord(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  location: string; fracture_type: string; severity?: string;
  injury_date: string; expected_healing_date?: string; notes?: string;
  xray_record_id?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("fracture_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create fracture record:", error.message); return null; }
  return result?.id ?? null;
}

export async function updateFractureRecord(
  id: string,
  data: { status?: string; notes?: string; expected_healing_date?: string },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("fracture_records")
    .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("[specialists] update fracture record:", error.message); return false; }
  return true;
}

export interface RehabPlanView {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  condition: string;
  startDate: string;
  targetEndDate: string;
  status: string;
  milestones: { title: string; targetDate: string; completed: boolean; notes?: string }[];
  notes: string;
}

export async function fetchRehabPlans(clinicId: string, patientId?: string): Promise<RehabPlanView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; title: string; condition: string;
    start_date: string; target_end_date: string | null; status: string;
    milestones: { title: string; targetDate: string; completed: boolean; notes?: string }[] | null;
    notes: string | null; created_at: string; updated_at: string;
  }>("rehab_plans", { eq, order: ["start_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    title: r.title,
    condition: r.condition,
    startDate: r.start_date,
    targetEndDate: r.target_end_date ?? "",
    status: r.status,
    milestones: r.milestones ?? [],
    notes: r.notes ?? "",
  }));
}

export async function createRehabPlan(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  title: string; condition: string; start_date?: string;
  target_end_date?: string; milestones?: unknown[]; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("rehab_plans").insert(data).select("id").single();
  if (error) { console.error("[specialists] create rehab plan:", error.message); return null; }
  return result?.id ?? null;
}

export async function updateRehabPlan(
  id: string,
  data: { status?: string; milestones?: unknown[]; notes?: string; target_end_date?: string },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("rehab_plans")
    .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("[specialists] update rehab plan:", error.message); return false; }
  return true;
}

// ═══════════════════════════════════════════════
// TASK 13: PSYCHIATRIST
// ═══════════════════════════════════════════════

export interface PsychSessionNoteView {
  id: string;
  patientId: string;
  patientName: string;
  sessionDate: string;
  sessionNumber: number;
  sessionType: string;
  moodRating: number | null;
  content: string;
  observations: string;
  plan: string;
  isConfidential: boolean;
  accessLevel: string;
}

export async function fetchPsychSessionNotes(clinicId: string, doctorId: string, patientId?: string): Promise<PsychSessionNoteView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId], ["doctor_id", doctorId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; session_date: string; session_number: number;
    session_type: string; mood_rating: number | null; content: string | null;
    observations: string | null; plan: string | null; is_confidential: boolean;
    access_level: string; created_at: string;
  }>("psych_session_notes", { eq, order: ["session_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    sessionDate: r.session_date,
    sessionNumber: r.session_number,
    sessionType: r.session_type,
    moodRating: r.mood_rating,
    content: r.content ?? "",
    observations: r.observations ?? "",
    plan: r.plan ?? "",
    isConfidential: r.is_confidential,
    accessLevel: r.access_level,
  }));
}

export async function createPsychSessionNote(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  session_number?: number; session_type?: string; mood_rating?: number;
  content?: string; observations?: string; plan?: string;
  is_confidential?: boolean; access_level?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("psych_session_notes").insert(data).select("id").single();
  if (error) { console.error("[specialists] create psych note:", error.message); return null; }
  return result?.id ?? null;
}

export interface PsychMedicationView {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string;
  sideEffects: string;
  notes: string;
  dosageHistory: { date: string; dosage: string; reason?: string }[];
}

export async function fetchPsychMedications(clinicId: string, patientId?: string): Promise<PsychMedicationView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; medication_name: string; dosage: string;
    frequency: string; start_date: string; end_date: string | null; status: string;
    reason: string | null; side_effects: string | null; notes: string | null;
    dosage_history: { date: string; dosage: string; reason?: string }[] | null;
    created_at: string; updated_at: string;
  }>("psych_medications", { eq, order: ["start_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    medicationName: r.medication_name,
    dosage: r.dosage,
    frequency: r.frequency,
    startDate: r.start_date,
    endDate: r.end_date ?? "",
    status: r.status,
    reason: r.reason ?? "",
    sideEffects: r.side_effects ?? "",
    notes: r.notes ?? "",
    dosageHistory: r.dosage_history ?? [],
  }));
}

export async function createPsychMedication(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  medication_name: string; dosage: string; frequency: string;
  reason?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("psych_medications").insert(data).select("id").single();
  if (error) { console.error("[specialists] create psych medication:", error.message); return null; }
  return result?.id ?? null;
}

export async function updatePsychMedication(
  id: string,
  data: { status?: string; dosage?: string; end_date?: string; notes?: string; side_effects?: string; dosage_history?: unknown[] },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("psych_medications")
    .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("[specialists] update psych medication:", error.message); return false; }
  return true;
}

// ═══════════════════════════════════════════════
// TASK 14: NEUROLOGIST
// ═══════════════════════════════════════════════

export interface EEGRecordView {
  id: string;
  patientId: string;
  patientName: string;
  recordDate: string;
  fileUrl: string;
  durationMinutes: number | null;
  findings: string;
  interpretation: string;
  isAbnormal: boolean;
  notes: string;
}

export async function fetchEEGRecords(clinicId: string, patientId?: string): Promise<EEGRecordView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; record_date: string; file_url: string | null;
    duration_minutes: number | null; findings: string | null;
    interpretation: string | null; is_abnormal: boolean; notes: string | null; created_at: string;
  }>("eeg_records", { eq, order: ["record_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    recordDate: r.record_date,
    fileUrl: r.file_url ?? "",
    durationMinutes: r.duration_minutes,
    findings: r.findings ?? "",
    interpretation: r.interpretation ?? "",
    isAbnormal: r.is_abnormal ?? false,
    notes: r.notes ?? "",
  }));
}

export async function createEEGRecord(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  record_date?: string; file_url?: string; duration_minutes?: number;
  findings?: string; interpretation?: string; is_abnormal?: boolean; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("eeg_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create EEG record:", error.message); return null; }
  return result?.id ?? null;
}

export interface NeuroExamView {
  id: string;
  patientId: string;
  patientName: string;
  examDate: string;
  mentalStatus: Record<string, string>;
  cranialNerves: Record<string, string>;
  motorFunction: Record<string, string>;
  sensoryFunction: Record<string, string>;
  reflexes: Record<string, string>;
  coordination: Record<string, string>;
  gait: Record<string, string>;
  diagnosis: string;
  plan: string;
  notes: string;
}

export async function fetchNeuroExams(clinicId: string, patientId?: string): Promise<NeuroExamView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; exam_date: string;
    mental_status: Record<string, string> | null; cranial_nerves: Record<string, string> | null;
    motor_function: Record<string, string> | null; sensory_function: Record<string, string> | null;
    reflexes: Record<string, string> | null; coordination: Record<string, string> | null;
    gait: Record<string, string> | null; diagnosis: string | null;
    plan: string | null; notes: string | null; created_at: string;
  }>("neuro_exam_records", { eq, order: ["exam_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    examDate: r.exam_date,
    mentalStatus: r.mental_status ?? {},
    cranialNerves: r.cranial_nerves ?? {},
    motorFunction: r.motor_function ?? {},
    sensoryFunction: r.sensory_function ?? {},
    reflexes: r.reflexes ?? {},
    coordination: r.coordination ?? {},
    gait: r.gait ?? {},
    diagnosis: r.diagnosis ?? "",
    plan: r.plan ?? "",
    notes: r.notes ?? "",
  }));
}

export async function createNeuroExam(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  mental_status?: Record<string, string>; cranial_nerves?: Record<string, string>;
  motor_function?: Record<string, string>; sensory_function?: Record<string, string>;
  reflexes?: Record<string, string>; coordination?: Record<string, string>;
  gait?: Record<string, string>; diagnosis?: string; plan?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("neuro_exam_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create neuro exam:", error.message); return null; }
  return result?.id ?? null;
}

// ═══════════════════════════════════════════════
// TASK 15: REMAINING SPECIALISTS
// ═══════════════════════════════════════════════

// -- Urologist --

export interface UrologyExamView {
  id: string;
  patientId: string;
  patientName: string;
  examDate: string;
  templateType: string;
  findings: Record<string, string>;
  labResults: Record<string, string>;
  diagnosis: string;
  plan: string;
}

export async function fetchUrologyExams(clinicId: string, patientId?: string): Promise<UrologyExamView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; exam_date: string; template_type: string;
    findings: Record<string, string> | null; lab_results: Record<string, string> | null;
    diagnosis: string | null; plan: string | null; created_at: string;
  }>("urology_exams", { eq, order: ["exam_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    examDate: r.exam_date,
    templateType: r.template_type,
    findings: r.findings ?? {},
    labResults: r.lab_results ?? {},
    diagnosis: r.diagnosis ?? "",
    plan: r.plan ?? "",
  }));
}

export async function createUrologyExam(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  template_type?: string; findings?: Record<string, string>;
  lab_results?: Record<string, string>; diagnosis?: string; plan?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("urology_exams").insert(data).select("id").single();
  if (error) { console.error("[specialists] create urology exam:", error.message); return null; }
  return result?.id ?? null;
}

// -- Pulmonologist --

export interface SpirometryRecordView {
  id: string;
  patientId: string;
  patientName: string;
  testDate: string;
  fvc: number | null;
  fev1: number | null;
  fev1FvcRatio: number | null;
  pef: number | null;
  interpretation: string;
  testQuality: string;
  notes: string;
}

export async function fetchSpirometryRecords(clinicId: string, patientId?: string): Promise<SpirometryRecordView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; test_date: string;
    fvc: number | null; fev1: number | null; fev1_fvc_ratio: number | null;
    pef: number | null; interpretation: string | null;
    test_quality: string; notes: string | null; created_at: string;
  }>("spirometry_records", { eq, order: ["test_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    testDate: r.test_date,
    fvc: r.fvc,
    fev1: r.fev1,
    fev1FvcRatio: r.fev1_fvc_ratio,
    pef: r.pef,
    interpretation: r.interpretation ?? "",
    testQuality: r.test_quality,
    notes: r.notes ?? "",
  }));
}

export async function createSpirometryRecord(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  fvc?: number; fev1?: number; fev1_fvc_ratio?: number; pef?: number;
  interpretation?: string; test_quality?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("spirometry_records").insert(data).select("id").single();
  if (error) { console.error("[specialists] create spirometry:", error.message); return null; }
  return result?.id ?? null;
}

export interface RespiratoryTestView {
  id: string;
  patientId: string;
  testDate: string;
  testType: string;
  results: Record<string, unknown>;
  interpretation: string;
  notes: string;
}

export async function fetchRespiratoryTests(clinicId: string, patientId?: string): Promise<RespiratoryTestView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; test_date: string; test_type: string;
    results: Record<string, unknown> | null; interpretation: string | null; notes: string | null; created_at: string;
  }>("respiratory_tests", { eq, order: ["test_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    testDate: r.test_date,
    testType: r.test_type,
    results: r.results ?? {},
    interpretation: r.interpretation ?? "",
    notes: r.notes ?? "",
  }));
}

export async function createRespiratoryTest(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  test_type: string; results?: Record<string, unknown>;
  interpretation?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("respiratory_tests").insert(data).select("id").single();
  if (error) { console.error("[specialists] create respiratory test:", error.message); return null; }
  return result?.id ?? null;
}

// -- Endocrinologist --

export interface BloodSugarReadingView {
  id: string;
  patientId: string;
  readingDate: string;
  glucoseLevel: number;
  readingType: string;
  unit: string;
  notes: string;
}

export async function fetchBloodSugarReadings(clinicId: string, patientId?: string): Promise<BloodSugarReadingView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; reading_date: string;
    glucose_level: number; reading_type: string; unit: string; notes: string | null; created_at: string;
  }>("blood_sugar_readings", { eq, order: ["reading_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    readingDate: r.reading_date,
    glucoseLevel: r.glucose_level,
    readingType: r.reading_type,
    unit: r.unit,
    notes: r.notes ?? "",
  }));
}

export async function createBloodSugarReading(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  glucose_level: number; reading_type?: string; unit?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("blood_sugar_readings").insert(data).select("id").single();
  if (error) { console.error("[specialists] create blood sugar:", error.message); return null; }
  return result?.id ?? null;
}

export interface HormoneLevelView {
  id: string;
  patientId: string;
  testDate: string;
  hormoneName: string;
  value: number;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  notes: string;
}

export async function fetchHormoneLevels(clinicId: string, patientId?: string): Promise<HormoneLevelView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; test_date: string; hormone_name: string;
    value: number; unit: string; reference_range: string | null;
    is_abnormal: boolean; notes: string | null; created_at: string;
  }>("hormone_levels", { eq, order: ["test_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    testDate: r.test_date,
    hormoneName: r.hormone_name,
    value: r.value,
    unit: r.unit,
    referenceRange: r.reference_range ?? "",
    isAbnormal: r.is_abnormal ?? false,
    notes: r.notes ?? "",
  }));
}

export async function createHormoneLevel(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  hormone_name: string; value: number; unit: string;
  reference_range?: string; is_abnormal?: boolean; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("hormone_levels").insert(data).select("id").single();
  if (error) { console.error("[specialists] create hormone level:", error.message); return null; }
  return result?.id ?? null;
}

export interface DiabetesManagementView {
  id: string;
  patientId: string;
  patientName: string;
  diabetesType: string;
  diagnosisDate: string;
  currentHba1c: number | null;
  targetHba1c: number;
  medications: { name: string; dosage: string; frequency: string }[];
  dietPlan: string;
  exercisePlan: string;
  monitoringFrequency: string;
  notes: string;
  lastReviewDate: string;
}

export async function fetchDiabetesManagement(clinicId: string, patientId?: string): Promise<DiabetesManagementView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; diabetes_type: string; diagnosis_date: string | null;
    current_hba1c: number | null; target_hba1c: number;
    medications: { name: string; dosage: string; frequency: string }[] | null;
    diet_plan: string | null; exercise_plan: string | null;
    monitoring_frequency: string; notes: string | null; last_review_date: string | null;
    created_at: string; updated_at: string;
  }>("diabetes_management", { eq, order: ["created_at", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    diabetesType: r.diabetes_type,
    diagnosisDate: r.diagnosis_date ?? "",
    currentHba1c: r.current_hba1c,
    targetHba1c: r.target_hba1c,
    medications: r.medications ?? [],
    dietPlan: r.diet_plan ?? "",
    exercisePlan: r.exercise_plan ?? "",
    monitoringFrequency: r.monitoring_frequency,
    notes: r.notes ?? "",
    lastReviewDate: r.last_review_date ?? "",
  }));
}

export async function createDiabetesManagement(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  diabetes_type: string; diagnosis_date?: string; current_hba1c?: number;
  target_hba1c?: number; medications?: unknown[];
  diet_plan?: string; exercise_plan?: string; monitoring_frequency?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("diabetes_management").insert(data).select("id").single();
  if (error) { console.error("[specialists] create diabetes mgmt:", error.message); return null; }
  return result?.id ?? null;
}

export async function updateDiabetesManagement(
  id: string,
  data: { current_hba1c?: number; medications?: unknown[]; diet_plan?: string;
    exercise_plan?: string; notes?: string; last_review_date?: string },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("diabetes_management")
    .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { console.error("[specialists] update diabetes mgmt:", error.message); return false; }
  return true;
}

// -- Rheumatologist --

export interface JointAssessmentView {
  id: string;
  patientId: string;
  patientName: string;
  assessmentDate: string;
  jointsData: Record<string, { swollen: boolean; tender: boolean; notes?: string }>;
  vasPainScore: number | null;
  morningStiffnessMinutes: number | null;
  swollenJointCount: number;
  tenderJointCount: number;
  das28Score: number | null;
  functionalStatus: string;
  notes: string;
}

export async function fetchJointAssessments(clinicId: string, patientId?: string): Promise<JointAssessmentView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; assessment_date: string;
    joints_data: Record<string, { swollen: boolean; tender: boolean; notes?: string }> | null;
    vas_pain_score: number | null; morning_stiffness_minutes: number | null;
    swollen_joint_count: number; tender_joint_count: number;
    das28_score: number | null; functional_status: string | null; notes: string | null;
    created_at: string;
  }>("joint_assessments", { eq, order: ["assessment_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",
    assessmentDate: r.assessment_date,
    jointsData: r.joints_data ?? {},
    vasPainScore: r.vas_pain_score,
    morningStiffnessMinutes: r.morning_stiffness_minutes,
    swollenJointCount: r.swollen_joint_count,
    tenderJointCount: r.tender_joint_count,
    das28Score: r.das28_score,
    functionalStatus: r.functional_status ?? "",
    notes: r.notes ?? "",
  }));
}

export async function createJointAssessment(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  joints_data?: Record<string, unknown>; vas_pain_score?: number;
  morning_stiffness_minutes?: number; swollen_joint_count?: number;
  tender_joint_count?: number; das28_score?: number;
  functional_status?: string; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("joint_assessments").insert(data).select("id").single();
  if (error) { console.error("[specialists] create joint assessment:", error.message); return null; }
  return result?.id ?? null;
}

export interface MobilityTestView {
  id: string;
  patientId: string;
  testDate: string;
  testType: string;
  joint: string;
  rangeOfMotion: Record<string, number>;
  strengthScore: number | null;
  painDuringTest: number | null;
  notes: string;
}

export async function fetchMobilityTests(clinicId: string, patientId?: string): Promise<MobilityTestView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{
    id: string; clinic_id: string; patient_id: string; doctor_id: string; test_date: string; test_type: string;
    joint: string; range_of_motion: Record<string, number> | null;
    strength_score: number | null; pain_during_test: number | null; notes: string | null; created_at: string;
  }>("mobility_tests", { eq, order: ["test_date", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    testDate: r.test_date,
    testType: r.test_type,
    joint: r.joint,
    rangeOfMotion: r.range_of_motion ?? {},
    strengthScore: r.strength_score,
    painDuringTest: r.pain_during_test,
    notes: r.notes ?? "",
  }));
}

export async function createMobilityTest(data: {
  clinic_id: string; patient_id: string; doctor_id: string;
  test_type: string; joint: string; range_of_motion?: Record<string, number>;
  strength_score?: number; pain_during_test?: number; notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("mobility_tests").insert(data).select("id").single();
  if (error) { console.error("[specialists] create mobility test:", error.message); return null; }
  return result?.id ?? null;
}
