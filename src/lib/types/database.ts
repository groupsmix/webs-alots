/**
 * Supabase Database Types
 *
 * Manually maintained types matching the SQL schema.
 * Regenerate with `supabase gen types typescript` when connected to a live project.
 */

// ---- Enums ----

export type UserRole =
  | "super_admin"
  | "clinic_admin"
  | "receptionist"
  | "doctor"
  | "patient";

export type ClinicType = "doctor" | "dentist" | "pharmacy";

export type ClinicTypeCategory =
  | "medical"
  | "para_medical"
  | "diagnostic"
  | "pharmacy_retail"
  | "clinics_centers";

export type ClinicTier = "vitrine" | "cabinet" | "pro" | "premium" | "saas";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export type BookingSource = "online" | "phone" | "walk_in" | "whatsapp";

export type PaymentMethod = "cash" | "card" | "transfer" | "online";

export type PaymentStatus = "pending" | "completed" | "refunded" | "failed";

export type NotificationChannel = "whatsapp" | "email" | "sms" | "in_app";

export type DocumentType =
  | "prescription"
  | "lab_result"
  | "xray"
  | "insurance"
  | "invoice"
  | "photo"
  | "other";

export type WaitingListStatus = "waiting" | "notified" | "booked" | "expired";

export type ToothStatus =
  | "healthy"
  | "decayed"
  | "filled"
  | "missing"
  | "crown"
  | "implant"
  | "root_canal"
  | "extraction_needed";

export type TreatmentPlanStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LabOrderStatus =
  | "pending"
  | "sent"
  | "in_progress"
  | "ready"
  | "delivered";

export type InstallmentStatus = "pending" | "paid" | "overdue";

export type PrescriptionRequestStatus =
  | "pending"
  | "reviewing"
  | "ready"
  | "partial"
  | "delivered"
  | "cancelled";

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "cancelled";

// ---- Row types ----

export type ClinicStatus = "active" | "inactive" | "suspended";

