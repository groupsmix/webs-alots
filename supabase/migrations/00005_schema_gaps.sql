-- ============================================================
-- Migration 00005: Schema Gaps
-- Creates tables for entities that exist in demo data files
-- but lack corresponding Supabase tables.
-- Also extends existing tables with columns needed by the app.
-- ============================================================

-- ============================================================
-- 1. BLOG POSTS (demo-data.ts → blogPosts)
-- ============================================================

CREATE TABLE blog_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID REFERENCES clinics(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  content     TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  read_time   TEXT,
  category    TEXT,
  slug        TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  author_id   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blog_posts_clinic ON blog_posts(clinic_id);
CREATE INDEX idx_blog_posts_date ON blog_posts(date DESC);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);

-- ============================================================
-- 2. ANNOUNCEMENTS (super-admin-data.ts → announcements)
-- Platform-wide announcements from super-admin to clinics.
-- ============================================================

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'info'
               CHECK (type IN ('info', 'warning', 'critical')),
  target       TEXT NOT NULL DEFAULT 'all',
  target_label TEXT,
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_announcements_active ON announcements(is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- 3. ACTIVITY LOGS (super-admin-data.ts → activityLogs)
-- Platform-level audit trail.
-- ============================================================

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action      TEXT NOT NULL,
  description TEXT,
  clinic_id   UUID REFERENCES clinics(id) ON DELETE SET NULL,
  clinic_name TEXT,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  actor       TEXT,
  type        TEXT NOT NULL
              CHECK (type IN ('clinic', 'billing', 'feature', 'announcement', 'template', 'auth')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_logs_clinic ON activity_logs(clinic_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(type);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);

-- ============================================================
-- 4. PLATFORM BILLING (super-admin-data.ts → billingRecords)
-- SA-level billing records for clinic subscriptions.
-- Separate from the per-clinic payments table.
-- ============================================================

CREATE TABLE platform_billing (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  clinic_name    TEXT,
  plan           TEXT,
  amount_due     DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'MAD',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled')),
  invoice_date   DATE NOT NULL,
  due_date       DATE NOT NULL,
  paid_date      DATE,
  payment_method TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_platform_billing_clinic ON platform_billing(clinic_id);
CREATE INDEX idx_platform_billing_status ON platform_billing(status);
CREATE INDEX idx_platform_billing_due_date ON platform_billing(due_date);

-- ============================================================
-- 5. FEATURE DEFINITIONS (super-admin-data.ts → featureDefinitions)
-- Global feature catalogue managed by super-admin.
-- ============================================================

CREATE TABLE feature_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  key             TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL DEFAULT 'core'
                  CHECK (category IN ('core', 'communication', 'integration', 'advanced')),
  available_tiers TEXT[] NOT NULL DEFAULT '{}',
  global_enabled  BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_definitions_key ON feature_definitions(key);

-- Per-clinic feature overrides
CREATE TABLE clinic_feature_overrides (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  feature_id  UUID NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, feature_id)
);

CREATE INDEX idx_clinic_feature_overrides_clinic ON clinic_feature_overrides(clinic_id);

-- ============================================================
-- 6. PRICING TIERS (pricing-data.ts → pricingTiers)
-- Platform pricing configuration.
-- ============================================================

CREATE TABLE pricing_tiers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT NOT NULL UNIQUE
              CHECK (slug IN ('vitrine', 'cabinet', 'pro', 'premium', 'saas-monthly')),
  name        TEXT NOT NULL,
  description TEXT,
  is_popular  BOOLEAN DEFAULT FALSE,
  pricing     JSONB NOT NULL DEFAULT '{}',
  features    JSONB NOT NULL DEFAULT '[]',
  limits      JSONB NOT NULL DEFAULT '{}',
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pricing_tiers_slug ON pricing_tiers(slug);

-- ============================================================
-- 7. SUBSCRIPTIONS (pricing-data.ts → clientSubscriptions)
-- Clinic subscriptions to pricing tiers.
-- ============================================================

CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id            UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  clinic_name          TEXT,
  system_type          TEXT NOT NULL CHECK (system_type IN ('doctor', 'dentist', 'pharmacy')),
  tier_slug            TEXT NOT NULL,
  tier_name            TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'suspended')),
  current_period_start DATE NOT NULL,
  current_period_end   DATE NOT NULL,
  billing_cycle        TEXT NOT NULL DEFAULT 'monthly'
                       CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount               DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'MAD',
  payment_method       TEXT,
  auto_renew           BOOLEAN DEFAULT TRUE,
  trial_ends_at        DATE,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_clinic ON subscriptions(clinic_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier_slug);

