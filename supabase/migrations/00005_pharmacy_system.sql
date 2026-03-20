-- Phase 5: Pharmacy System Schema
-- Tasks 15-18: Public Website, Pharmacist Dashboard, Stock Management, Loyalty System

-- Pharmacy Products / Medicines
CREATE TABLE IF NOT EXISTS pharmacy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('medication','otc','cosmetics','baby','medical-devices','supplements')),
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  manufacturer TEXT,
  barcode TEXT,
  image_url TEXT,
  dosage_form TEXT,
  strength TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pharmacy Services (injections, BP checks, etc.)
CREATE TABLE IF NOT EXISTS pharmacy_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  duration INTEGER NOT NULL DEFAULT 15,
  available BOOLEAN NOT NULL DEFAULT true,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  categories TEXT[] DEFAULT '{}',
  rating NUMERIC(2,1) DEFAULT 0,
  payment_terms TEXT,
  delivery_days INTEGER DEFAULT 3,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product-Supplier mapping (multiple suppliers per product)
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(product_id, supplier_id)
);

-- Pharmacy Prescriptions (uploaded by patients)
CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','partially-ready','ready','picked-up','delivered','rejected')),
  pharmacist_notes TEXT,
  total_price NUMERIC(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  delivery_option TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_option IN ('pickup','delivery')),
  delivery_address TEXT,
  is_chronic BOOLEAN NOT NULL DEFAULT false,
  refill_reminder_date DATE,
  whatsapp_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescription Items
CREATE TABLE IF NOT EXISTS pharmacy_prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES pharmacy_prescriptions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES pharmacy_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  available BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC(10,2) DEFAULT 0,
  notes TEXT
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  total_amount NUMERIC(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','shipped','delivered','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_delivery DATE,
  delivered_at TIMESTAMPTZ,
  notes TEXT
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES pharmacy_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Daily Sales Log
CREATE TABLE IF NOT EXISTS pharmacy_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_time TIME NOT NULL DEFAULT CURRENT_TIME,
  patient_name TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','insurance')),
  has_prescription BOOLEAN NOT NULL DEFAULT false,
  loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale Items
CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pharmacy_sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- On-Duty / Garde Schedule
CREATE TABLE IF NOT EXISTS pharmacy_on_duty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  duty_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_on_duty BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty Members
CREATE TABLE IF NOT EXISTS loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  available_points INTEGER NOT NULL DEFAULT 0,
  redeemed_points INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_of_birth DATE,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  total_purchases NUMERIC(10,2) NOT NULL DEFAULT 0,
  birthday_reward_claimed BOOLEAN NOT NULL DEFAULT false,
  birthday_reward_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty Transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earned','redeemed','birthday_bonus','referral_bonus','expired')),
  points INTEGER NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_id UUID REFERENCES pharmacy_sales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_products_clinic ON pharmacy_products(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_products_category ON pharmacy_products(category);
CREATE INDEX IF NOT EXISTS idx_pharmacy_products_expiry ON pharmacy_products(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prescriptions_clinic ON pharmacy_prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prescriptions_status ON pharmacy_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_date ON pharmacy_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_clinic ON loyalty_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_referral ON loyalty_members(referral_code);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_clinic ON suppliers(clinic_id);

-- RLS Policies
ALTER TABLE pharmacy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_on_duty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
