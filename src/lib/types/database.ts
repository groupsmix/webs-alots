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

export type LabTestOrderStatus =
  | "pending"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "validated"
  | "cancelled";

export type LabTestPriority = "normal" | "urgent" | "stat";

export type RadiologyModality =
  | "xray"
  | "ct"
  | "mri"
  | "ultrasound"
  | "mammography"
  | "pet"
  | "fluoroscopy"
  | "other";

export type RadiologyOrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "images_ready"
  | "reported"
  | "validated"
  | "cancelled";

export type ResultFlag = "normal" | "high" | "low" | "critical_high" | "critical_low";

export type EquipmentCondition = "new" | "good" | "fair" | "needs_repair" | "decommissioned";

export type RentalStatus = "reserved" | "active" | "returned" | "overdue" | "cancelled";

export type RentalPaymentStatus = "pending" | "partial" | "paid" | "refunded";

export type MaintenanceType = "routine" | "repair" | "calibration" | "inspection" | "cleaning";

export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

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

// ---- Phase 6: Clinics & Centers ----

// -- Polyclinic --

export type RoomType = "ward" | "private" | "icu" | "operating" | "consultation" | "other";

export type BedStatus = "available" | "occupied" | "maintenance" | "reserved";

export type AdmissionStatus = "admitted" | "discharged" | "transferred";