-- Subscription invoices
CREATE TABLE subscription_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('paid', 'pending', 'overdue', 'refunded')),
  paid_date       DATE,
  download_url    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscription_invoices_sub ON subscription_invoices(subscription_id);

-- ============================================================
-- 8. FEATURE TOGGLES (pricing-data.ts → featureToggles)
-- Per-tier feature availability flags.
-- ============================================================

CREATE TABLE feature_toggles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'core'
               CHECK (category IN ('core', 'communication', 'integration', 'advanced', 'pharmacy')),
  system_types TEXT[] NOT NULL DEFAULT '{}',
  tiers        TEXT[] NOT NULL DEFAULT '{}',
  enabled      BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_toggles_key ON feature_toggles(key);

-- ============================================================
-- 9. SALES (pharmacy-demo-data.ts → dailySales)
-- Point-of-sale transaction records for pharmacies.
-- ============================================================

CREATE TABLE sales (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  time                  TIME NOT NULL DEFAULT CURRENT_TIME,
  patient_id            UUID REFERENCES users(id),
  patient_name          TEXT,
  items                 JSONB NOT NULL DEFAULT '[]',
  total                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'MAD',
  payment_method        TEXT NOT NULL DEFAULT 'cash'
                        CHECK (payment_method IN ('cash', 'card', 'insurance')),
  has_prescription      BOOLEAN DEFAULT FALSE,
  loyalty_points_earned INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_clinic ON sales(clinic_id);
CREATE INDEX idx_sales_date ON sales(date DESC);
CREATE INDEX idx_sales_patient ON sales(patient_id);

-- ============================================================
-- 10. ON-DUTY SCHEDULE (pharmacy-demo-data.ts → onDutySchedule)
-- Pharmacy on-duty / night-duty rota.
-- ============================================================

CREATE TABLE on_duty_schedule (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_on_duty BOOLEAN DEFAULT FALSE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_on_duty_schedule_clinic ON on_duty_schedule(clinic_id);
CREATE INDEX idx_on_duty_schedule_date ON on_duty_schedule(date);

-- ============================================================
-- 11. BEFORE/AFTER PHOTOS (dental-demo-data.ts → beforeAfterPhotos)
-- Dental treatment before/after comparison photos.
-- ============================================================

CREATE TABLE before_after_photos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES users(id),
  treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
  description       TEXT,
  before_image_url  TEXT,
  after_image_url   TEXT,
  before_date       DATE,
  after_date        DATE,
  category          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_before_after_photos_clinic ON before_after_photos(clinic_id);
CREATE INDEX idx_before_after_photos_patient ON before_after_photos(patient_id);
CREATE INDEX idx_before_after_photos_plan ON before_after_photos(treatment_plan_id);

-- ============================================================
-- 12. PAIN QUESTIONNAIRES (dental-demo-data.ts → painQuestionnaires)
-- Pre-appointment pain assessment forms.
-- ============================================================

CREATE TABLE pain_questionnaires (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES users(id),
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  pain_level       INT NOT NULL CHECK (pain_level BETWEEN 0 AND 10),
  pain_location    TEXT,
  pain_duration    TEXT,
  pain_type        TEXT,
  triggers         TEXT[] DEFAULT '{}',
  has_swelling     BOOLEAN DEFAULT FALSE,
  has_bleeding     BOOLEAN DEFAULT FALSE,
  additional_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pain_questionnaires_clinic ON pain_questionnaires(clinic_id);
CREATE INDEX idx_pain_questionnaires_patient ON pain_questionnaires(patient_id);
CREATE INDEX idx_pain_questionnaires_appointment ON pain_questionnaires(appointment_id);

-- ============================================================
-- 13. EXTEND EXISTING TABLES
-- ============================================================

-- 13a. clinics: add columns used by ClinicDetail (super-admin-data.ts)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13b. loyalty_points: add columns used by LoyaltyMember (pharmacy-demo-data.ts)
ALTER TABLE loyalty_points
  ADD COLUMN IF NOT EXISTS available_points INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_points INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS total_purchases DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS birthday_reward_claimed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS birthday_reward_year INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13c. loyalty_transactions: add columns used by LoyaltyTransaction (pharmacy-demo-data.ts)
ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'earned'
    CHECK (type IN ('earned', 'redeemed', 'birthday_bonus', 'referral_bonus', 'expired')),
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- loyalty_transactions: rename reason → description if reason exists
-- (The existing column is "reason"; demo data uses "description". We add description above;
--  the app layer can read either.)

-- 13d. stock: add batch_number column for tracking
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13e. products: add extra columns used by PharmacyProduct (pharmacy-demo-data.ts)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS generic_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS dosage_form TEXT,
  ADD COLUMN IF NOT EXISTS strength TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13f. suppliers: add extra columns used by Supplier (pharmacy-demo-data.ts)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS delivery_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13g. purchase_orders: add extra columns used by PurchaseOrder (pharmacy-demo-data.ts)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS expected_delivery DATE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 13h. sterilization_log: add method and sterilized_by columns (dental-demo-data.ts)
ALTER TABLE sterilization_log
  ADD COLUMN IF NOT EXISTS sterilized_by TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'autoclave'
    CHECK (method IN ('autoclave', 'chemical', 'dry_heat')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 13i. treatment_plans: add title column (dental-demo-data.ts)
ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13j. installments: add clinic_id column (database.ts type expects it)
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13k. lab_orders: add due_date and updated_at columns (dental-demo-data.ts)
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS lab_name TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13l. prescription_requests: add delivery_requested column (database.ts type expects it)
ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS delivery_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13m. purchase_order_items: add created_at column (database.ts type expects it)
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13n. appointments: add separate date/time columns used by the app
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'online'
    CHECK (booking_source IN ('online', 'phone', 'walk_in', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT
    CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_index INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13o. users: add extra columns used by the app
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13p. services: add extra columns used by the app
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS duration_min INT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13q. time_slots: add extra columns used by the app
ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS buffer_min INT DEFAULT 10;

-- 13r. notifications: add extra columns used by the app
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now();

-- 13s. payments: add extra columns used by the app
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full'
    CHECK (payment_type IN ('deposit', 'full')),
  ADD COLUMN IF NOT EXISTS gateway_session_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) DEFAULT 0;

-- 13t. reviews: add doctor_id and is_visible columns used by the app
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- 13u. documents: add extra columns used by the app
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13v. clinic_holidays: add created_at column
ALTER TABLE clinic_holidays
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 13w. consultation_notes: add extra columns used by the app
ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 13x. prescriptions: add extra columns used by the app
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 13y. family_members: add member_user_id column used by the app
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES users(id);

-- 13z. odontogram: add clinic_id column used by the app
ALTER TABLE odontogram
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- 13aa. emergency_slots: ensure it exists (may already from initial schema via app code)
-- The table was in database.ts types but not in the initial SQL migration.
CREATE TABLE IF NOT EXISTS emergency_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES users(id),
  slot_date   DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  reason      TEXT,
  is_booked   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_slots_clinic ON emergency_slots(clinic_id);
CREATE INDEX IF NOT EXISTS idx_emergency_slots_doctor ON emergency_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_slots_date ON emergency_slots(slot_date);

-- 13bb. appointment_doctors: ensure it exists
CREATE TABLE IF NOT EXISTS appointment_doctors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id      UUID NOT NULL REFERENCES users(id),
  is_primary     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_doctors_appointment ON appointment_doctors(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_doctors_doctor ON appointment_doctors(doctor_id);

-- 13cc. clinic_holidays: ensure it exists
CREATE TABLE IF NOT EXISTS clinic_holidays (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_holidays_clinic ON clinic_holidays(clinic_id);

-- 13dd. purchase_orders: ensure it exists
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  status        TEXT DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  total_amount  DECIMAL(10,2),
  notes         TEXT,
  ordered_at    TIMESTAMPTZ,
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_clinic ON purchase_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- 13ee. purchase_order_items: ensure it exists
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          INT NOT NULL DEFAULT 0,
  unit_price        DECIMAL(10,2),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);

-- 13ff. loyalty_transactions: ensure it exists
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES users(id),
  points      INT NOT NULL DEFAULT 0,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_clinic ON loyalty_transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_patient ON loyalty_transactions(patient_id);
