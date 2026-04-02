-- ============================================================
-- Migration 00065: Fitness Vertical Tables
-- Adds membership_plans, memberships, classes, class_enrollments,
-- and progress_tracking tables for the fitness vertical.
-- ============================================================

-- ============================================================
-- 1. MEMBERSHIP PLANS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS membership_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  duration_days   INT NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MAD',
  max_classes     INT,
  features        JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_clinic ON membership_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_active ON membership_plans(clinic_id, is_active);

-- ============================================================
-- 2. MEMBERSHIPS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES users(id),
  plan_id         UUID NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'frozen', 'pending'
  )),
  auto_renew      BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_clinic ON memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan ON memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(clinic_id, status);

-- ============================================================
-- 3. CLASSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS classes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  trainer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  day_of_week     INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  duration_min    INT NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  max_capacity    INT NOT NULL DEFAULT 20 CHECK (max_capacity > 0),
  location        TEXT,
  is_recurring    BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_clinic ON classes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_classes_trainer ON classes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_classes_day ON classes(clinic_id, day_of_week);

-- ============================================================
-- 4. CLASS ENROLLMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS class_enrollments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES users(id),
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN (
    'enrolled', 'attended', 'cancelled', 'no_show'
  )),
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_clinic ON class_enrollments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_member ON class_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_date ON class_enrollments(clinic_id, enrollment_date);

-- ============================================================
-- 5. PROGRESS TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS progress_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES users(id),
  recorded_by     UUID REFERENCES users(id),
  recorded_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg       NUMERIC(5,2),
  body_fat_pct    NUMERIC(5,2),
  muscle_mass_kg  NUMERIC(5,2),
  bmi             NUMERIC(5,2),
  notes           TEXT,
  photo_urls      TEXT[] DEFAULT '{}',
  measurements    JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_tracking_clinic ON progress_tracking(clinic_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_member ON progress_tracking(member_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_date ON progress_tracking(clinic_id, recorded_at);

-- ============================================================
-- 6. ENABLE RLS ON ALL NEW TABLES
-- ============================================================

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES — MEMBERSHIP PLANS
-- ============================================================

CREATE POLICY "sa_membership_plans_all"
  ON membership_plans FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_membership_plans"
  ON membership_plans FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "public_membership_plans_read"
  ON membership_plans FOR SELECT
  USING (is_active = TRUE);

-- ============================================================
-- 8. RLS POLICIES — MEMBERSHIPS
-- ============================================================

CREATE POLICY "sa_memberships_all"
  ON memberships FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_memberships"
  ON memberships FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "member_memberships_read"
  ON memberships FOR SELECT
  USING (member_id = get_my_user_id());

-- ============================================================
-- 9. RLS POLICIES — CLASSES
-- ============================================================

CREATE POLICY "sa_classes_all"
  ON classes FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_classes"
  ON classes FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "public_classes_read"
  ON classes FOR SELECT
  USING (is_active = TRUE);

-- ============================================================
-- 10. RLS POLICIES — CLASS ENROLLMENTS
-- ============================================================

CREATE POLICY "sa_class_enrollments_all"
  ON class_enrollments FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_class_enrollments"
  ON class_enrollments FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "member_class_enrollments_read"
  ON class_enrollments FOR SELECT
  USING (member_id = get_my_user_id());

-- ============================================================
-- 11. RLS POLICIES — PROGRESS TRACKING
-- ============================================================

CREATE POLICY "sa_progress_tracking_all"
  ON progress_tracking FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_progress_tracking"
  ON progress_tracking FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

CREATE POLICY "member_progress_tracking_read"
  ON progress_tracking FOR SELECT
  USING (member_id = get_my_user_id());
