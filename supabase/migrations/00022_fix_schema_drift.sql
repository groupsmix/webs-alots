-- ============================================================
-- Migration 00022: Fix Schema Drift
--
-- Addresses mismatches between the live DB schema and the
-- codebase type definitions (database.ts). Specifically:
--
-- 1. Add missing columns that were defined in types but never
--    added via migration (clinics.phone, blog_posts.published_at,
--    departments.code, beds.department_id, admissions.doctor_id)
-- 2. Create missing tables (clinic_api_keys, clinic_subscriptions,
--    billing_events)
--
-- NOTE: departments, beds, and admissions were created in
-- 00015_phase6_clinics_centers.sql. Migration 00017 attempted
-- to create them with additional columns using IF NOT EXISTS,
-- but since the tables already existed, those columns were
-- never added. This migration uses ALTER TABLE to add them.
-- ============================================================

-- ============================================================
-- 1. MISSING COLUMNS ON EXISTING TABLES
-- ============================================================

-- 1a. clinics: code expects phone, address (address may exist from 00007)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 1b. blog_posts: code expects published_at for ordering
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 1c. departments: code expects "code" column (00017 tried IF NOT EXISTS)
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS code TEXT;

-- 1d. beds: code expects department_id (00015 created beds without it)
ALTER TABLE beds
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- 1e. beds: code expects patient_id (00017 used patient_id, 00015 used current_patient_id)
ALTER TABLE beds
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES users(id);

-- 1f. admissions: code expects doctor_id (00015 has admitting_doctor_id only)
ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES users(id);

-- Backfill admissions.doctor_id from admitting_doctor_id where available
UPDATE admissions
  SET doctor_id = admitting_doctor_id
  WHERE doctor_id IS NULL AND admitting_doctor_id IS NOT NULL;

-- ============================================================
-- 2. MISSING TABLES
-- ============================================================

-- 2a. clinic_api_keys: used by /api/v1/* routes for API auth
CREATE TABLE IF NOT EXISTS clinic_api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL,
  key         TEXT,
  label       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_api_keys_clinic ON clinic_api_keys(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_api_keys_key ON clinic_api_keys(key);

-- 2b. clinic_subscriptions: used by billing cron and subscription-billing.ts
CREATE TABLE IF NOT EXISTS clinic_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL DEFAULT 'free',
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  billing_interval      TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  current_period_start  DATE,
  current_period_end    DATE,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  trial_end             DATE,
  amount                NUMERIC DEFAULT 0,
  currency              TEXT DEFAULT 'MAD',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_clinic ON clinic_subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_status ON clinic_subscriptions(status);

-- 2c. billing_events: used by subscription-billing.ts logBillingEvent
CREATE TABLE IF NOT EXISTS billing_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  currency    TEXT DEFAULT 'MAD',
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_clinic ON billing_events(clinic_id);

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

ALTER TABLE clinic_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "sa_clinic_api_keys_all" ON clinic_api_keys
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_clinic_subscriptions_all" ON clinic_subscriptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "sa_billing_events_all" ON billing_events
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Clinic staff access
CREATE POLICY "staff_clinic_api_keys" ON clinic_api_keys
  FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "staff_clinic_subscriptions" ON clinic_subscriptions
  FOR SELECT
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "staff_billing_events" ON billing_events
  FOR SELECT
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
