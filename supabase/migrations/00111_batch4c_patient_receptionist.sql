-- Batch 4C: Patient & Receptionist Features
-- 1. One-click patient check-in (extends existing waiting_queue)
-- 2. Smart phone handler (phone-to-patient lookup)
-- 3. Automated attestations (medical certificates, sick leave, attendance letters)
-- 4. Family account (link family members)
-- 5. Prescription renewal workflow (WhatsApp request -> doctor approval -> pharmacy)
-- 6. Wait time estimate (real-time calculation from queue)
-- 7. Equipment/consumables inventory (stock tracking, expiry alerts, auto-reorder)

-- ══════════════════════════════════════════════════════════════════════════
-- 1. One-click check-in: Add walk-in support column to waiting_queue
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS checkin_method text
  DEFAULT 'manual' CHECK (checkin_method IN ('manual', 'qr', 'one_click', 'walk_in'));

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Smart Phone Handler: phone_index for fast caller-ID lookup
-- ══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_patients_phone_clinic
  ON patients(phone, clinic_id);

CREATE INDEX IF NOT EXISTS idx_patients_phone_normalized
  ON patients(clinic_id, phone);

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Automated Attestations
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('medical_certificate', 'sick_leave', 'attendance_letter', 'custom')),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  -- For sick leave
  start_date date,
  end_date date,
  days_count integer,
  -- Metadata
  generated_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  signed_by uuid,
  pdf_storage_key text,
  template_version text DEFAULT '1.0',
  locale text DEFAULT 'fr' CHECK (locale IN ('fr', 'ar', 'en')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'delivered', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attestations_clinic_id ON attestations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attestations_patient_id ON attestations(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_attestations_doctor_id ON attestations(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_attestations_type ON attestations(clinic_id, type);

ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attestations' AND policyname = 'attestations_clinic_isolation'
  ) THEN
    CREATE POLICY attestations_clinic_isolation ON attestations
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Family Account
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS family_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  primary_patient_id uuid NOT NULL,
  linked_patient_id uuid NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('parent', 'child', 'spouse', 'sibling', 'guardian', 'other')),
  can_book_appointments boolean DEFAULT true,
  can_view_records boolean DEFAULT false,
  shared_billing boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, primary_patient_id, linked_patient_id)
);

CREATE INDEX IF NOT EXISTS idx_family_links_clinic_id ON family_links(clinic_id);
CREATE INDEX IF NOT EXISTS idx_family_links_primary ON family_links(clinic_id, primary_patient_id);
CREATE INDEX IF NOT EXISTS idx_family_links_linked ON family_links(clinic_id, linked_patient_id);

ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'family_links' AND policyname = 'family_links_clinic_isolation'
  ) THEN
    CREATE POLICY family_links_clinic_isolation ON family_links
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Prescription Renewal Workflow
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prescription_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  original_prescription_id uuid,
  -- Request details
  medication_name text NOT NULL,
  dosage text,
  request_channel text DEFAULT 'whatsapp' CHECK (request_channel IN ('whatsapp', 'app', 'phone', 'in_person')),
  request_message text,
  -- Workflow state
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'dispensed', 'expired', 'cancelled')),
  -- Doctor response
  reviewed_at timestamptz,
  reviewed_by uuid,
  doctor_notes text,
  rejection_reason text,
  -- Pharmacy notification
  pharmacy_notified_at timestamptz,
  pharmacy_name text,
  pharmacy_phone text,
  dispensed_at timestamptz,
  -- Tracking
  whatsapp_message_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_renewals_clinic ON prescription_renewals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescription_renewals_patient ON prescription_renewals(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_renewals_doctor ON prescription_renewals(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescription_renewals_status ON prescription_renewals(clinic_id, status);

ALTER TABLE prescription_renewals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prescription_renewals' AND policyname = 'prescription_renewals_clinic_isolation'
  ) THEN
    CREATE POLICY prescription_renewals_clinic_isolation ON prescription_renewals
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 6. Wait Time Estimate: Add delay tracking to doctors
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS doctor_delay_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL,
  current_delay_minutes integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  reason text,
  UNIQUE(clinic_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_delay_status_clinic ON doctor_delay_status(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_delay_status_doctor ON doctor_delay_status(clinic_id, doctor_id);

ALTER TABLE doctor_delay_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'doctor_delay_status' AND policyname = 'doctor_delay_status_clinic_isolation'
  ) THEN
    CREATE POLICY doctor_delay_status_clinic_isolation ON doctor_delay_status
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 7. Equipment/Consumables Inventory
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('equipment', 'consumable', 'medication', 'other')),
  sku text,
  description text,
  unit text DEFAULT 'piece',
  current_stock integer NOT NULL DEFAULT 0,
  minimum_stock integer NOT NULL DEFAULT 0,
  maximum_stock integer,
  reorder_point integer NOT NULL DEFAULT 5,
  reorder_quantity integer DEFAULT 10,
  unit_cost_centimes integer,
  supplier_name text,
  supplier_phone text,
  supplier_email text,
  expiry_date date,
  expiry_alert_days integer DEFAULT 30,
  location text,
  is_active boolean DEFAULT true,
  last_restocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_clinic ON inventory_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(clinic_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(clinic_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(clinic_id)
  WHERE current_stock <= reorder_point AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiry ON inventory_items(clinic_id, expiry_date)
  WHERE expiry_date IS NOT NULL AND is_active = true;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_items' AND policyname = 'inventory_items_clinic_isolation'
  ) THEN
    CREATE POLICY inventory_items_clinic_isolation ON inventory_items
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;

-- Inventory transactions (stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('restock', 'usage', 'adjustment', 'expired', 'returned')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reason text,
  performed_by uuid,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_clinic ON inventory_transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(clinic_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(clinic_id, type);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_transactions' AND policyname = 'inventory_transactions_clinic_isolation'
  ) THEN
    CREATE POLICY inventory_transactions_clinic_isolation ON inventory_transactions
      FOR ALL
      USING (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid)
      WITH CHECK (clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid);
  END IF;
END $$;