export interface Department {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  head_doctor_id: string | null;
  description: string | null;
  floor: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorDepartment {
  id: string;
  doctor_id: string;
  department_id: string;
  clinic_id: string;
  is_primary: boolean;
  joined_at: string;
}

export interface Room {
  id: string;
  clinic_id: string;
  department_id: string | null;
  room_number: string;
  room_type: RoomType;
  floor: string | null;
  total_beds: number;
  is_active: boolean;
  created_at: string;
}

export interface Bed {
  id: string;
  clinic_id: string;
  room_id: string;
  bed_number: string;
  status: BedStatus;
  current_patient_id: string | null;
  notes: string | null;
  updated_at: string;
}

export interface Admission {
  id: string;
  clinic_id: string;
  patient_id: string;
  bed_id: string;
  department_id: string | null;
  admitting_doctor_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  diagnosis: string | null;
  status: AdmissionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// -- Aesthetic / Cosmetic Clinic --

export type ConsentType = "before_after" | "marketing" | "medical_record";

export type PatientPackageStatus = "active" | "completed" | "expired" | "cancelled";

export interface PhotoConsentForm {
  id: string;
  clinic_id: string;
  patient_id: string;
  consent_type: ConsentType;
  signed_at: string;
  signature_url: string | null;
  consent_text: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface TreatmentPackage {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  services: Record<string, unknown>[];
  total_sessions: number;
  price: number;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientPackage {
  id: string;
  clinic_id: string;
  patient_id: string;
  package_id: string;
  sessions_used: number;
  sessions_total: number;
  start_date: string;
  expiry_date: string | null;
  status: PatientPackageStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationPhoto {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  annotations: Record<string, unknown>[];
  body_area: string | null;
  notes: string | null;
  taken_at: string;
  created_at: string;
}

// -- IVF / Fertility Center --

export type IVFCycleType = "ivf" | "icsi" | "iui" | "fet" | "egg_freezing" | "other";

export type IVFCycleStatus = "planned" | "stimulation" | "retrieval" | "fertilization" | "transfer" | "tww" | "completed" | "cancelled";

export type IVFOutcome = "positive" | "negative" | "biochemical" | "miscarriage" | "ongoing" | "pending";

export type IVFProtocolType = "long" | "short" | "antagonist" | "natural" | "mini_ivf" | "custom";

export type IVFTimelineEventType = "medication_start" | "scan" | "blood_test" | "trigger" | "retrieval" | "fertilization_report" | "transfer" | "beta_test" | "follow_up" | "other";

export interface IVFCycle {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  partner_id: string | null;
  cycle_number: number;
  cycle_type: IVFCycleType;
  status: IVFCycleStatus;
  start_date: string | null;
  end_date: string | null;
  protocol_id: string | null;
  stimulation_start: string | null;
  retrieval_date: string | null;
  transfer_date: string | null;
  eggs_retrieved: number | null;
  eggs_fertilized: number | null;
  embryos_transferred: number | null;
  embryos_frozen: number | null;
  outcome: IVFOutcome | null;
  beta_hcg_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IVFProtocol {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  protocol_type: IVFProtocolType;
  medications: Record<string, unknown>[];
  steps: Record<string, unknown>[];
  duration_days: number | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface IVFTimelineEvent {
  id: string;
  cycle_id: string;
  clinic_id: string;
  event_type: IVFTimelineEventType;
  event_date: string;
  title: string;
  description: string | null;
  results: Record<string, unknown> | null;
  created_at: string;
}

// -- Dialysis Center --

export type DialysisMachineStatus = "available" | "in_use" | "maintenance" | "out_of_service";

export type DialysisSessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";

export type DialysisRecurrencePattern = "mon_wed_fri" | "tue_thu_sat" | "custom";

export type DialysisAccessType = "fistula" | "graft" | "catheter";

export interface DialysisMachine {
  id: string;
  clinic_id: string;
  machine_name: string;
  machine_model: string | null;
  serial_number: string | null;
  status: DialysisMachineStatus;
  last_maintenance: string | null;
  next_maintenance: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DialysisSession {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  machine_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  status: DialysisSessionStatus;
  is_recurring: boolean;
  recurrence_pattern: DialysisRecurrencePattern | null;
  recurrence_group_id: string | null;
  pre_weight: number | null;
  post_weight: number | null;
  pre_bp_systolic: number | null;
  pre_bp_diastolic: number | null;
  post_bp_systolic: number | null;
  post_bp_diastolic: number | null;
  pre_pulse: number | null;
  post_pulse: number | null;
  pre_temperature: number | null;
  post_temperature: number | null;
  uf_goal: number | null;
  uf_actual: number | null;
  dialysate_flow: number | null;
  blood_flow: number | null;
  access_type: DialysisAccessType | null;
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// -- Dental Lab --

export type ProstheticOrderType = "crown" | "bridge" | "denture" | "implant_abutment" | "veneer" | "inlay_onlay" | "orthodontic" | "other";

export type ProstheticOrderStatus = "received" | "in_progress" | "quality_check" | "ready" | "delivered" | "returned";

export type ProstheticPriority = "normal" | "urgent" | "rush";

export type DeliveryCondition = "good" | "damaged" | "incomplete";

export type LabInvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface ProstheticOrder {
  id: string;
  clinic_id: string;
  dentist_id: string | null;
  dentist_name: string | null;
  dentist_clinic: string | null;
  patient_name: string | null;
  order_type: ProstheticOrderType;
  material: string | null;
  shade: string | null;
  tooth_numbers: number[];
  description: string | null;
  special_instructions: string | null;
  status: ProstheticOrderStatus;
  priority: ProstheticPriority;
  received_date: string;
  due_date: string | null;
  completed_date: string | null;
  delivered_date: string | null;
  price: number | null;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabMaterial {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_threshold: number;
  unit_cost: number | null;
  supplier: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  last_restocked: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabDelivery {
  id: string;
  clinic_id: string;
  order_id: string;
  delivery_date: string;
  delivered_by: string | null;
  received_by: string | null;
  condition: DeliveryCondition;
  notes: string | null;
  created_at: string;
}

export interface LabInvoice {
  id: string;
  clinic_id: string;
  invoice_number: string;
  dentist_id: string | null;
  dentist_name: string | null;
  items: Record<string, unknown>[];
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: LabInvoiceStatus;
  issued_date: string;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Custom Fields (Migration 00012) ----

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "file"
  | "tooth_number";

export type CustomFieldEntityType =
  | "appointment"
  | "patient"
  | "consultation"
  | "product"
  | "lab_order";

export interface CustomFieldDefinitionRow {
  id: string;
  clinic_type_key: string;
  entity_type: CustomFieldEntityType;
  field_key: string;
  field_type: CustomFieldType;
  label_fr: string;
  label_ar: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  options: Record<string, unknown>[];
  validation: Record<string, unknown>;
  default_value: unknown;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValuesRow {
  id: string;
  clinic_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  field_values: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldOverrideRow {
  id: string;
  clinic_id: string;
  field_definition_id: string;
  is_enabled: boolean;
  is_required: boolean | null;
  sort_order: number | null;
  created_at: string;
}

// ---- Diagnostic Center: Analysis Lab ----

export interface LabTestCatalog {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  category: string;
  sample_type: string;
  description: string | null;
  price: number | null;
  currency: string;
  turnaround_hours: number;
  reference_ranges: Record<string, unknown>[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface LabTestOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  assigned_technician_id: string | null;
  order_number: string;
  status: LabTestOrderStatus;
  priority: LabTestPriority;
  clinical_notes: string | null;
  fasting_required: boolean;
  sample_collected_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabTestItem {
  id: string;
  order_id: string;
  test_id: string;
  test_name: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
}

export interface LabTestResult {
  id: string;
  order_id: string;
  test_item_id: string;
  parameter_name: string;
  value: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  flag: ResultFlag | null;
  notes: string | null;
  entered_by: string | null;
  entered_at: string;
}

// ---- Diagnostic Center: Radiology ----

export interface RadiologyOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  radiologist_id: string | null;
  order_number: string;
  modality: RadiologyModality;
  body_part: string | null;
  clinical_indication: string | null;
  status: RadiologyOrderStatus;
  priority: LabTestPriority;
  scheduled_at: string | null;
  performed_at: string | null;
  reported_at: string | null;
  report_text: string | null;
  report_template_id: string | null;
  findings: string | null;
  impression: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RadiologyImage {
  id: string;
  order_id: string;
  clinic_id: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  modality: string | null;
  is_dicom: boolean;
  dicom_metadata: Record<string, unknown>;
  thumbnail_url: string | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface RadiologyReportTemplate {
  id: string;
  clinic_id: string;
  name: string;
  modality: string | null;
  body_part: string | null;
  template_text: string;
  fields: Record<string, unknown>[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Medical Equipment Store ----

export interface EquipmentInventory {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: string;
  condition: EquipmentCondition;
  is_available: boolean;
  is_rentable: boolean;
  rental_price_daily: number | null;
  rental_price_weekly: number | null;
  rental_price_monthly: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentRental {
  id: string;
  clinic_id: string;
  equipment_id: string;
  client_name: string;
  client_phone: string | null;
  client_id_number: string | null;
  rental_start: string;
  rental_end: string | null;
  actual_return: string | null;
  status: RentalStatus;
  condition_out: string;
  condition_in: string | null;
  deposit_amount: number | null;
  rental_amount: number | null;
  currency: string;
  payment_status: RentalPaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentMaintenance {
  id: string;
  clinic_id: string;
  equipment_id: string;
  type: MaintenanceType;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  next_due: string | null;
  cost: number | null;
  currency: string;
  status: MaintenanceStatus;
  notes: string | null;
  created_at: string;
}

// ---- Parapharmacy ----

export interface ParapharmacyCategory {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
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
      // Custom Fields (migration 00012)
      custom_field_definitions: { Row: CustomFieldDefinitionRow; Insert: Partial<CustomFieldDefinitionRow> & Pick<CustomFieldDefinitionRow, "clinic_type_key" | "entity_type" | "field_key" | "field_type" | "label_fr">; Update: Partial<CustomFieldDefinitionRow> };
      custom_field_values: { Row: CustomFieldValuesRow; Insert: Partial<CustomFieldValuesRow> & Pick<CustomFieldValuesRow, "clinic_id" | "entity_type" | "entity_id">; Update: Partial<CustomFieldValuesRow> };
      custom_field_overrides: { Row: CustomFieldOverrideRow; Insert: Partial<CustomFieldOverrideRow> & Pick<CustomFieldOverrideRow, "clinic_id" | "field_definition_id">; Update: Partial<CustomFieldOverrideRow> };
      // Phase 4 & 5 tables
      lab_test_catalog: { Row: LabTestCatalog; Insert: Partial<LabTestCatalog> & Pick<LabTestCatalog, "clinic_id" | "name">; Update: Partial<LabTestCatalog> };
      lab_test_orders: { Row: LabTestOrder; Insert: Partial<LabTestOrder> & Pick<LabTestOrder, "clinic_id" | "patient_id" | "order_number">; Update: Partial<LabTestOrder> };
      lab_test_items: { Row: LabTestItem; Insert: Partial<LabTestItem> & Pick<LabTestItem, "order_id" | "test_id" | "test_name">; Update: Partial<LabTestItem> };
      lab_test_results: { Row: LabTestResult; Insert: Partial<LabTestResult> & Pick<LabTestResult, "order_id" | "test_item_id" | "parameter_name">; Update: Partial<LabTestResult> };
      radiology_orders: { Row: RadiologyOrder; Insert: Partial<RadiologyOrder> & Pick<RadiologyOrder, "clinic_id" | "patient_id" | "order_number" | "modality">; Update: Partial<RadiologyOrder> };
      radiology_images: { Row: RadiologyImage; Insert: Partial<RadiologyImage> & Pick<RadiologyImage, "order_id" | "clinic_id" | "file_url">; Update: Partial<RadiologyImage> };
      radiology_report_templates: { Row: RadiologyReportTemplate; Insert: Partial<RadiologyReportTemplate> & Pick<RadiologyReportTemplate, "clinic_id" | "name" | "template_text">; Update: Partial<RadiologyReportTemplate> };
      equipment_inventory: { Row: EquipmentInventory; Insert: Partial<EquipmentInventory> & Pick<EquipmentInventory, "clinic_id" | "name">; Update: Partial<EquipmentInventory> };
      equipment_rentals: { Row: EquipmentRental; Insert: Partial<EquipmentRental> & Pick<EquipmentRental, "clinic_id" | "equipment_id" | "client_name" | "rental_start">; Update: Partial<EquipmentRental> };
      equipment_maintenance: { Row: EquipmentMaintenance; Insert: Partial<EquipmentMaintenance> & Pick<EquipmentMaintenance, "clinic_id" | "equipment_id">; Update: Partial<EquipmentMaintenance> };
      parapharmacy_categories: { Row: ParapharmacyCategory; Insert: Partial<ParapharmacyCategory> & Pick<ParapharmacyCategory, "clinic_id" | "name" | "slug">; Update: Partial<ParapharmacyCategory> };
      // Phase 6: Clinics & Centers
      departments: { Row: Department; Insert: Partial<Department> & Pick<Department, "clinic_id" | "name">; Update: Partial<Department> };
      doctor_departments: { Row: DoctorDepartment; Insert: Partial<DoctorDepartment> & Pick<DoctorDepartment, "doctor_id" | "department_id" | "clinic_id">; Update: Partial<DoctorDepartment> };
      rooms: { Row: Room; Insert: Partial<Room> & Pick<Room, "clinic_id" | "room_number" | "room_type">; Update: Partial<Room> };
      beds: { Row: Bed; Insert: Partial<Bed> & Pick<Bed, "clinic_id" | "room_id" | "bed_number">; Update: Partial<Bed> };
      admissions: { Row: Admission; Insert: Partial<Admission> & Pick<Admission, "clinic_id" | "patient_id" | "bed_id">; Update: Partial<Admission> };
      photo_consent_forms: { Row: PhotoConsentForm; Insert: Partial<PhotoConsentForm> & Pick<PhotoConsentForm, "clinic_id" | "patient_id">; Update: Partial<PhotoConsentForm> };
      treatment_packages: { Row: TreatmentPackage; Insert: Partial<TreatmentPackage> & Pick<TreatmentPackage, "clinic_id" | "name">; Update: Partial<TreatmentPackage> };
      patient_packages: { Row: PatientPackage; Insert: Partial<PatientPackage> & Pick<PatientPackage, "clinic_id" | "patient_id" | "package_id" | "sessions_total">; Update: Partial<PatientPackage> };
      consultation_photos: { Row: ConsultationPhoto; Insert: Partial<ConsultationPhoto> & Pick<ConsultationPhoto, "clinic_id" | "patient_id" | "photo_url">; Update: Partial<ConsultationPhoto> };
      ivf_cycles: { Row: IVFCycle; Insert: Partial<IVFCycle> & Pick<IVFCycle, "clinic_id" | "patient_id" | "cycle_type">; Update: Partial<IVFCycle> };
      ivf_protocols: { Row: IVFProtocol; Insert: Partial<IVFProtocol> & Pick<IVFProtocol, "clinic_id" | "name" | "protocol_type">; Update: Partial<IVFProtocol> };
      ivf_timeline_events: { Row: IVFTimelineEvent; Insert: Partial<IVFTimelineEvent> & Pick<IVFTimelineEvent, "cycle_id" | "clinic_id" | "event_type" | "event_date" | "title">; Update: Partial<IVFTimelineEvent> };
      dialysis_machines: { Row: DialysisMachine; Insert: Partial<DialysisMachine> & Pick<DialysisMachine, "clinic_id" | "machine_name">; Update: Partial<DialysisMachine> };
      dialysis_sessions: { Row: DialysisSession; Insert: Partial<DialysisSession> & Pick<DialysisSession, "clinic_id" | "patient_id" | "session_date" | "start_time">; Update: Partial<DialysisSession> };
      prosthetic_orders: { Row: ProstheticOrder; Insert: Partial<ProstheticOrder> & Pick<ProstheticOrder, "clinic_id" | "order_type">; Update: Partial<ProstheticOrder> };
      lab_materials: { Row: LabMaterial; Insert: Partial<LabMaterial> & Pick<LabMaterial, "clinic_id" | "name" | "category">; Update: Partial<LabMaterial> };
      lab_deliveries: { Row: LabDelivery; Insert: Partial<LabDelivery> & Pick<LabDelivery, "clinic_id" | "order_id">; Update: Partial<LabDelivery> };
      lab_invoices: { Row: LabInvoice; Insert: Partial<LabInvoice> & Pick<LabInvoice, "clinic_id" | "invoice_number">; Update: Partial<LabInvoice> };
      // Lab test orders (migration 00012)
      lab_test_orders: { Row: LabTestOrder; Insert: Partial<LabTestOrder> & Pick<LabTestOrder, "clinic_id" | "patient_id" | "doctor_id" | "test_name">; Update: Partial<LabTestOrder> };
    };
  };
}
