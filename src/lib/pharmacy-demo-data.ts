/**
 * Demo / mock data for the Pharmacy System (Phase 5).
 * Used across pharmacy public site, pharmacist dashboard, stock management, and loyalty system.
 */

// ---------- Types ----------

export interface PharmacyProduct {
  id: string;
  name: string;
  genericName?: string;
  category: "medication" | "otc" | "cosmetics" | "baby" | "medical-devices" | "supplements";
  description: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  minimumStock: number;
  expiryDate: string;
  manufacturer: string;
  barcode?: string;
  image?: string;
  supplierId: string;
  dosageForm?: string;
  strength?: string;
  active: boolean;
}

export interface PharmacyService {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number;
  available: boolean;
  icon: string;
}

export interface PharmacyPrescription {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  imageUrl: string;
  uploadedAt: string;
  status: "pending" | "reviewing" | "partially-ready" | "ready" | "picked-up" | "delivered" | "rejected";
  pharmacistNotes?: string;
  items: PharmacyPrescriptionItem[];
  totalPrice: number;
  currency: string;
  deliveryOption: "pickup" | "delivery";
  deliveryAddress?: string;
  isChronic: boolean;
  refillReminderDate?: string;
  whatsappNotified: boolean;
}

export interface PharmacyPrescriptionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  available: boolean;
  price: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  categories: string[];
  rating: number;
  paymentTerms: string;
  deliveryDays: number;
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  currency: string;
  status: "draft" | "sent" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  expectedDelivery: string;
  deliveredAt?: string;
  notes?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface DailySale {
  id: string;
  date: string;
  time: string;
  patientName: string;
  items: { productName: string; quantity: number; price: number }[];
  total: number;
  currency: string;
  paymentMethod: "cash" | "card" | "insurance";
  hasPrescription: boolean;
  loyaltyPointsEarned: number;
}

export interface LoyaltyMember {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  email: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  joinedAt: string;
  dateOfBirth: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  referralCode: string;
  referredBy?: string;
  totalPurchases: number;
  birthdayRewardClaimed: boolean;
  birthdayRewardYear?: number;
}

export interface LoyaltyTransaction {
  id: string;
  memberId: string;
  type: "earned" | "redeemed" | "birthday_bonus" | "referral_bonus" | "expired";
  points: number;
  description: string;
  date: string;
  saleId?: string;
}

export interface OnDutySchedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOnDuty: boolean;
  notes?: string;
}

export interface InventoryReport {
  month: string;
  year: number;
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  expiringSoon: number;
  expired: number;
  totalSales: number;
  topSellingProducts: { name: string; quantity: number; revenue: number }[];
}

// ---------- Data ----------

