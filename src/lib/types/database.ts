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
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export type BookingSource = "online" | "phone" | "walk_in" | "whatsapp";

export type PaymentMethod = "cash" | "card" | "transfer" | "online" | "insurance";

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

export type ClinicTypeRecord = {
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

export type Clinic = {
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

export type User = {
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

export type Service = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  duration_min: number;
  price: number | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export type TimeSlot = {
  id: string;
  clinic_id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  buffer_minutes: number;
  buffer_min: number;
  is_active: boolean;
}

export type RecurrencePattern = "weekly" | "biweekly" | "monthly";

export type PaymentType = "deposit" | "full";

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  slot_start: string;
  slot_end: string;
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

export type WaitingListEntry = {
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

export type Notification = {
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

export type Payment = {
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

export type Review = {
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

export type Document = {
  id: string;
  clinic_id: string;
  user_id: string;
  type: DocumentType;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export type ClinicHoliday = {
  id: string;
  clinic_id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

// ---- Doctor Extras ----

export type ConsultationNote = {
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

export type Prescription = {
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

export type PrescriptionItem = {
  name: string;
  dosage: string;
  duration: string;
}

export type FamilyMember = {
  id: string;
  primary_user_id: string;
  member_user_id: string;
  relationship: string;
  created_at: string;
}

// ---- Dentist Extras ----

export type OdontogramEntry = {
  id: string;
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  status: ToothStatus;
  notes: string | null;
  updated_at: string;
}

export type TreatmentPlan = {
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

export type TreatmentStep = {
  step: number;
  description: string;
  status: "pending" | "in_progress" | "completed";
  date: string | null;
}

export type LabOrder = {
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

export type Installment = {
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

export type SterilizationLogEntry = {
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

export type EmergencySlot = {
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

export type AppointmentDoctor = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  is_primary: boolean;
  created_at: string;
}

// ---- Pharmacy Extras ----

export type Product = {
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

export type StockEntry = {
  id: string;
  clinic_id: string;
  product_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
  updated_at: string;
}

export type Supplier = {
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

export type PrescriptionRequest = {
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

export type LoyaltyPoints = {
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

export type LoyaltyTransaction = {
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

export type PurchaseOrder = {
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

export type PurchaseOrderItem = {
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

export type BlogPost = {
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

export type Announcement = {
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

export type ActivityLog = {
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

export type PlatformBilling = {
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

export type FeatureDefinition = {
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

export type ClinicFeatureOverride = {
  id: string;
  clinic_id: string;
  feature_id: string;
  enabled: boolean;
  created_at: string;
}

export type PricingTier = {
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

export type Subscription = {
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

export type SubscriptionInvoice = {
  id: string;
  subscription_id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paid_date: string | null;
  download_url: string | null;
  created_at: string;
}

export type FeatureToggle = {
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

export type Sale = {
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

export type OnDutySchedule = {
  id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_on_duty: boolean;
  notes: string | null;
  created_at: string;
}

export type BeforeAfterPhoto = {
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

export type PainQuestionnaire = {
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

export type Department = {
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

export type DoctorDepartment = {
  id: string;
  doctor_id: string;
  department_id: string;
  clinic_id: string;
  is_primary: boolean;
  joined_at: string;
}

export type Room = {
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

export type Bed = {
  id: string;
  clinic_id: string;
  room_id: string;
  bed_number: string;
  status: BedStatus;
  current_patient_id: string | null;
  notes: string | null;
  updated_at: string;
}

export type Admission = {
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

export type PhotoConsentForm = {
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

export type TreatmentPackage = {
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

export type PatientPackage = {
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

export type ConsultationPhoto = {
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

export type IVFCycle = {
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

export type IVFProtocol = {
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

export type IVFTimelineEvent = {
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

export type DialysisMachine = {
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

export type DialysisSession = {
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

export type ProstheticOrder = {
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

export type LabMaterial = {
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

export type LabDelivery = {
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

export type LabInvoice = {
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

// ---- Para-Medical Extras ----

export type ExerciseProgramRow = {
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

export type PhysioSessionRow = {
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

export type ProgressPhotoRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  photo_url: string;
  photo_date: string;
  category: string;
  notes: string | null;
  created_at: string;
}

export type MealPlanRow = {
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

export type BodyMeasurementRow = {
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

export type TherapySessionNoteRow = {
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

export type TherapyPlanRow = {
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

export type SpeechExerciseRow = {
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

export type SpeechSessionRow = {
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

export type SpeechProgressReportRow = {
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

export type LensInventoryRow = {
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

export type FrameCatalogRow = {
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

export type OpticalPrescriptionRow = {
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

export type CustomFieldDefinitionRow = {
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

export type CustomFieldValuesRow = {
  id: string;
  clinic_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  field_values: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type CustomFieldOverrideRow = {
  id: string;
  clinic_id: string;
  field_definition_id: string;
  is_enabled: boolean;
  is_required: boolean | null;
  sort_order: number | null;
  created_at: string;
}
// ---- Diagnostic Center: Analysis Lab ----

export type LabTestCatalog = {
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

export type LabTestOrder = {
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

export type LabTestItem = {
  id: string;
  order_id: string;
  test_id: string;
  test_name: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
}

export type LabTestResult = {
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

export type RadiologyOrder = {
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

export type RadiologyImage = {
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

export type RadiologyReportTemplate = {
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

export type EquipmentInventory = {
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

export type EquipmentRental = {
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

export type EquipmentMaintenance = {
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

export type ParapharmacyCategory = {
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

export type Database = {
  public: {
    Tables: {
      clinics: { Row: Clinic; Insert: Partial<Clinic> & Pick<Clinic, "name" | "type">; Update: Partial<Clinic>; Relationships: [] };
      users: { Row: User; Insert: Partial<User> & Pick<User, "role" | "name">; Update: Partial<User>; Relationships: [] };
      services: { Row: Service; Insert: Partial<Service> & Pick<Service, "clinic_id" | "name">; Update: Partial<Service>; Relationships: [] };
      time_slots: { Row: TimeSlot; Insert: Partial<TimeSlot> & Pick<TimeSlot, "clinic_id" | "doctor_id" | "day_of_week" | "start_time" | "end_time">; Update: Partial<TimeSlot>; Relationships: [] };
      appointments: { Row: Appointment; Insert: Partial<Appointment> & Pick<Appointment, "clinic_id" | "patient_id" | "doctor_id" | "appointment_date" | "start_time" | "end_time">; Update: Partial<Appointment>; Relationships: [] };
      waiting_list: { Row: WaitingListEntry; Insert: Partial<WaitingListEntry> & Pick<WaitingListEntry, "clinic_id" | "patient_id" | "doctor_id">; Update: Partial<WaitingListEntry>; Relationships: [] };
      notifications: { Row: Notification; Insert: Partial<Notification> & Pick<Notification, "clinic_id" | "user_id" | "type" | "channel">; Update: Partial<Notification>; Relationships: [] };
      payments: { Row: Payment; Insert: Partial<Payment> & Pick<Payment, "clinic_id" | "patient_id" | "amount">; Update: Partial<Payment>; Relationships: [] };
      reviews: { Row: Review; Insert: Partial<Review> & Pick<Review, "clinic_id" | "patient_id" | "stars">; Update: Partial<Review>; Relationships: [] };
      documents: { Row: Document; Insert: Partial<Document> & Pick<Document, "clinic_id" | "user_id" | "type" | "file_url">; Update: Partial<Document>; Relationships: [] };
      clinic_holidays: { Row: ClinicHoliday; Insert: Partial<ClinicHoliday> & Pick<ClinicHoliday, "clinic_id" | "title" | "start_date" | "end_date">; Update: Partial<ClinicHoliday>; Relationships: [] };
      consultation_notes: { Row: ConsultationNote; Insert: Partial<ConsultationNote> & Pick<ConsultationNote, "clinic_id" | "appointment_id" | "doctor_id" | "patient_id">; Update: Partial<ConsultationNote>; Relationships: [] };
      prescriptions: { Row: Prescription; Insert: Partial<Prescription> & Pick<Prescription, "clinic_id" | "doctor_id" | "patient_id">; Update: Partial<Prescription>; Relationships: [] };
      family_members: { Row: FamilyMember; Insert: Partial<FamilyMember> & Pick<FamilyMember, "primary_user_id" | "member_user_id" | "relationship">; Update: Partial<FamilyMember>; Relationships: [] };
      odontogram: { Row: OdontogramEntry; Insert: Partial<OdontogramEntry> & Pick<OdontogramEntry, "clinic_id" | "patient_id" | "tooth_number">; Update: Partial<OdontogramEntry>; Relationships: [] };
      treatment_plans: { Row: TreatmentPlan; Insert: Partial<TreatmentPlan> & Pick<TreatmentPlan, "clinic_id" | "patient_id" | "doctor_id" | "title">; Update: Partial<TreatmentPlan>; Relationships: [] };
      lab_orders: { Row: LabOrder; Insert: Partial<LabOrder> & Pick<LabOrder, "clinic_id" | "patient_id" | "doctor_id" | "description">; Update: Partial<LabOrder>; Relationships: [] };
      installments: { Row: Installment; Insert: Partial<Installment> & Pick<Installment, "clinic_id" | "treatment_plan_id" | "patient_id" | "amount" | "due_date">; Update: Partial<Installment>; Relationships: [] };
      sterilization_log: { Row: SterilizationLogEntry; Insert: Partial<SterilizationLogEntry> & Pick<SterilizationLogEntry, "clinic_id" | "tool_name">; Update: Partial<SterilizationLogEntry>; Relationships: [] };
      products: { Row: Product; Insert: Partial<Product> & Pick<Product, "clinic_id" | "name">; Update: Partial<Product>; Relationships: [] };
      stock: { Row: StockEntry; Insert: Partial<StockEntry> & Pick<StockEntry, "clinic_id" | "product_id">; Update: Partial<StockEntry>; Relationships: [] };
      suppliers: { Row: Supplier; Insert: Partial<Supplier> & Pick<Supplier, "clinic_id" | "name">; Update: Partial<Supplier>; Relationships: [] };
      prescription_requests: { Row: PrescriptionRequest; Insert: Partial<PrescriptionRequest> & Pick<PrescriptionRequest, "clinic_id" | "patient_id" | "image_url">; Update: Partial<PrescriptionRequest>; Relationships: [] };
      loyalty_points: { Row: LoyaltyPoints; Insert: Partial<LoyaltyPoints> & Pick<LoyaltyPoints, "clinic_id" | "patient_id">; Update: Partial<LoyaltyPoints>; Relationships: [] };
      loyalty_transactions: { Row: LoyaltyTransaction; Insert: Partial<LoyaltyTransaction> & Pick<LoyaltyTransaction, "clinic_id" | "patient_id" | "points">; Update: Partial<LoyaltyTransaction>; Relationships: [] };
      purchase_orders: { Row: PurchaseOrder; Insert: Partial<PurchaseOrder> & Pick<PurchaseOrder, "clinic_id" | "supplier_id">; Update: Partial<PurchaseOrder>; Relationships: [] };
      purchase_order_items: { Row: PurchaseOrderItem; Insert: Partial<PurchaseOrderItem> & Pick<PurchaseOrderItem, "purchase_order_id" | "product_id" | "quantity">; Update: Partial<PurchaseOrderItem>; Relationships: [] };
      emergency_slots: { Row: EmergencySlot; Insert: Partial<EmergencySlot> & Pick<EmergencySlot, "clinic_id" | "doctor_id" | "slot_date" | "start_time" | "end_time">; Update: Partial<EmergencySlot>; Relationships: [] };
      appointment_doctors: { Row: AppointmentDoctor; Insert: Partial<AppointmentDoctor> & Pick<AppointmentDoctor, "appointment_id" | "doctor_id">; Update: Partial<AppointmentDoctor>; Relationships: [] };
      // New tables (migration 00005)
      blog_posts: { Row: BlogPost; Insert: Partial<BlogPost> & Pick<BlogPost, "title">; Update: Partial<BlogPost>; Relationships: [] };
      announcements: { Row: Announcement; Insert: Partial<Announcement> & Pick<Announcement, "title" | "message">; Update: Partial<Announcement>; Relationships: [] };
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog> & Pick<ActivityLog, "action" | "type">; Update: Partial<ActivityLog>; Relationships: [] };
      platform_billing: { Row: PlatformBilling; Insert: Partial<PlatformBilling> & Pick<PlatformBilling, "clinic_id" | "invoice_date" | "due_date">; Update: Partial<PlatformBilling>; Relationships: [] };
      feature_definitions: { Row: FeatureDefinition; Insert: Partial<FeatureDefinition> & Pick<FeatureDefinition, "name" | "key">; Update: Partial<FeatureDefinition>; Relationships: [] };
      clinic_feature_overrides: { Row: ClinicFeatureOverride; Insert: Partial<ClinicFeatureOverride> & Pick<ClinicFeatureOverride, "clinic_id" | "feature_id">; Update: Partial<ClinicFeatureOverride>; Relationships: [] };
      pricing_tiers: { Row: PricingTier; Insert: Partial<PricingTier> & Pick<PricingTier, "slug" | "name">; Update: Partial<PricingTier>; Relationships: [] };
      subscriptions: { Row: Subscription; Insert: Partial<Subscription> & Pick<Subscription, "clinic_id" | "system_type" | "tier_slug" | "current_period_start" | "current_period_end">; Update: Partial<Subscription>; Relationships: [] };
      subscription_invoices: { Row: SubscriptionInvoice; Insert: Partial<SubscriptionInvoice> & Pick<SubscriptionInvoice, "subscription_id" | "date" | "amount">; Update: Partial<SubscriptionInvoice>; Relationships: [] };
      feature_toggles: { Row: FeatureToggle; Insert: Partial<FeatureToggle> & Pick<FeatureToggle, "key" | "label">; Update: Partial<FeatureToggle>; Relationships: [] };
      sales: { Row: Sale; Insert: Partial<Sale> & Pick<Sale, "clinic_id">; Update: Partial<Sale>; Relationships: [] };
      on_duty_schedule: { Row: OnDutySchedule; Insert: Partial<OnDutySchedule> & Pick<OnDutySchedule, "clinic_id" | "date" | "start_time" | "end_time">; Update: Partial<OnDutySchedule>; Relationships: [] };
      before_after_photos: { Row: BeforeAfterPhoto; Insert: Partial<BeforeAfterPhoto> & Pick<BeforeAfterPhoto, "clinic_id" | "patient_id">; Update: Partial<BeforeAfterPhoto>; Relationships: [] };
      pain_questionnaires: { Row: PainQuestionnaire; Insert: Partial<PainQuestionnaire> & Pick<PainQuestionnaire, "clinic_id" | "patient_id" | "pain_level">; Update: Partial<PainQuestionnaire>; Relationships: [] };
      clinic_types: { Row: ClinicTypeRecord; Insert: Partial<ClinicTypeRecord> & Pick<ClinicTypeRecord, "type_key" | "name_fr" | "name_ar" | "category">; Update: Partial<ClinicTypeRecord>; Relationships: [] };
      // Para-medical tables
      exercise_programs: { Row: ExerciseProgramRow; Insert: Partial<ExerciseProgramRow> & Pick<ExerciseProgramRow, "clinic_id" | "patient_id" | "therapist_id" | "title">; Update: Partial<ExerciseProgramRow>; Relationships: [] };
      physio_sessions: { Row: PhysioSessionRow; Insert: Partial<PhysioSessionRow> & Pick<PhysioSessionRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<PhysioSessionRow>; Relationships: [] };
      progress_photos: { Row: ProgressPhotoRow; Insert: Partial<ProgressPhotoRow> & Pick<ProgressPhotoRow, "clinic_id" | "patient_id" | "photo_url">; Update: Partial<ProgressPhotoRow>; Relationships: [] };
      meal_plans: { Row: MealPlanRow; Insert: Partial<MealPlanRow> & Pick<MealPlanRow, "clinic_id" | "patient_id" | "nutritionist_id" | "title">; Update: Partial<MealPlanRow>; Relationships: [] };
      body_measurements: { Row: BodyMeasurementRow; Insert: Partial<BodyMeasurementRow> & Pick<BodyMeasurementRow, "clinic_id" | "patient_id">; Update: Partial<BodyMeasurementRow>; Relationships: [] };
      therapy_session_notes: { Row: TherapySessionNoteRow; Insert: Partial<TherapySessionNoteRow> & Pick<TherapySessionNoteRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<TherapySessionNoteRow>; Relationships: [] };
      therapy_plans: { Row: TherapyPlanRow; Insert: Partial<TherapyPlanRow> & Pick<TherapyPlanRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<TherapyPlanRow>; Relationships: [] };
      speech_exercises: { Row: SpeechExerciseRow; Insert: Partial<SpeechExerciseRow> & Pick<SpeechExerciseRow, "clinic_id" | "name" | "category">; Update: Partial<SpeechExerciseRow>; Relationships: [] };
      speech_sessions: { Row: SpeechSessionRow; Insert: Partial<SpeechSessionRow> & Pick<SpeechSessionRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<SpeechSessionRow>; Relationships: [] };
      speech_progress_reports: { Row: SpeechProgressReportRow; Insert: Partial<SpeechProgressReportRow> & Pick<SpeechProgressReportRow, "clinic_id" | "patient_id" | "therapist_id">; Update: Partial<SpeechProgressReportRow>; Relationships: [] };
      lens_inventory: { Row: LensInventoryRow; Insert: Partial<LensInventoryRow> & Pick<LensInventoryRow, "clinic_id" | "type">; Update: Partial<LensInventoryRow>; Relationships: [] };
      frame_catalog: { Row: FrameCatalogRow; Insert: Partial<FrameCatalogRow> & Pick<FrameCatalogRow, "clinic_id" | "brand" | "model">; Update: Partial<FrameCatalogRow>; Relationships: [] };
      optical_prescriptions: { Row: OpticalPrescriptionRow; Insert: Partial<OpticalPrescriptionRow> & Pick<OpticalPrescriptionRow, "clinic_id" | "patient_id">; Update: Partial<OpticalPrescriptionRow>; Relationships: [] };
      // Custom Fields (migration 00012)
      custom_field_definitions: { Row: CustomFieldDefinitionRow; Insert: Partial<CustomFieldDefinitionRow> & Pick<CustomFieldDefinitionRow, "clinic_type_key" | "entity_type" | "field_key" | "field_type" | "label_fr">; Update: Partial<CustomFieldDefinitionRow>; Relationships: [] };
      custom_field_values: { Row: CustomFieldValuesRow; Insert: Partial<CustomFieldValuesRow> & Pick<CustomFieldValuesRow, "clinic_id" | "entity_type" | "entity_id">; Update: Partial<CustomFieldValuesRow>; Relationships: [] };
      custom_field_overrides: { Row: CustomFieldOverrideRow; Insert: Partial<CustomFieldOverrideRow> & Pick<CustomFieldOverrideRow, "clinic_id" | "field_definition_id">; Update: Partial<CustomFieldOverrideRow>; Relationships: [] };
      // Phase 4 & 5 tables
      lab_test_catalog: { Row: LabTestCatalog; Insert: Partial<LabTestCatalog> & Pick<LabTestCatalog, "clinic_id" | "name">; Update: Partial<LabTestCatalog>; Relationships: [] };
      lab_test_orders: { Row: LabTestOrder; Insert: Partial<LabTestOrder> & Pick<LabTestOrder, "clinic_id" | "patient_id" | "order_number">; Update: Partial<LabTestOrder>; Relationships: [] };
      lab_test_items: { Row: LabTestItem; Insert: Partial<LabTestItem> & Pick<LabTestItem, "order_id" | "test_id" | "test_name">; Update: Partial<LabTestItem>; Relationships: [] };
      lab_test_results: { Row: LabTestResult; Insert: Partial<LabTestResult> & Pick<LabTestResult, "order_id" | "test_item_id" | "parameter_name">; Update: Partial<LabTestResult>; Relationships: [] };
      radiology_orders: { Row: RadiologyOrder; Insert: Partial<RadiologyOrder> & Pick<RadiologyOrder, "clinic_id" | "patient_id" | "order_number" | "modality">; Update: Partial<RadiologyOrder>; Relationships: [] };
      radiology_images: { Row: RadiologyImage; Insert: Partial<RadiologyImage> & Pick<RadiologyImage, "order_id" | "clinic_id" | "file_url">; Update: Partial<RadiologyImage>; Relationships: [] };
      radiology_report_templates: { Row: RadiologyReportTemplate; Insert: Partial<RadiologyReportTemplate> & Pick<RadiologyReportTemplate, "clinic_id" | "name" | "template_text">; Update: Partial<RadiologyReportTemplate>; Relationships: [] };
      equipment_inventory: { Row: EquipmentInventory; Insert: Partial<EquipmentInventory> & Pick<EquipmentInventory, "clinic_id" | "name">; Update: Partial<EquipmentInventory>; Relationships: [] };
      equipment_rentals: { Row: EquipmentRental; Insert: Partial<EquipmentRental> & Pick<EquipmentRental, "clinic_id" | "equipment_id" | "client_name" | "rental_start">; Update: Partial<EquipmentRental>; Relationships: [] };
      equipment_maintenance: { Row: EquipmentMaintenance; Insert: Partial<EquipmentMaintenance> & Pick<EquipmentMaintenance, "clinic_id" | "equipment_id">; Update: Partial<EquipmentMaintenance>; Relationships: [] };
      parapharmacy_categories: { Row: ParapharmacyCategory; Insert: Partial<ParapharmacyCategory> & Pick<ParapharmacyCategory, "clinic_id" | "name" | "slug">; Update: Partial<ParapharmacyCategory>; Relationships: [] };
      // Phase 6: Clinics & Centers
      departments: { Row: Department; Insert: Partial<Department> & Pick<Department, "clinic_id" | "name">; Update: Partial<Department>; Relationships: [] };
      doctor_departments: { Row: DoctorDepartment; Insert: Partial<DoctorDepartment> & Pick<DoctorDepartment, "doctor_id" | "department_id" | "clinic_id">; Update: Partial<DoctorDepartment>; Relationships: [] };
      rooms: { Row: Room; Insert: Partial<Room> & Pick<Room, "clinic_id" | "room_number" | "room_type">; Update: Partial<Room>; Relationships: [] };
      beds: { Row: Bed; Insert: Partial<Bed> & Pick<Bed, "clinic_id" | "room_id" | "bed_number">; Update: Partial<Bed>; Relationships: [] };
      admissions: { Row: Admission; Insert: Partial<Admission> & Pick<Admission, "clinic_id" | "patient_id" | "bed_id">; Update: Partial<Admission>; Relationships: [] };
      photo_consent_forms: { Row: PhotoConsentForm; Insert: Partial<PhotoConsentForm> & Pick<PhotoConsentForm, "clinic_id" | "patient_id">; Update: Partial<PhotoConsentForm>; Relationships: [] };
      treatment_packages: { Row: TreatmentPackage; Insert: Partial<TreatmentPackage> & Pick<TreatmentPackage, "clinic_id" | "name">; Update: Partial<TreatmentPackage>; Relationships: [] };
      patient_packages: { Row: PatientPackage; Insert: Partial<PatientPackage> & Pick<PatientPackage, "clinic_id" | "patient_id" | "package_id" | "sessions_total">; Update: Partial<PatientPackage>; Relationships: [] };
      consultation_photos: { Row: ConsultationPhoto; Insert: Partial<ConsultationPhoto> & Pick<ConsultationPhoto, "clinic_id" | "patient_id" | "photo_url">; Update: Partial<ConsultationPhoto>; Relationships: [] };
      ivf_cycles: { Row: IVFCycle; Insert: Partial<IVFCycle> & Pick<IVFCycle, "clinic_id" | "patient_id" | "cycle_type">; Update: Partial<IVFCycle>; Relationships: [] };
      ivf_protocols: { Row: IVFProtocol; Insert: Partial<IVFProtocol> & Pick<IVFProtocol, "clinic_id" | "name" | "protocol_type">; Update: Partial<IVFProtocol>; Relationships: [] };
      ivf_timeline_events: { Row: IVFTimelineEvent; Insert: Partial<IVFTimelineEvent> & Pick<IVFTimelineEvent, "cycle_id" | "clinic_id" | "event_type" | "event_date" | "title">; Update: Partial<IVFTimelineEvent>; Relationships: [] };
      dialysis_machines: { Row: DialysisMachine; Insert: Partial<DialysisMachine> & Pick<DialysisMachine, "clinic_id" | "machine_name">; Update: Partial<DialysisMachine>; Relationships: [] };
      dialysis_sessions: { Row: DialysisSession; Insert: Partial<DialysisSession> & Pick<DialysisSession, "clinic_id" | "patient_id" | "session_date" | "start_time">; Update: Partial<DialysisSession>; Relationships: [] };
      prosthetic_orders: { Row: ProstheticOrder; Insert: Partial<ProstheticOrder> & Pick<ProstheticOrder, "clinic_id" | "order_type">; Update: Partial<ProstheticOrder>; Relationships: [] };
      lab_materials: { Row: LabMaterial; Insert: Partial<LabMaterial> & Pick<LabMaterial, "clinic_id" | "name" | "category">; Update: Partial<LabMaterial>; Relationships: [] };
      lab_deliveries: { Row: LabDelivery; Insert: Partial<LabDelivery> & Pick<LabDelivery, "clinic_id" | "order_id">; Update: Partial<LabDelivery>; Relationships: [] };
      lab_invoices: { Row: LabInvoice; Insert: Partial<LabInvoice> & Pick<LabInvoice, "clinic_id" | "invoice_number">; Update: Partial<LabInvoice>; Relationships: [] };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}