export interface ClinicTypeRecord {
  id: string;
  type_key: string;
  name_fr: string;
  name_ar: string;
  category: ClinicTypeCategory;
  icon: string;
  features_config: Record<string, boolean>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Clinic {
  id: string;
  name: string;
  type: ClinicType;
  tier: ClinicTier;
  subdomain: string | null;
  domain: string | null;
  clinic_type_key: string | null;
  config: Record<string, unknown>;
  status: ClinicStatus;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  city: string | null;
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_id: string | null;
  clinic_id: string | null;
  role: UserRole;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number | null;
  is_active: boolean;
  created_at: string;
}

export interface TimeSlot {
  id: string;
  clinic_id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  buffer_min: number;
  is_active: boolean;
}

export type RecurrencePattern = "weekly" | "biweekly" | "monthly";

export type PaymentType = "deposit" | "full";

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  is_first_visit: boolean;
  is_walk_in: boolean;
  insurance_flag: boolean;
  booking_source: BookingSource;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rescheduled_from: string | null;
  is_emergency: boolean;
  recurrence_group_id: string | null;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface WaitingListEntry {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  preferred_date: string | null;
  preferred_time: string | null;
  service_id: string | null;
  status: WaitingListStatus;
  notified_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  clinic_id: string;
  user_id: string;
  type: string;
  channel: NotificationChannel;
  title: string | null;
  body: string | null;
  is_read: boolean;
  sent_at: string;
}

export interface Payment {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  reference: string | null;
  payment_type: PaymentType;
  gateway_session_id: string | null;
  refunded_amount: number;
  created_at: string;
}

export interface Review {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  stars: number;
  comment: string | null;
  response: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  clinic_id: string;
  user_id: string;
  type: DocumentType;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export interface ClinicHoliday {
  id: string;
  clinic_id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

// ---- Doctor Extras ----

export interface ConsultationNote {
  id: string;
  clinic_id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  notes: string | null;
  diagnosis: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  doctor_id: string;
  patient_id: string;
  items: PrescriptionItem[];
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface PrescriptionItem {
  name: string;
  dosage: string;
  duration: string;
}

export interface FamilyMember {
  id: string;
  primary_user_id: string;
  member_user_id: string;
  relationship: string;
  created_at: string;
}

// ---- Dentist Extras ----

export interface OdontogramEntry {
  id: string;
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  status: ToothStatus;
  notes: string | null;
  updated_at: string;
}

export interface TreatmentPlan {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  steps: TreatmentStep[];
  total_cost: number | null;
  status: TreatmentPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface TreatmentStep {
  step: number;
  description: string;
  status: "pending" | "in_progress" | "completed";
  date: string | null;
}

export interface LabOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  lab_name: string | null;
  description: string;
  status: LabOrderStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  clinic_id: string;
  treatment_plan_id: string;
  patient_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: InstallmentStatus;
  receipt_url: string | null;
  created_at: string;
}

export type SterilizationMethod = "autoclave" | "chemical" | "dry_heat";

export interface SterilizationLogEntry {
  id: string;
  clinic_id: string;
  tool_name: string;
  sterilized_by: string | null;
  sterilized_at: string;
  next_due: string | null;
  method: SterilizationMethod;
  notes: string | null;
  created_at: string;
}

// ---- Advanced Booking Extras ----

export interface EmergencySlot {
  id: string;
  clinic_id: string;
  doctor_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_booked: boolean;
  created_at: string;
}

export interface AppointmentDoctor {
  id: string;
  appointment_id: string;
  doctor_id: string;
  is_primary: boolean;
  created_at: string;
}

// ---- Pharmacy Extras ----

export interface Product {
  id: string;
  clinic_id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string;
  requires_prescription: boolean;
  manufacturer: string | null;
  barcode: string | null;
  dosage_form: string | null;
  strength: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StockEntry {
  id: string;
  clinic_id: string;
  product_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
  updated_at: string;
}

export interface Supplier {
  id: string;
  clinic_id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_person: string | null;
  address: string | null;
  city: string | null;
  categories: string[];
  rating: number;
  payment_terms: string | null;
  delivery_days: number;
  is_active: boolean;
  created_at: string;
}

export interface PrescriptionRequest {
  id: string;
  clinic_id: string;
  patient_id: string;
  image_url: string;
  status: PrescriptionRequestStatus;
  notes: string | null;
  delivery_requested: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPoints {
  id: string;
  clinic_id: string;
  patient_id: string;
  points: number;
  available_points: number;
  redeemed_points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  referral_code: string | null;
  referred_by: string | null;
  total_purchases: number;
  date_of_birth: string | null;
  birthday_reward_claimed: boolean;
  birthday_reward_year: number | null;
  last_earned: string | null;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransactionType = "earned" | "redeemed" | "birthday_bonus" | "referral_bonus" | "expired";

export interface LoyaltyTransaction {
  id: string;
  clinic_id: string;
  patient_id: string;
  points: number;
  type: LoyaltyTransactionType;
  reason: string | null;
  description: string | null;
  sale_id: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  clinic_id: string;
  supplier_id: string;
  supplier_name: string | null;
  status: PurchaseOrderStatus;
  total_amount: number | null;
  currency: string;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  expected_delivery: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  created_at: string;
}

// ---- New Tables (Migration 00005) ----

export type AnnouncementType = "info" | "warning" | "critical";

export type ActivityLogType = "clinic" | "billing" | "feature" | "announcement" | "template" | "auth";

export type PlatformBillingStatus = "paid" | "pending" | "overdue" | "cancelled";

export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "suspended";

export type SubscriptionBillingCycle = "monthly" | "yearly";

export type TierSlug = "vitrine" | "cabinet" | "pro" | "premium" | "saas-monthly";

export type SystemType = "doctor" | "dentist" | "pharmacy";

export type FeatureToggleCategory = "core" | "communication" | "integration" | "advanced" | "pharmacy";

export type SalePaymentMethod = "cash" | "card" | "insurance";

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface BlogPost {
  id: string;
  clinic_id: string | null;
  title: string;
  excerpt: string | null;
  content: string | null;
  date: string;
  read_time: string | null;
  category: string | null;
  slug: string | null;
  is_published: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  target: string;
  target_label: string | null;
  published_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  timestamp: string;
  actor: string | null;
  type: ActivityLogType;
  created_at: string;
}

export interface PlatformBilling {
  id: string;
  clinic_id: string;
  clinic_name: string | null;
  plan: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: PlatformBillingStatus;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string | null;
  key: string;
  category: "core" | "communication" | "integration" | "advanced";
  available_tiers: string[];
  global_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicFeatureOverride {
  id: string;
  clinic_id: string;
  feature_id: string;
  enabled: boolean;
  created_at: string;
}

export interface PricingTier {
  id: string;
  slug: TierSlug;
  name: string;
  description: string | null;
  is_popular: boolean;
  pricing: Record<string, unknown>;
  features: Record<string, unknown>[];
  limits: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  clinic_id: string;
  clinic_name: string | null;
  system_type: SystemType;
  tier_slug: string;
  tier_name: string | null;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  billing_cycle: SubscriptionBillingCycle;
  amount: number;
  currency: string;
  payment_method: string | null;
  auto_renew: boolean;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInvoice {
  id: string;
  subscription_id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paid_date: string | null;
  download_url: string | null;
  created_at: string;
}

export interface FeatureToggle {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: FeatureToggleCategory;
  system_types: string[];
  tiers: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  clinic_id: string;
  date: string;
  time: string;
  patient_id: string | null;
  patient_name: string | null;
  items: Record<string, unknown>[];
  total: number;
  currency: string;
  payment_method: SalePaymentMethod;
  has_prescription: boolean;
  loyalty_points_earned: number;
  created_at: string;
}

export interface OnDutySchedule {
  id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_on_duty: boolean;
  notes: string | null;
  created_at: string;
}

export interface BeforeAfterPhoto {
  id: string;
  clinic_id: string;
  patient_id: string;
  treatment_plan_id: string | null;
  description: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  before_date: string | null;
  after_date: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface PainQuestionnaire {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  pain_level: number;
  pain_location: string | null;
  pain_duration: string | null;
  pain_type: string | null;
  triggers: string[];
  has_swelling: boolean;
  has_bleeding: boolean;
  additional_notes: string | null;
  created_at: string;
}

// ---- Para-Medical Extras ----

export interface ExerciseProgramRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  title: string;
  exercises: Record<string, unknown>[];
  frequency: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "paused";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysioSessionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  program_id: string | null;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  progress_notes: string | null;
  pain_level_before: number | null;
  pain_level_after: number | null;
  exercises_completed: string[];
  created_at: string;
}

export interface ProgressPhotoRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  photo_url: string;
  photo_date: string;
  category: string;
  notes: string | null;
  created_at: string;
}

export interface MealPlanRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  nutritionist_id: string;
  title: string;
  type: "daily" | "weekly";
  daily_plans: Record<string, unknown>[];
  target_calories: number;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "draft";
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurementRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  measurement_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface TherapySessionNoteRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  session_number: number;
  duration_minutes: number;
  session_type: "individual" | "couple" | "family" | "group";
  mood_rating: number | null;
  presenting_issues: string | null;
  interventions: string | null;
  observations: string | null;
  homework: string | null;
  is_confidential: boolean;
  risk_assessment: "none" | "low" | "moderate" | "high" | null;
  next_session_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TherapyPlanRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  diagnosis: string | null;
  treatment_approach: string;
  goals: Record<string, unknown>[];
  start_date: string;
  review_date: string | null;
  status: "active" | "completed" | "on_hold";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpeechExerciseRow {
  id: string;
  clinic_id: string;
  name: string;
  category: "articulation" | "fluency" | "language" | "voice" | "pragmatics" | "phonology";
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  target_sounds: string[];
  instructions: string;
  materials_needed: string | null;
  duration_minutes: number;
  created_at: string;
}

export interface SpeechSessionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  exercises_assigned: string[];
  exercises_completed: string[];
  accuracy_pct: number | null;
  notes: string | null;
  home_practice: string | null;
  created_at: string;
}

export interface SpeechProgressReportRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  report_date: string;
  period_start: string;
  period_end: string;
  goals_summary: string;
  progress_summary: string;
  areas_of_improvement: string[];
  areas_of_concern: string[];
  recommendations: string;
  next_steps: string;
  overall_progress: "significant" | "moderate" | "minimal" | "regression";
  created_at: string;
}

export interface LensInventoryRow {
  id: string;
  clinic_id: string;
  type: "single_vision" | "bifocal" | "progressive" | "contact" | "sunglasses";
  material: string;
  coating: string | null;
  power_range: string;
  stock_quantity: number;
  min_threshold: number;
  unit_cost: number;
  selling_price: number;
  supplier: string;
  created_at: string;
  updated_at: string;
}

export interface FrameCatalogRow {
  id: string;
  clinic_id: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  material: string;
  frame_type: "full_rim" | "semi_rimless" | "rimless";
  gender: "men" | "women" | "unisex" | "kids";
  price: number;
  cost_price: number;
  stock_quantity: number;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpticalPrescriptionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  ophthalmologist_name: string | null;
  prescription_date: string;
  expiry_date: string | null;
  right_eye: Record<string, unknown>;
  left_eye: Record<string, unknown>;
  notes: string | null;
  frame_id: string | null;
  lens_type: string | null;
  status: "pending" | "in_progress" | "ready" | "delivered";
  created_at: string;
  updated_at: string;
}

// ---- Lab & Clinic/Center Tables (Migration 00012) ----

export type LabTestOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "awaiting_validation"
  | "validated"
  | "cancelled";

export type LabTestPriority = "normal" | "urgent" | "stat";

export interface LabTestOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  test_name: string;
  test_category: string;
  status: LabTestOrderStatus;
  priority: LabTestPriority;
  ordered_at: string;
  started_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  results: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  clinic_id: string;
  name: string;
  code: string | null;
  head_doctor_id: string | null;
  is_active: boolean;
  created_at: string;
}

export type BedStatus = "available" | "occupied" | "maintenance" | "reserved";

export interface Bed {
  id: string;
  clinic_id: string;
  department_id: string;
  bed_number: string;
  ward: string | null;
  status: BedStatus;
  patient_id: string | null;
  admitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdmissionStatus = "admitted" | "discharged" | "transferred";

export interface Admission {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  bed_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  status: AdmissionStatus;
  diagnosis: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Supabase Database Schema (for use with supabase-js typed client) ----

export interface Database {
  public: {
    Tables: {
      clinics: { Row: Clinic; Insert: Partial<Clinic> & Pick<Clinic, "name" | "type">; Update: Partial<Clinic> };
      users: { Row: User; Insert: Partial<User> & Pick<User, "role" | "name">; Update: Partial<User> };
      services: { Row: Service; Insert: Partial<Service> & Pick<Service, "clinic_id" | "name">; Update: Partial<Service> };
      time_slots: { Row: TimeSlot; Insert: Partial<TimeSlot> & Pick<TimeSlot, "clinic_id" | "doctor_id" | "day_of_week" | "start_time" | "end_time">; Update: Partial<TimeSlot> };
      appointments: { Row: Appointment; Insert: Partial<Appointment> & Pick<Appointment, "clinic_id" | "patient_id" | "doctor_id" | "appointment_date" | "start_time" | "end_time">; Update: Partial<Appointment> };
      waiting_list: { Row: WaitingListEntry; Insert: Partial<WaitingListEntry> & Pick<WaitingListEntry, "clinic_id" | "patient_id" | "doctor_id">; Update: Partial<WaitingListEntry> };
      notifications: { Row: Notification; Insert: Partial<Notification> & Pick<Notification, "clinic_id" | "user_id" | "type" | "channel">; Update: Partial<Notification> };
      payments: { Row: Payment; Insert: Partial<Payment> & Pick<Payment, "clinic_id" | "patient_id" | "amount">; Update: Partial<Payment> };
      reviews: { Row: Review; Insert: Partial<Review> & Pick<Review, "clinic_id" | "patient_id" | "stars">; Update: Partial<Review> };
      documents: { Row: Document; Insert: Partial<Document> & Pick<Document, "clinic_id" | "user_id" | "type" | "file_url">; Update: Partial<Document> };
      clinic_holidays: { Row: ClinicHoliday; Insert: Partial<ClinicHoliday> & Pick<ClinicHoliday, "clinic_id" | "title" | "start_date" | "end_date">; Update: Partial<ClinicHoliday> };
      consultation_notes: { Row: ConsultationNote; Insert: Partial<ConsultationNote> & Pick<ConsultationNote, "clinic_id" | "appointment_id" | "doctor_id" | "patient_id">; Update: Partial<ConsultationNote> };
      prescriptions: { Row: Prescription; Insert: Partial<Prescription> & Pick<Prescription, "clinic_id" | "doctor_id" | "patient_id">; Update: Partial<Prescription> };
      family_members: { Row: FamilyMember; Insert: Partial<FamilyMember> & Pick<FamilyMember, "primary_user_id" | "member_user_id" | "relationship">; Update: Partial<FamilyMember> };
      odontogram: { Row: OdontogramEntry; Insert: Partial<OdontogramEntry> & Pick<OdontogramEntry, "clinic_id" | "patient_id" | "tooth_number">; Update: Partial<OdontogramEntry> };
      treatment_plans: { Row: TreatmentPlan; Insert: Partial<TreatmentPlan> & Pick<TreatmentPlan, "clinic_id" | "patient_id" | "doctor_id" | "title">; Update: Partial<TreatmentPlan> };
      lab_orders: { Row: LabOrder; Insert: Partial<LabOrder> & Pick<LabOrder, "clinic_id" | "patient_id" | "doctor_id" | "description">; Update: Partial<LabOrder> };
      installments: { Row: Installment; Insert: Partial<Installment> & Pick<Installment, "clinic_id" | "treatment_plan_id" | "patient_id" | "amount" | "due_date">; Update: Partial<Installment> };
      sterilization_log: { Row: SterilizationLogEntry; Insert: Partial<SterilizationLogEntry> & Pick<SterilizationLogEntry, "clinic_id" | "tool_name">; Update: Partial<SterilizationLogEntry> };
      products: { Row: Product; Insert: Partial<Product> & Pick<Product, "clinic_id" | "name">; Update: Partial<Product> };
      stock: { Row: StockEntry; Insert: Partial<StockEntry> & Pick<StockEntry, "clinic_id" | "product_id">; Update: Partial<StockEntry> };
      suppliers: { Row: Supplier; Insert: Partial<Supplier> & Pick<Supplier, "clinic_id" | "name">; Update: Partial<Supplier> };
      prescription_requests: { Row: PrescriptionRequest; Insert: Partial<PrescriptionRequest> & Pick<PrescriptionRequest, "clinic_id" | "patient_id" | "image_url">; Update: Partial<PrescriptionRequest> };
      loyalty_points: { Row: LoyaltyPoints; Insert: Partial<LoyaltyPoints> & Pick<LoyaltyPoints, "clinic_id" | "patient_id">; Update: Partial<LoyaltyPoints> };
      loyalty_transactions: { Row: LoyaltyTransaction; Insert: Partial<LoyaltyTransaction> & Pick<LoyaltyTransaction, "clinic_id" | "patient_id" | "points">; Update: Partial<LoyaltyTransaction> };
      purchase_orders: { Row: PurchaseOrder; Insert: Partial<PurchaseOrder> & Pick<PurchaseOrder, "clinic_id" | "supplier_id">; Update: Partial<PurchaseOrder> };
      purchase_order_items: { Row: PurchaseOrderItem; Insert: Partial<PurchaseOrderItem> & Pick<PurchaseOrderItem, "purchase_order_id" | "product_id" | "quantity">; Update: Partial<PurchaseOrderItem> };
      emergency_slots: { Row: EmergencySlot; Insert: Partial<EmergencySlot> & Pick<EmergencySlot, "clinic_id" | "doctor_id" | "slot_date" | "start_time" | "end_time">; Update: Partial<EmergencySlot> };
      appointment_doctors: { Row: AppointmentDoctor; Insert: Partial<AppointmentDoctor> & Pick<AppointmentDoctor, "appointment_id" | "doctor_id">; Update: Partial<AppointmentDoctor> };
      // New tables (migration 00005)
      blog_posts: { Row: BlogPost; Insert: Partial<BlogPost> & Pick<BlogPost, "title">; Update: Partial<BlogPost> };
      announcements: { Row: Announcement; Insert: Partial<Announcement> & Pick<Announcement, "title" | "message">; Update: Partial<Announcement> };
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog> & Pick<ActivityLog, "action" | "type">; Update: Partial<ActivityLog> };
      platform_billing: { Row: PlatformBilling; Insert: Partial<PlatformBilling> & Pick<PlatformBilling, "clinic_id" | "invoice_date" | "due_date">; Update: Partial<PlatformBilling> };
      feature_definitions: { Row: FeatureDefinition; Insert: Partial<FeatureDefinition> & Pick<FeatureDefinition, "name" | "key">; Update: Partial<FeatureDefinition> };
      clinic_feature_overrides: { Row: ClinicFeatureOverride; Insert: Partial<ClinicFeatureOverride> & Pick<ClinicFeatureOverride, "clinic_id" | "feature_id">; Update: Partial<ClinicFeatureOverride> };
      pricing_tiers: { Row: PricingTier; Insert: Partial<PricingTier> & Pick<PricingTier, "slug" | "name">; Update: Partial<PricingTier> };
      subscriptions: { Row: Subscription; Insert: Partial<Subscription> & Pick<Subscription, "clinic_id" | "system_type" | "tier_slug" | "current_period_start" | "current_period_end">; Update: Partial<Subscription> };
      subscription_invoices: { Row: SubscriptionInvoice; Insert: Partial<SubscriptionInvoice> & Pick<SubscriptionInvoice, "subscription_id" | "date" | "amount">; Update: Partial<SubscriptionInvoice> };
      feature_toggles: { Row: FeatureToggle; Insert: Partial<FeatureToggle> & Pick<FeatureToggle, "key" | "label">; Update: Partial<FeatureToggle> };
      sales: { Row: Sale; Insert: Partial<Sale> & Pick<Sale, "clinic_id">; Update: Partial<Sale> };
      on_duty_schedule: { Row: OnDutySchedule; Insert: Partial<OnDutySchedule> & Pick<OnDutySchedule, "clinic_id" | "date" | "start_time" | "end_time">; Update: Partial<OnDutySchedule> };
      before_after_photos: { Row: BeforeAfterPhoto; Insert: Partial<BeforeAfterPhoto> & Pick<BeforeAfterPhoto, "clinic_id" | "patient_id">; Update: Partial<BeforeAfterPhoto> };
      pain_questionnaires: { Row: PainQuestionnaire; Insert: Partial<PainQuestionnaire> & Pick<PainQuestionnaire, "clinic_id" | "patient_id" | "pain_level">; Update: Partial<PainQuestionnaire> };
      clinic_types: { Row: ClinicTypeRecord; Insert: Partial<ClinicTypeRecord> & Pick<ClinicTypeRecord, "type_key" | "name_fr" | "name_ar" | "category">; Update: Partial<ClinicTypeRecord> };
<<<<<<< HEAD
      // Para-medical tables
      exercise_programs: { Row: ExerciseProgramRow; Insert: Partial<ExerciseProgramRow> & Pick<ExerciseProgramRow, "clinic_id" | "patient_id" | "therapist_id" | "title">; Update: Partial<ExerciseProgramRow> };
      physio_sessions: { Row: PhysioSessionRow; Insert: Partial<PhysioSessionRow> & Pick<PhysioSessionRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<PhysioSessionRow> };
      progress_photos: { Row: ProgressPhotoRow; Insert: Partial<ProgressPhotoRow> & Pick<ProgressPhotoRow, "clinic_id" | "patient_id" | "photo_url">; Update: Partial<ProgressPhotoRow> };
      meal_plans: { Row: MealPlanRow; Insert: Partial<MealPlanRow> & Pick<MealPlanRow, "clinic_id" | "patient_id" | "nutritionist_id" | "title">; Update: Partial<MealPlanRow> };
      body_measurements: { Row: BodyMeasurementRow; Insert: Partial<BodyMeasurementRow> & Pick<BodyMeasurementRow, "clinic_id" | "patient_id">; Update: Partial<BodyMeasurementRow> };
      therapy_session_notes: { Row: TherapySessionNoteRow; Insert: Partial<TherapySessionNoteRow> & Pick<TherapySessionNoteRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<TherapySessionNoteRow> };
      therapy_plans: { Row: TherapyPlanRow; Insert: Partial<TherapyPlanRow> & Pick<TherapyPlanRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<TherapyPlanRow> };
      speech_exercises: { Row: SpeechExerciseRow; Insert: Partial<SpeechExerciseRow> & Pick<SpeechExerciseRow, "clinic_id" | "name" | "category">; Update: Partial<SpeechExerciseRow> };
      speech_sessions: { Row: SpeechSessionRow; Insert: Partial<SpeechSessionRow> & Pick<SpeechSessionRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<SpeechSessionRow> };
      speech_progress_reports: { Row: SpeechProgressReportRow; Insert: Partial<SpeechProgressReportRow> & Pick<SpeechProgressReportRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<SpeechProgressReportRow> };
      lens_inventory: { Row: LensInventoryRow; Insert: Partial<LensInventoryRow> & Pick<LensInventoryRow, "clinic_id" | "type">; Update: Partial<LensInventoryRow> };
      frame_catalog: { Row: FrameCatalogRow; Insert: Partial<FrameCatalogRow> & Pick<FrameCatalogRow, "clinic_id" | "brand" | "model">; Update: Partial<FrameCatalogRow> };
      optical_prescriptions: { Row: OpticalPrescriptionRow; Insert: Partial<OpticalPrescriptionRow> & Pick<OpticalPrescriptionRow, "clinic_id" | "patient_id">; Update: Partial<OpticalPrescriptionRow> };
      // New tables (migration 00012)
      lab_test_orders: { Row: LabTestOrder; Insert: Partial<LabTestOrder> & Pick<LabTestOrder, "clinic_id" | "patient_id" | "doctor_id" | "test_name">; Update: Partial<LabTestOrder> };
      departments: { Row: Department; Insert: Partial<Department> & Pick<Department, "clinic_id" | "name">; Update: Partial<Department> };
      beds: { Row: Bed; Insert: Partial<Bed> & Pick<Bed, "clinic_id" | "department_id" | "bed_number">; Update: Partial<Bed> };
      admissions: { Row: Admission; Insert: Partial<Admission> & Pick<Admission, "clinic_id" | "patient_id" | "doctor_id" | "department_id">; Update: Partial<Admission> };
    };
  };
}