export const pharmacyProducts: PharmacyProduct[] = [
  { id: "pp1", name: "Doliprane 1000mg", genericName: "Paracetamol", category: "medication", description: "Analgesic and antipyretic", price: 18, currency: "MAD", requiresPrescription: false, stockQuantity: 250, minimumStock: 50, expiryDate: "2027-08-15", manufacturer: "Sanofi", barcode: "3400930000123", supplierId: "sup1", dosageForm: "Tablet", strength: "1000mg", active: true },
  { id: "pp2", name: "Augmentin 1g", genericName: "Amoxicillin/Clavulanic acid", category: "medication", description: "Broad-spectrum antibiotic", price: 85, currency: "MAD", requiresPrescription: true, stockQuantity: 45, minimumStock: 20, expiryDate: "2027-03-20", manufacturer: "GSK", barcode: "3400930000456", supplierId: "sup1", dosageForm: "Tablet", strength: "1g", active: true },
  { id: "pp3", name: "Ventoline Inhaler", genericName: "Salbutamol", category: "medication", description: "Bronchodilator for asthma relief", price: 45, currency: "MAD", requiresPrescription: true, stockQuantity: 30, minimumStock: 15, expiryDate: "2027-06-10", manufacturer: "GSK", supplierId: "sup1", dosageForm: "Inhaler", strength: "100mcg", active: true },
  { id: "pp4", name: "Nexium 40mg", genericName: "Esomeprazole", category: "medication", description: "Proton pump inhibitor for acid reflux", price: 120, currency: "MAD", requiresPrescription: true, stockQuantity: 60, minimumStock: 25, expiryDate: "2027-12-01", manufacturer: "AstraZeneca", supplierId: "sup2", dosageForm: "Capsule", strength: "40mg", active: true },
  { id: "pp5", name: "Glucophage 850mg", genericName: "Metformin", category: "medication", description: "Oral antidiabetic medication", price: 35, currency: "MAD", requiresPrescription: true, stockQuantity: 100, minimumStock: 40, expiryDate: "2027-09-25", manufacturer: "Merck", supplierId: "sup2", dosageForm: "Tablet", strength: "850mg", active: true },
  { id: "pp6", name: "Aspégic 1000mg", genericName: "Aspirin", category: "medication", description: "Anti-inflammatory and blood thinner", price: 22, currency: "MAD", requiresPrescription: false, stockQuantity: 180, minimumStock: 50, expiryDate: "2027-11-30", manufacturer: "Sanofi", supplierId: "sup1", dosageForm: "Powder", strength: "1000mg", active: true },
  { id: "pp7", name: "Avène Cleanance Gel", category: "cosmetics", description: "Cleansing gel for oily skin", price: 145, currency: "MAD", requiresPrescription: false, stockQuantity: 25, minimumStock: 10, expiryDate: "2028-01-15", manufacturer: "Pierre Fabre", supplierId: "sup3", active: true },
  { id: "pp8", name: "Pampers Premium Size 3", category: "baby", description: "Premium baby diapers (6-10kg)", price: 95, currency: "MAD", requiresPrescription: false, stockQuantity: 40, minimumStock: 15, expiryDate: "2029-06-01", manufacturer: "P&G", supplierId: "sup3", active: true },
  { id: "pp9", name: "Omron M3 BP Monitor", category: "medical-devices", description: "Digital blood pressure monitor", price: 650, currency: "MAD", requiresPrescription: false, stockQuantity: 8, minimumStock: 3, expiryDate: "2030-12-31", manufacturer: "Omron", supplierId: "sup4", active: true },
  { id: "pp10", name: "Vitamin D3 1000IU", category: "supplements", description: "Vitamin D3 supplement for bone health", price: 65, currency: "MAD", requiresPrescription: false, stockQuantity: 120, minimumStock: 30, expiryDate: "2027-07-20", manufacturer: "Solgar", supplierId: "sup4", dosageForm: "Softgel", strength: "1000IU", active: true },
  { id: "pp11", name: "Crestor 10mg", genericName: "Rosuvastatin", category: "medication", description: "Cholesterol-lowering statin medication", price: 95, currency: "MAD", requiresPrescription: true, stockQuantity: 8, minimumStock: 20, expiryDate: "2026-04-15", manufacturer: "AstraZeneca", supplierId: "sup2", dosageForm: "Tablet", strength: "10mg", active: true },
  { id: "pp12", name: "Tensopril 5mg", genericName: "Ramipril", category: "medication", description: "ACE inhibitor for hypertension", price: 42, currency: "MAD", requiresPrescription: true, stockQuantity: 5, minimumStock: 15, expiryDate: "2026-05-01", manufacturer: "Sanofi", supplierId: "sup1", dosageForm: "Tablet", strength: "5mg", active: true },
  { id: "pp13", name: "Smecta 3g", genericName: "Diosmectite", category: "medication", description: "Anti-diarrheal medication", price: 28, currency: "MAD", requiresPrescription: false, stockQuantity: 0, minimumStock: 20, expiryDate: "2027-10-10", manufacturer: "Ipsen", supplierId: "sup1", dosageForm: "Powder", strength: "3g", active: true },
  { id: "pp14", name: "Bioderma Sensibio H2O", category: "cosmetics", description: "Micellar water for sensitive skin", price: 135, currency: "MAD", requiresPrescription: false, stockQuantity: 18, minimumStock: 8, expiryDate: "2028-03-20", manufacturer: "Bioderma", supplierId: "sup3", active: true },
  { id: "pp15", name: "Omega 3 Fish Oil", category: "supplements", description: "Essential fatty acids for heart health", price: 85, currency: "MAD", requiresPrescription: false, stockQuantity: 55, minimumStock: 15, expiryDate: "2027-05-15", manufacturer: "Nature's Bounty", supplierId: "sup4", dosageForm: "Softgel", active: true },
];

