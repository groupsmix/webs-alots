-- ============================================================
-- 00062: Restaurant Vertical
--
-- 1. Seed restaurant clinic types
-- 2. Create menus table
-- 3. Create menu_items table
-- 4. Create restaurant_tables table
-- 5. Extend reservations (appointments with table_id, party_size)
-- 6. Create orders table
-- 7. Add RLS policies for all new tables
-- ============================================================

-- ============================================================
-- 1. SEED RESTAURANT CLINIC TYPES
-- ============================================================

INSERT INTO clinic_types (type_key, name_fr, name_ar, category, icon, sort_order, features_config) VALUES
('restaurant_traditional', 'Restaurant Traditionnel',  'مطعم تقليدي',       'restaurant', 'UtensilsCrossed', 42, '{"appointments":true,"menu_management":true,"table_management":true,"qr_ordering":true,"reservations":true,"departments":true}'),
('restaurant_fast_food',   'Fast Food',                'وجبات سريعة',       'restaurant', 'Sandwich',        43, '{"appointments":false,"menu_management":true,"table_management":false,"qr_ordering":true,"reservations":false,"departments":true}'),
('restaurant_cafe',        'Cafe & Salon de The',      'مقهى وصالون شاي',   'restaurant', 'Coffee',          44, '{"appointments":true,"menu_management":true,"table_management":true,"qr_ordering":true,"reservations":true,"departments":false}'),
('restaurant_patisserie',  'Patisserie & Boulangerie', 'حلويات ومخبزة',     'restaurant', 'CakeSlice',       45, '{"appointments":false,"menu_management":true,"table_management":false,"qr_ordering":true,"reservations":false,"departments":false}'),
('restaurant_traiteur',    'Traiteur & Evenementiel',  'تموين ومناسبات',    'restaurant', 'PartyPopper',     46, '{"appointments":true,"menu_management":true,"table_management":false,"qr_ordering":false,"reservations":true,"departments":false}')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- 2. CREATE MENUS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menus_clinic ON menus(clinic_id);

COMMENT ON TABLE menus IS 'Restaurant menus -- each restaurant can have multiple menus (e.g. lunch, dinner, brunch).';

-- ============================================================
-- 3. CREATE MENU_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id      UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category     TEXT NOT NULL DEFAULT 'main',
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  photo_url    TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  allergens    TEXT[],
  is_halal     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu    ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_clinic  ON menu_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_cat     ON menu_items(category);

COMMENT ON TABLE menu_items IS 'Individual items within a restaurant menu, with allergen and halal tracking.';

-- ============================================================
-- 4. CREATE RESTAURANT_TABLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  capacity   INT NOT NULL DEFAULT 2,
  zone       TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_clinic ON restaurant_tables(clinic_id);

COMMENT ON TABLE restaurant_tables IS 'Physical tables in a restaurant, grouped by zone. Used for reservation assignment.';

-- ============================================================
-- 5. ADD RESERVATION FIELDS TO APPOINTMENTS
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS table_id         UUID REFERENCES restaurant_tables(id),
  ADD COLUMN IF NOT EXISTS party_size       INT,
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_table ON appointments(table_id) WHERE table_id IS NOT NULL;

COMMENT ON COLUMN appointments.table_id IS 'Restaurant table assigned to this reservation (NULL for non-restaurant bookings).';
COMMENT ON COLUMN appointments.party_size IS 'Number of guests for a restaurant reservation.';
COMMENT ON COLUMN appointments.special_requests IS 'Special requests from the guest (allergies, celebrations, etc).';

-- ============================================================
-- 6. CREATE ORDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  reservation_id  UUID REFERENCES appointments(id),
  table_id        UUID REFERENCES restaurant_tables(id),
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'
  )),
  order_source    TEXT NOT NULL DEFAULT 'in_person' CHECK (order_source IN (
    'in_person', 'qr_code', 'whatsapp', 'phone'
  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_clinic      ON orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_orders_reservation ON orders(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_table       ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);

COMMENT ON TABLE orders IS 'Restaurant orders linked to a reservation or table. Items stored as JSONB for flexibility.';

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- ---- MENUS ----
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menus_select_public" ON menus
  FOR SELECT USING (
    is_active = TRUE
    AND clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "menus_all_staff" ON menus
  FOR ALL USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  ) WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- ---- MENU_ITEMS ----
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items_select_public" ON menu_items
  FOR SELECT USING (
    is_available = TRUE
    AND clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "menu_items_all_staff" ON menu_items
  FOR ALL USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  ) WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- ---- RESTAURANT_TABLES ----
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_tables_select_public" ON restaurant_tables
  FOR SELECT USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "restaurant_tables_all_staff" ON restaurant_tables
  FOR ALL USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  ) WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- ---- ORDERS ----
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_clinic" ON orders
  FOR SELECT USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "orders_insert_clinic" ON orders
  FOR INSERT WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "orders_update_clinic" ON orders
  FOR UPDATE USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  ) WITH CHECK (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

CREATE POLICY "orders_delete_clinic" ON orders
  FOR DELETE USING (
    clinic_id::text = current_setting('request.headers', true)::json->>'x-clinic-id'
  );

-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON menus FOR EACH ROW
  EXECUTE FUNCTION update_menus_updated_at();

CREATE OR REPLACE FUNCTION update_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items FOR EACH ROW
  EXECUTE FUNCTION update_menu_items_updated_at();

CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();
