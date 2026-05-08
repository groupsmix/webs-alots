-- ============================================================
-- Migration 00062: Restaurant Vertical Tables
-- Adds menus, menu_items, restaurant_tables, and
-- restaurant_orders tables for the restaurant vertical.
-- Also extends the appointments table with reservation fields.
-- ============================================================

-- ============================================================
-- 1. MENUS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS menus (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menus_clinic ON menus(clinic_id);
CREATE INDEX IF NOT EXISTS idx_menus_active ON menus(clinic_id, is_active);

-- ============================================================
-- 2. MENU ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id         UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  photo_url       TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  allergens       TEXT[] DEFAULT '{}',
  is_halal        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_clinic ON menu_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(clinic_id, category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(clinic_id, is_available);

-- ============================================================
-- 3. RESTAURANT TABLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  capacity        INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
  zone            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  qr_code_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_clinic ON restaurant_tables(clinic_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_zone ON restaurant_tables(clinic_id, zone);

-- ============================================================
-- 4. RESTAURANT ORDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  table_id        UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'
  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_clinic ON restaurant_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_table ON restaurant_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON restaurant_orders(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_appointment ON restaurant_orders(appointment_id);

-- ============================================================
-- 5. EXTEND APPOINTMENTS FOR RESERVATIONS
-- Add optional reservation-specific fields to the existing
-- appointments table for the restaurant vertical.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_size INT,
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_table ON appointments(table_id);

-- ============================================================
-- 6. ENABLE RLS ON ALL NEW TABLES
-- ============================================================

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES — MENUS
-- ============================================================

-- Super admin: full access
CREATE POLICY "sa_menus_all"
  ON menus FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Clinic staff: full access within their clinic
CREATE POLICY "staff_menus"
  ON menus FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Public read: anyone can view active menus (for public menu display)
CREATE POLICY "public_menus_read"
  ON menus FOR SELECT
  USING (is_active = TRUE);

-- ============================================================
-- 8. RLS POLICIES — MENU ITEMS
-- ============================================================

CREATE POLICY "sa_menu_items_all"
  ON menu_items FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_menu_items"
  ON menu_items FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- Public read: anyone can view available menu items (for public menu display)
CREATE POLICY "public_menu_items_read"
  ON menu_items FOR SELECT
  USING (is_available = TRUE);

-- ============================================================
-- 9. RLS POLICIES — RESTAURANT TABLES
-- ============================================================

CREATE POLICY "sa_restaurant_tables_all"
  ON restaurant_tables FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_restaurant_tables"
  ON restaurant_tables FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());

-- ============================================================
-- 10. RLS POLICIES — RESTAURANT ORDERS
-- ============================================================

CREATE POLICY "sa_restaurant_orders_all"
  ON restaurant_orders FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "staff_restaurant_orders"
  ON restaurant_orders FOR ALL
  USING (clinic_id = get_user_clinic_id() AND is_clinic_staff())
  WITH CHECK (clinic_id = get_user_clinic_id() AND is_clinic_staff());