export const pharmacyServices: PharmacyService[] = [
  { id: "ps1", name: "Blood Pressure Check", description: "Quick and accurate blood pressure measurement with consultation", price: 0, currency: "MAD", duration: 10, available: true, icon: "Heart" },
  { id: "ps2", name: "Blood Sugar Test", description: "Glucose level testing with instant results", price: 20, currency: "MAD", duration: 10, available: true, icon: "Droplet" },
  { id: "ps3", name: "Vaccination / Injection", description: "Professional injection administration (bring your prescription)", price: 30, currency: "MAD", duration: 15, available: true, icon: "Syringe" },
  { id: "ps4", name: "Medication Counseling", description: "One-on-one consultation about your medications and interactions", price: 0, currency: "MAD", duration: 20, available: true, icon: "MessageCircle" },
  { id: "ps5", name: "First Aid", description: "Basic wound care and first aid treatment", price: 30, currency: "MAD", duration: 15, available: true, icon: "Cross" },
  { id: "ps6", name: "Weight & BMI Check", description: "Weight measurement and BMI calculation with health advice", price: 0, currency: "MAD", duration: 5, available: true, icon: "Scale" },
  { id: "ps7", name: "Home Delivery", description: "Medication delivery to your doorstep within the city", price: 20, currency: "MAD", duration: 0, available: true, icon: "Truck" },
];

export const pharmacyPrescriptions: PharmacyPrescription[] = [
  {
    id: "prx1", patientId: "p1", patientName: "Karim Mansouri", patientPhone: "+212 6 11 22 33 44",
    imageUrl: "/prescriptions/rx-001.jpg", uploadedAt: "2026-03-20T08:30:00Z",
    status: "pending",
    items: [
      { id: "pi1", productId: "pp2", productName: "Augmentin 1g", quantity: 2, available: true, price: 170 },
      { id: "pi2", productId: "pp6", productName: "Aspégic 1000mg", quantity: 1, available: true, price: 22 },
    ],
    totalPrice: 192, currency: "MAD", deliveryOption: "pickup", isChronic: false, whatsappNotified: false,
  },
  {
    id: "prx2", patientId: "p3", patientName: "Omar Tazi", patientPhone: "+212 6 33 44 55 66",
    imageUrl: "/prescriptions/rx-002.jpg", uploadedAt: "2026-03-20T07:15:00Z",
    status: "partially-ready",
    pharmacistNotes: "Crestor out of stock, ordered from supplier. Expected tomorrow.",
    items: [
      { id: "pi3", productId: "pp5", productName: "Glucophage 850mg", quantity: 3, available: true, price: 105 },
      { id: "pi4", productId: "pp11", productName: "Crestor 10mg", quantity: 1, available: false, price: 95, notes: "Out of stock - ordered" },
      { id: "pi5", productId: "pp6", productName: "Aspégic 1000mg", quantity: 1, available: true, price: 22 },
    ],
    totalPrice: 222, currency: "MAD", deliveryOption: "pickup", isChronic: true, refillReminderDate: "2026-04-19", whatsappNotified: true,
  },
  {
    id: "prx3", patientId: "p2", patientName: "Nadia El Fassi", patientPhone: "+212 6 22 33 44 55",
    imageUrl: "/prescriptions/rx-003.jpg", uploadedAt: "2026-03-19T16:00:00Z",
    status: "ready",
    items: [
      { id: "pi6", productId: "pp3", productName: "Ventoline Inhaler", quantity: 1, available: true, price: 45 },
      { id: "pi7", productId: "pp1", productName: "Doliprane 1000mg", quantity: 1, available: true, price: 18 },
    ],
    totalPrice: 63, currency: "MAD", deliveryOption: "delivery", deliveryAddress: "45 Rue Hassan II, Casablanca", isChronic: false, whatsappNotified: true,
  },
  {
    id: "prx4", patientId: "p5", patientName: "Hassan Idrissi", patientPhone: "+212 6 55 66 77 88",
    imageUrl: "/prescriptions/rx-004.jpg", uploadedAt: "2026-03-18T10:00:00Z",
    status: "picked-up",
    items: [
      { id: "pi8", productId: "pp4", productName: "Nexium 40mg", quantity: 2, available: true, price: 240 },
    ],
    totalPrice: 240, currency: "MAD", deliveryOption: "pickup", isChronic: true, refillReminderDate: "2026-04-17", whatsappNotified: true,
  },
  {
    id: "prx5", patientId: "p4", patientName: "Salma Berrada", patientPhone: "+212 6 44 55 66 77",
    imageUrl: "/prescriptions/rx-005.jpg", uploadedAt: "2026-03-20T09:00:00Z",
    status: "reviewing",
    items: [
      { id: "pi9", productId: "pp12", productName: "Tensopril 5mg", quantity: 2, available: false, price: 84, notes: "Low stock" },
      { id: "pi10", productId: "pp10", productName: "Vitamin D3 1000IU", quantity: 1, available: true, price: 65 },
    ],
    totalPrice: 149, currency: "MAD", deliveryOption: "pickup", isChronic: true, refillReminderDate: "2026-04-20", whatsappNotified: false,
  },
];

export const suppliers: Supplier[] = [
  { id: "sup1", name: "Pharma Distribution Maroc", contactPerson: "Mohammed Alaoui", phone: "+212 5 22 30 40 50", email: "contact@pdmaroc.ma", address: "Zone Industrielle, Lot 45", city: "Casablanca", categories: ["medication", "otc"], rating: 4.5, paymentTerms: "Net 30", deliveryDays: 2, active: true },
  { id: "sup2", name: "MedSupply SARL", contactPerson: "Rachid Bennani", phone: "+212 5 37 70 80 90", email: "orders@medsupply.ma", address: "Avenue Hassan II, N12", city: "Rabat", categories: ["medication", "supplements"], rating: 4.2, paymentTerms: "Net 45", deliveryDays: 3, active: true },
  { id: "sup3", name: "DermaCare Distribution", contactPerson: "Laila Fassi", phone: "+212 5 24 40 50 60", email: "info@dermacare.ma", address: "Quartier Industriel, Bloc B", city: "Marrakech", categories: ["cosmetics", "baby"], rating: 4.7, paymentTerms: "Net 30", deliveryDays: 4, active: true },
  { id: "sup4", name: "HealthTech Maroc", contactPerson: "Youssef Kabbaj", phone: "+212 5 39 20 30 40", email: "sales@healthtech.ma", address: "Technopolis, Bldg 3", city: "Tangier", categories: ["medical-devices", "supplements"], rating: 4.0, paymentTerms: "Net 60", deliveryDays: 5, active: true },
];

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po1", supplierId: "sup1", supplierName: "Pharma Distribution Maroc",
    items: [
      { productId: "pp1", productName: "Doliprane 1000mg", quantity: 100, unitPrice: 12 },
      { productId: "pp2", productName: "Augmentin 1g", quantity: 50, unitPrice: 60 },
      { productId: "pp13", productName: "Smecta 3g", quantity: 80, unitPrice: 18 },
    ],
    totalAmount: 5640, currency: "MAD", status: "confirmed", createdAt: "2026-03-18", expectedDelivery: "2026-03-21",
  },
  {
    id: "po2", supplierId: "sup2", supplierName: "MedSupply SARL",
    items: [
      { productId: "pp11", productName: "Crestor 10mg", quantity: 30, unitPrice: 70 },
      { productId: "pp4", productName: "Nexium 40mg", quantity: 40, unitPrice: 85 },
    ],
    totalAmount: 5500, currency: "MAD", status: "shipped", createdAt: "2026-03-15", expectedDelivery: "2026-03-20",
  },
  {
    id: "po3", supplierId: "sup3", supplierName: "DermaCare Distribution",
    items: [
      { productId: "pp7", productName: "Avène Cleanance Gel", quantity: 20, unitPrice: 100 },
      { productId: "pp14", productName: "Bioderma Sensibio H2O", quantity: 15, unitPrice: 95 },
    ],
    totalAmount: 3425, currency: "MAD", status: "delivered", createdAt: "2026-03-10", expectedDelivery: "2026-03-14", deliveredAt: "2026-03-14",
  },
  {
    id: "po4", supplierId: "sup1", supplierName: "Pharma Distribution Maroc",
    items: [
      { productId: "pp12", productName: "Tensopril 5mg", quantity: 40, unitPrice: 28 },
    ],
    totalAmount: 1120, currency: "MAD", status: "draft", createdAt: "2026-03-20", expectedDelivery: "2026-03-23",
  },
];

export const dailySales: DailySale[] = [
  { id: "ds1", date: "2026-03-20", time: "09:15", patientName: "Karim Mansouri", items: [{ productName: "Doliprane 1000mg", quantity: 2, price: 36 }, { productName: "Vitamin D3 1000IU", quantity: 1, price: 65 }], total: 101, currency: "MAD", paymentMethod: "cash", hasPrescription: false, loyaltyPointsEarned: 101 },
  { id: "ds2", date: "2026-03-20", time: "09:45", patientName: "Nadia El Fassi", items: [{ productName: "Ventoline Inhaler", quantity: 1, price: 45 }], total: 45, currency: "MAD", paymentMethod: "card", hasPrescription: true, loyaltyPointsEarned: 45 },
  { id: "ds3", date: "2026-03-20", time: "10:30", patientName: "Omar Tazi", items: [{ productName: "Glucophage 850mg", quantity: 3, price: 105 }, { productName: "Aspégic 1000mg", quantity: 1, price: 22 }], total: 127, currency: "MAD", paymentMethod: "insurance", hasPrescription: true, loyaltyPointsEarned: 127 },
  { id: "ds4", date: "2026-03-20", time: "11:00", patientName: "Salma Berrada", items: [{ productName: "Avène Cleanance Gel", quantity: 1, price: 145 }], total: 145, currency: "MAD", paymentMethod: "card", hasPrescription: false, loyaltyPointsEarned: 145 },
  { id: "ds5", date: "2026-03-20", time: "11:30", patientName: "Hassan Idrissi", items: [{ productName: "Nexium 40mg", quantity: 2, price: 240 }], total: 240, currency: "MAD", paymentMethod: "cash", hasPrescription: true, loyaltyPointsEarned: 240 },
  { id: "ds6", date: "2026-03-19", time: "09:00", patientName: "Amina Chaoui", items: [{ productName: "Pampers Premium Size 3", quantity: 2, price: 190 }], total: 190, currency: "MAD", paymentMethod: "cash", hasPrescription: false, loyaltyPointsEarned: 190 },
  { id: "ds7", date: "2026-03-19", time: "10:15", patientName: "Karim Mansouri", items: [{ productName: "Omega 3 Fish Oil", quantity: 1, price: 85 }], total: 85, currency: "MAD", paymentMethod: "card", hasPrescription: false, loyaltyPointsEarned: 85 },
  { id: "ds8", date: "2026-03-19", time: "14:00", patientName: "Omar Tazi", items: [{ productName: "Glucophage 850mg", quantity: 3, price: 105 }, { productName: "Crestor 10mg", quantity: 1, price: 95 }], total: 200, currency: "MAD", paymentMethod: "insurance", hasPrescription: true, loyaltyPointsEarned: 200 },
];

export const loyaltyMembers: LoyaltyMember[] = [
  { id: "lm1", patientId: "p1", patientName: "Karim Mansouri", phone: "+212 6 11 22 33 44", email: "karim@email.com", totalPoints: 2850, availablePoints: 1850, redeemedPoints: 1000, joinedAt: "2025-06-15", dateOfBirth: "1991-03-12", tier: "gold", referralCode: "KARIM2025", totalPurchases: 2850, birthdayRewardClaimed: false },
  { id: "lm2", patientId: "p2", patientName: "Nadia El Fassi", phone: "+212 6 22 33 44 55", email: "nadia@email.com", totalPoints: 650, availablePoints: 650, redeemedPoints: 0, joinedAt: "2025-11-20", dateOfBirth: "1998-07-22", tier: "bronze", referralCode: "NADIA2025", totalPurchases: 650, birthdayRewardClaimed: false },
  { id: "lm3", patientId: "p3", patientName: "Omar Tazi", phone: "+212 6 33 44 55 66", email: "omar@email.com", totalPoints: 5200, availablePoints: 3200, redeemedPoints: 2000, joinedAt: "2025-03-01", dateOfBirth: "1984-11-05", tier: "platinum", referralCode: "OMAR2025", referredBy: "KARIM2025", totalPurchases: 5200, birthdayRewardClaimed: true, birthdayRewardYear: 2025 },
  { id: "lm4", patientId: "p4", patientName: "Salma Berrada", phone: "+212 6 44 55 66 77", email: "salma@email.com", totalPoints: 1200, availablePoints: 1200, redeemedPoints: 0, joinedAt: "2025-08-10", dateOfBirth: "1995-01-18", tier: "silver", referralCode: "SALMA2025", totalPurchases: 1200, birthdayRewardClaimed: true, birthdayRewardYear: 2026 },
  { id: "lm5", patientId: "p5", patientName: "Hassan Idrissi", phone: "+212 6 55 66 77 88", email: "hassan@email.com", totalPoints: 3400, availablePoints: 2400, redeemedPoints: 1000, joinedAt: "2025-04-05", dateOfBirth: "1971-09-30", tier: "gold", referralCode: "HASSAN2025", totalPurchases: 3400, birthdayRewardClaimed: false },
  { id: "lm6", patientId: "p6", patientName: "Amina Chaoui", phone: "+212 6 66 77 88 99", email: "amina@email.com", totalPoints: 450, availablePoints: 450, redeemedPoints: 0, joinedAt: "2026-01-12", dateOfBirth: "2002-04-14", tier: "bronze", referralCode: "AMINA2026", referredBy: "OMAR2025", totalPurchases: 450, birthdayRewardClaimed: false },
];

export const loyaltyTransactions: LoyaltyTransaction[] = [
  { id: "lt1", memberId: "lm1", type: "earned", points: 101, description: "Purchase - Doliprane + Vitamin D3", date: "2026-03-20", saleId: "ds1" },
  { id: "lt2", memberId: "lm2", type: "earned", points: 45, description: "Purchase - Ventoline Inhaler", date: "2026-03-20", saleId: "ds2" },
  { id: "lt3", memberId: "lm3", type: "earned", points: 127, description: "Purchase - Glucophage + Aspégic", date: "2026-03-20", saleId: "ds3" },
  { id: "lt4", memberId: "lm4", type: "earned", points: 145, description: "Purchase - Avène Cleanance Gel", date: "2026-03-20", saleId: "ds4" },
  { id: "lt5", memberId: "lm5", type: "earned", points: 240, description: "Purchase - Nexium 40mg", date: "2026-03-20", saleId: "ds5" },
  { id: "lt6", memberId: "lm1", type: "redeemed", points: -500, description: "Discount redeemed - 50 MAD off", date: "2026-03-10" },
  { id: "lt7", memberId: "lm3", type: "birthday_bonus", points: 200, description: "Birthday bonus reward", date: "2025-11-05" },
  { id: "lt8", memberId: "lm3", type: "referral_bonus", points: 100, description: "Referral bonus - Amina Chaoui joined", date: "2026-01-12" },
  { id: "lt9", memberId: "lm6", type: "referral_bonus", points: 50, description: "Welcome bonus - Referred by Omar Tazi", date: "2026-01-12" },
  { id: "lt10", memberId: "lm1", type: "earned", points: 85, description: "Purchase - Omega 3 Fish Oil", date: "2026-03-19", saleId: "ds7" },
];

export const onDutySchedule: OnDutySchedule[] = [
  { id: "od1", date: "2026-03-20", startTime: "20:00", endTime: "08:00", isOnDuty: false },
  { id: "od2", date: "2026-03-21", startTime: "20:00", endTime: "08:00", isOnDuty: true, notes: "Night duty - Saturday" },
  { id: "od3", date: "2026-03-22", startTime: "08:00", endTime: "20:00", isOnDuty: true, notes: "Sunday all day" },
  { id: "od4", date: "2026-03-28", startTime: "20:00", endTime: "08:00", isOnDuty: true, notes: "Night duty - Saturday" },
];

export const inventoryReports: InventoryReport[] = [
  {
    month: "March", year: 2026, totalProducts: 15, totalStockValue: 45600, lowStockItems: 3, expiringSoon: 2, expired: 0, totalSales: 28500,
    topSellingProducts: [
      { name: "Doliprane 1000mg", quantity: 180, revenue: 3240 },
      { name: "Glucophage 850mg", quantity: 95, revenue: 3325 },
      { name: "Nexium 40mg", quantity: 45, revenue: 5400 },
      { name: "Avène Cleanance Gel", quantity: 30, revenue: 4350 },
      { name: "Vitamin D3 1000IU", quantity: 40, revenue: 2600 },
    ],
  },
  {
    month: "February", year: 2026, totalProducts: 15, totalStockValue: 42300, lowStockItems: 2, expiringSoon: 1, expired: 0, totalSales: 26800,
    topSellingProducts: [
      { name: "Doliprane 1000mg", quantity: 165, revenue: 2970 },
      { name: "Augmentin 1g", quantity: 60, revenue: 5100 },
      { name: "Nexium 40mg", quantity: 40, revenue: 4800 },
      { name: "Pampers Premium Size 3", quantity: 35, revenue: 3325 },
      { name: "Omega 3 Fish Oil", quantity: 25, revenue: 2125 },
    ],
  },
];

// ---------- Helper Functions ----------

export function getProductsByCategory(category: PharmacyProduct["category"]): PharmacyProduct[] {
  return pharmacyProducts.filter((p) => p.category === category && p.active);
}

export function getLowStockProducts(): PharmacyProduct[] {
  return pharmacyProducts.filter((p) => p.stockQuantity <= p.minimumStock && p.active);
}

export function getOutOfStockProducts(): PharmacyProduct[] {
  return pharmacyProducts.filter((p) => p.stockQuantity === 0 && p.active);
}

export function getExpiringProducts(withinDays: number = 90): PharmacyProduct[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  return pharmacyProducts.filter((p) => {
    const expiry = new Date(p.expiryDate);
    return expiry <= cutoff && p.active;
  });
}

export function getExpiredProducts(): PharmacyProduct[] {
  const now = new Date();
  return pharmacyProducts.filter((p) => {
    const expiry = new Date(p.expiryDate);
    return expiry < now && p.active;
  });
}

export function getPendingPrescriptions(): PharmacyPrescription[] {
  return pharmacyPrescriptions.filter((p) => p.status === "pending" || p.status === "reviewing");
}

export function getChronicPrescriptions(): PharmacyPrescription[] {
  return pharmacyPrescriptions.filter((p) => p.isChronic);
}

export function getTodaySales(): DailySale[] {
  const today = new Date().toISOString().split("T")[0];
  return dailySales.filter((s) => s.date === today);
}

export function getTodayRevenue(): number {
  return getTodaySales().reduce((sum, s) => sum + s.total, 0);
}

export function getNextOnDuty(): OnDutySchedule | undefined {
  const now = new Date();
  return onDutySchedule
    .filter((d) => d.isOnDuty && new Date(d.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
}

export function isCurrentlyOnDuty(): boolean {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  return onDutySchedule.some((d) => d.date === today && d.isOnDuty);
}

export function getLoyaltyTier(points: number): LoyaltyMember["tier"] {
  if (points >= 5000) return "platinum";
  if (points >= 3000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

export function getPointsValue(points: number): number {
  // 10 points = 1 MAD discount
  return Math.floor(points / 10);
}

export function searchProducts(query: string): PharmacyProduct[] {
  const q = query.toLowerCase();
  return pharmacyProducts.filter(
    (p) =>
      p.active &&
      (p.name.toLowerCase().includes(q) ||
        p.genericName?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q))
  );
}

export function getExpiryStatus(expiryDate: string): "green" | "yellow" | "red" {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry <= 0) return "red";
  if (daysUntilExpiry <= 90) return "yellow";
  return "green";
}

export function getStockStatus(product: PharmacyProduct): "out" | "low" | "ok" {
  if (product.stockQuantity === 0) return "out";
  if (product.stockQuantity <= product.minimumStock) return "low";
  return "ok";
}
