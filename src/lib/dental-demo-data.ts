/**
 * Demo data for dental-specific features (Tasks 12-14).
 * Odontogram, treatment plans, lab orders, sterilization logs,
 * installment payments, and dental services.
 */

// ---------- Dental Treatment Types ----------

export interface DentalTreatmentType {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  description: string;
}

export const dentalTreatmentTypes: DentalTreatmentType[] = [
  { id: "dt1", name: "Dental Cleaning", category: "Preventive", durationMinutes: 45, price: 300, currency: "MAD", description: "Professional teeth cleaning and polishing" },
  { id: "dt2", name: "Tooth Filling", category: "Restorative", durationMinutes: 60, price: 500, currency: "MAD", description: "Composite or amalgam filling for cavities" },
  { id: "dt3", name: "Dental Implant", category: "Surgical", durationMinutes: 120, price: 8000, currency: "MAD", description: "Titanium implant placement for missing teeth" },
  { id: "dt4", name: "Braces Adjustment", category: "Orthodontics", durationMinutes: 30, price: 400, currency: "MAD", description: "Monthly orthodontic braces adjustment" },
  { id: "dt5", name: "Tooth Extraction", category: "Surgical", durationMinutes: 45, price: 600, currency: "MAD", description: "Simple or surgical tooth extraction" },
  { id: "dt6", name: "Root Canal", category: "Endodontics", durationMinutes: 90, price: 2000, currency: "MAD", description: "Root canal treatment to save damaged teeth" },
  { id: "dt7", name: "Crown Placement", category: "Restorative", durationMinutes: 60, price: 3000, currency: "MAD", description: "Porcelain or ceramic crown placement" },
  { id: "dt8", name: "Teeth Whitening", category: "Cosmetic", durationMinutes: 60, price: 1500, currency: "MAD", description: "Professional in-office teeth whitening" },
];

// ---------- Odontogram Data ----------

export type ToothStatus = "healthy" | "decayed" | "filled" | "missing" | "crown" | "implant" | "root_canal" | "extraction_needed";

export interface OdontogramEntry {
  toothNumber: number;
  status: ToothStatus;
  notes: string;
  lastUpdated: string;
}

export interface PatientOdontogram {
  patientId: string;
  patientName: string;
  entries: OdontogramEntry[];
}

export const patientOdontograms: PatientOdontogram[] = [
  {
    patientId: "p1",
    patientName: "Karim Mansouri",
    entries: [
      { toothNumber: 11, status: "healthy", notes: "", lastUpdated: "2026-03-01" },
      { toothNumber: 12, status: "filled", notes: "Composite filling placed 2025-12", lastUpdated: "2025-12-15" },
      { toothNumber: 14, status: "crown", notes: "Porcelain crown, good fit", lastUpdated: "2025-10-20" },
      { toothNumber: 16, status: "root_canal", notes: "Root canal completed, needs crown", lastUpdated: "2026-02-10" },
      { toothNumber: 21, status: "healthy", notes: "", lastUpdated: "2026-03-01" },
      { toothNumber: 22, status: "healthy", notes: "", lastUpdated: "2026-03-01" },
      { toothNumber: 26, status: "decayed", notes: "Mesial cavity, needs filling", lastUpdated: "2026-03-15" },
      { toothNumber: 36, status: "missing", notes: "Extracted 2024, implant planned", lastUpdated: "2024-06-01" },
      { toothNumber: 46, status: "filled", notes: "Amalgam filling, monitor", lastUpdated: "2025-08-10" },
      { toothNumber: 47, status: "extraction_needed", notes: "Severely decayed, non-restorable", lastUpdated: "2026-03-15" },
    ],
  },
  {
    patientId: "p2",
    patientName: "Nadia El Fassi",
    entries: [
      { toothNumber: 11, status: "healthy", notes: "", lastUpdated: "2026-02-01" },
      { toothNumber: 21, status: "healthy", notes: "", lastUpdated: "2026-02-01" },
      { toothNumber: 24, status: "decayed", notes: "Small occlusal cavity", lastUpdated: "2026-03-10" },
      { toothNumber: 35, status: "filled", notes: "Recent composite filling", lastUpdated: "2026-01-15" },
      { toothNumber: 38, status: "extraction_needed", notes: "Impacted wisdom tooth", lastUpdated: "2026-03-10" },
    ],
  },
];

// ---------- Treatment Plans ----------

export interface TreatmentStep {
  step: number;
  description: string;
  status: "pending" | "in_progress" | "completed";
  date: string | null;
  cost: number;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  title: string;
  steps: TreatmentStep[];
  totalCost: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export const treatmentPlans: TreatmentPlan[] = [
  {
    id: "tp1",
    patientId: "p1",
    patientName: "Karim Mansouri",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    title: "Full Mouth Rehabilitation",
    steps: [
      { step: 1, description: "Deep cleaning & scaling", status: "completed", date: "2026-01-15", cost: 400 },
      { step: 2, description: "Fill cavity on tooth #26", status: "completed", date: "2026-02-10", cost: 500 },
      { step: 3, description: "Crown on tooth #16 (post root canal)", status: "in_progress", date: "2026-03-20", cost: 3000 },
      { step: 4, description: "Extract tooth #47", status: "pending", date: null, cost: 600 },
      { step: 5, description: "Implant placement on tooth #36", status: "pending", date: null, cost: 8000 },
      { step: 6, description: "Final crown on implant #36", status: "pending", date: null, cost: 3000 },
    ],
    totalCost: 15500,
    status: "in_progress",
    createdAt: "2026-01-10",
    updatedAt: "2026-03-15",
  },
  {
    id: "tp2",
    patientId: "p2",
    patientName: "Nadia El Fassi",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    title: "Orthodontic Treatment Plan",
    steps: [
      { step: 1, description: "Extract wisdom tooth #38", status: "pending", date: null, cost: 600 },
      { step: 2, description: "Fill cavity on tooth #24", status: "pending", date: null, cost: 500 },
      { step: 3, description: "Braces installation", status: "pending", date: null, cost: 15000 },
      { step: 4, description: "Monthly adjustments (12 months)", status: "pending", date: null, cost: 4800 },
      { step: 5, description: "Braces removal & retainer", status: "pending", date: null, cost: 2000 },
    ],
    totalCost: 22900,
    status: "planned",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
  },
];

// ---------- Lab Orders ----------

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  labName: string;
  description: string;
  status: "pending" | "sent" | "in_progress" | "ready" | "delivered";
  dueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const labOrders: LabOrder[] = [
  {
    id: "lo1",
    patientId: "p1",
    patientName: "Karim Mansouri",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    labName: "DentaLab Casablanca",
    description: "Porcelain crown for tooth #16 - shade A2",
    status: "in_progress",
    dueDate: "2026-03-25",
    notes: "Rush order, patient appointment on 28th",
    createdAt: "2026-03-15",
    updatedAt: "2026-03-18",
  },
  {
    id: "lo2",
    patientId: "p1",
    patientName: "Karim Mansouri",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    labName: "DentaLab Casablanca",
    description: "Implant abutment for tooth #36",
    status: "pending",
    dueDate: null,
    notes: "Wait for implant integration (3 months)",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-10",
  },
  {
    id: "lo3",
    patientId: "p4",
    patientName: "Salma Berrada",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    labName: "ProDent Lab Rabat",
    description: "Upper and lower orthodontic study models",
    status: "ready",
    dueDate: "2026-03-20",
    notes: "Models ready for pickup",
    createdAt: "2026-03-05",
    updatedAt: "2026-03-19",
  },
  {
    id: "lo4",
    patientId: "p3",
    patientName: "Omar Tazi",
    doctorId: "d1",
    doctorName: "Dr. Ahmed Benali",
    labName: "DentaLab Casablanca",
    description: "Night guard - hard acrylic",
    status: "delivered",
    dueDate: "2026-03-12",
    notes: "Delivered and fitted",
    createdAt: "2026-03-01",
    updatedAt: "2026-03-12",
  },
];

// ---------- Sterilization Log ----------

export interface SterilizationEntry {
  id: string;
  toolName: string;
  sterilizedBy: string;
  sterilizedAt: string;
  nextDue: string | null;
  method: "autoclave" | "chemical" | "dry_heat";
  notes: string;
}

export const sterilizationLog: SterilizationEntry[] = [
  { id: "st1", toolName: "Dental Handpiece Set A", sterilizedBy: "Assistant Amira", sterilizedAt: "2026-03-20T08:00:00Z", nextDue: "2026-03-20T14:00:00Z", method: "autoclave", notes: "Cycle 132C, 4 min" },
  { id: "st2", toolName: "Extraction Forceps Set", sterilizedBy: "Assistant Amira", sterilizedAt: "2026-03-20T08:15:00Z", nextDue: "2026-03-21T08:00:00Z", method: "autoclave", notes: "Standard cycle" },
  { id: "st3", toolName: "Scaling Instruments", sterilizedBy: "Assistant Yousra", sterilizedAt: "2026-03-20T07:30:00Z", nextDue: "2026-03-20T13:30:00Z", method: "autoclave", notes: "" },
  { id: "st4", toolName: "Impression Trays", sterilizedBy: "Assistant Amira", sterilizedAt: "2026-03-19T16:00:00Z", nextDue: "2026-03-20T16:00:00Z", method: "chemical", notes: "Glutaraldehyde 2%" },
  { id: "st5", toolName: "Surgical Instrument Pack", sterilizedBy: "Assistant Yousra", sterilizedAt: "2026-03-19T08:00:00Z", nextDue: "2026-03-20T08:00:00Z", method: "autoclave", notes: "Overdue for re-sterilization" },
];

// ---------- Material Stock ----------

export interface MaterialStock {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  lastRestocked: string;
  supplier: string;
}

export const materialStock: MaterialStock[] = [
  { id: "ms1", name: "Composite Resin A2", category: "Restorative", quantity: 3, unit: "syringes", minThreshold: 5, lastRestocked: "2026-02-15", supplier: "DentalMart MA" },
  { id: "ms2", name: "Composite Resin A3", category: "Restorative", quantity: 8, unit: "syringes", minThreshold: 5, lastRestocked: "2026-03-01", supplier: "DentalMart MA" },
  { id: "ms3", name: "Latex Gloves (M)", category: "Disposables", quantity: 2, unit: "boxes", minThreshold: 5, lastRestocked: "2026-03-10", supplier: "MedSupply SARL" },
  { id: "ms4", name: "Latex Gloves (L)", category: "Disposables", quantity: 8, unit: "boxes", minThreshold: 5, lastRestocked: "2026-03-10", supplier: "MedSupply SARL" },
  { id: "ms5", name: "Anesthetic Carpules", category: "Anesthesia", quantity: 45, unit: "carpules", minThreshold: 20, lastRestocked: "2026-03-05", supplier: "Pharma Distrib" },
  { id: "ms6", name: "Dental Needles 27G", category: "Disposables", quantity: 60, unit: "pcs", minThreshold: 30, lastRestocked: "2026-03-05", supplier: "Pharma Distrib" },
  { id: "ms7", name: "Alginate Impression Material", category: "Impression", quantity: 1, unit: "kg", minThreshold: 3, lastRestocked: "2026-02-20", supplier: "DentalMart MA" },
  { id: "ms8", name: "Temporary Cement", category: "Cementation", quantity: 4, unit: "tubes", minThreshold: 3, lastRestocked: "2026-03-01", supplier: "DentalMart MA" },
  { id: "ms9", name: "Surgical Masks", category: "Disposables", quantity: 150, unit: "pcs", minThreshold: 50, lastRestocked: "2026-03-15", supplier: "MedSupply SARL" },
  { id: "ms10", name: "Bonding Agent", category: "Restorative", quantity: 2, unit: "bottles", minThreshold: 3, lastRestocked: "2026-02-10", supplier: "DentalMart MA" },
];

// ---------- Before/After Photos ----------

export interface BeforeAfterPhoto {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  description: string;
  beforeDate: string;
  afterDate: string | null;
  category: string;
}

export const beforeAfterPhotos: BeforeAfterPhoto[] = [
  { id: "ba1", patientId: "p1", patientName: "Karim Mansouri", treatmentPlanId: "tp1", description: "Tooth #16 - Before & after root canal + crown", beforeDate: "2026-01-10", afterDate: "2026-03-15", category: "Root Canal" },
  { id: "ba2", patientId: "p1", patientName: "Karim Mansouri", treatmentPlanId: "tp1", description: "Tooth #26 - Before & after filling", beforeDate: "2026-02-05", afterDate: "2026-02-10", category: "Filling" },
  { id: "ba3", patientId: "p4", patientName: "Salma Berrada", treatmentPlanId: "", description: "Teeth whitening - full arch", beforeDate: "2026-03-01", afterDate: "2026-03-01", category: "Whitening" },
];

// ---------- Pain Questionnaire ----------

export interface PainQuestionnaire {
  patientId: string;
  appointmentId: string;
  painLevel: number; // 1-10
  painLocation: string;
  painDuration: string;
  painType: string;
  triggers: string[];
  hasSwelling: boolean;
  hasBleeding: boolean;
  additionalNotes: string;
}

export const painQuestionnaires: PainQuestionnaire[] = [
  {
    patientId: "p1",
    appointmentId: "a1",
    painLevel: 6,
    painLocation: "Lower right molar area",
    painDuration: "2 weeks",
    painType: "Throbbing",
    triggers: ["Hot food", "Chewing"],
    hasSwelling: false,
    hasBleeding: true,
    additionalNotes: "Pain worse at night",
  },
];

// ---------- Installment Plans ----------

export interface InstallmentPayment {
  id: string;
  installmentPlanId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "pending" | "paid" | "overdue";
  receiptId: string | null;
}

export interface InstallmentPlan {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  treatmentTitle: string;
  totalAmount: number;
  currency: string;
  downPayment: number;
  numberOfInstallments: number;
  installments: InstallmentPayment[];
  createdAt: string;
  status: "active" | "completed" | "defaulted";
  whatsappReminderEnabled: boolean;
}

export const installmentPlans: InstallmentPlan[] = [
  {
    id: "ip1",
    patientId: "p1",
    patientName: "Karim Mansouri",
    treatmentPlanId: "tp1",
    treatmentTitle: "Full Mouth Rehabilitation",
    totalAmount: 15500,
    currency: "MAD",
    downPayment: 3500,
    numberOfInstallments: 6,
    installments: [
      { id: "inst1", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-02-01", paidDate: "2026-01-30", status: "paid", receiptId: "rcpt-001" },
      { id: "inst2", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-03-01", paidDate: "2026-03-01", status: "paid", receiptId: "rcpt-002" },
      { id: "inst3", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-04-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst4", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-05-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst5", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-06-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst6", installmentPlanId: "ip1", amount: 2000, dueDate: "2026-07-01", paidDate: null, status: "pending", receiptId: null },
    ],
    createdAt: "2026-01-10",
    status: "active",
    whatsappReminderEnabled: true,
  },
  {
    id: "ip2",
    patientId: "p2",
    patientName: "Nadia El Fassi",
    treatmentPlanId: "tp2",
    treatmentTitle: "Orthodontic Treatment Plan",
    totalAmount: 22900,
    currency: "MAD",
    downPayment: 4900,
    numberOfInstallments: 12,
    installments: [
      { id: "inst7", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-04-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst8", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-05-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst9", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-06-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst10", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-07-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst11", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-08-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst12", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-09-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst13", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-10-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst14", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-11-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst15", installmentPlanId: "ip2", amount: 1500, dueDate: "2026-12-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst16", installmentPlanId: "ip2", amount: 1500, dueDate: "2027-01-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst17", installmentPlanId: "ip2", amount: 1500, dueDate: "2027-02-01", paidDate: null, status: "pending", receiptId: null },
      { id: "inst18", installmentPlanId: "ip2", amount: 1500, dueDate: "2027-03-01", paidDate: null, status: "pending", receiptId: null },
    ],
    createdAt: "2026-03-10",
    status: "active",
    whatsappReminderEnabled: true,
  },
];

// ---------- Analytics Demo Data ----------

export interface DailyAnalytics {
  date: string;
  patientCount: number;
  revenue: number;
  appointments: number;
  noShows: number;
  walkIns: number;
  onlineBookings: number;
}

export const dailyAnalytics: DailyAnalytics[] = [
  { date: "2026-03-01", patientCount: 12, revenue: 4200, appointments: 14, noShows: 1, walkIns: 3, onlineBookings: 11 },
  { date: "2026-03-02", patientCount: 0, revenue: 0, appointments: 0, noShows: 0, walkIns: 0, onlineBookings: 0 },
  { date: "2026-03-03", patientCount: 15, revenue: 5100, appointments: 16, noShows: 0, walkIns: 4, onlineBookings: 12 },
  { date: "2026-03-04", patientCount: 11, revenue: 3800, appointments: 13, noShows: 2, walkIns: 2, onlineBookings: 11 },
  { date: "2026-03-05", patientCount: 14, revenue: 4900, appointments: 15, noShows: 1, walkIns: 3, onlineBookings: 12 },
  { date: "2026-03-06", patientCount: 13, revenue: 4500, appointments: 14, noShows: 0, walkIns: 2, onlineBookings: 12 },
  { date: "2026-03-07", patientCount: 10, revenue: 3200, appointments: 11, noShows: 1, walkIns: 1, onlineBookings: 10 },
  { date: "2026-03-08", patientCount: 8, revenue: 2800, appointments: 9, noShows: 0, walkIns: 2, onlineBookings: 7 },
  { date: "2026-03-09", patientCount: 0, revenue: 0, appointments: 0, noShows: 0, walkIns: 0, onlineBookings: 0 },
  { date: "2026-03-10", patientCount: 16, revenue: 5800, appointments: 18, noShows: 1, walkIns: 5, onlineBookings: 13 },
  { date: "2026-03-11", patientCount: 14, revenue: 4600, appointments: 15, noShows: 1, walkIns: 3, onlineBookings: 12 },
  { date: "2026-03-12", patientCount: 12, revenue: 4100, appointments: 13, noShows: 0, walkIns: 2, onlineBookings: 11 },
  { date: "2026-03-13", patientCount: 15, revenue: 5300, appointments: 16, noShows: 2, walkIns: 4, onlineBookings: 12 },
  { date: "2026-03-14", patientCount: 11, revenue: 3900, appointments: 12, noShows: 1, walkIns: 2, onlineBookings: 10 },
  { date: "2026-03-15", patientCount: 9, revenue: 3100, appointments: 10, noShows: 0, walkIns: 1, onlineBookings: 9 },
  { date: "2026-03-16", patientCount: 0, revenue: 0, appointments: 0, noShows: 0, walkIns: 0, onlineBookings: 0 },
  { date: "2026-03-17", patientCount: 17, revenue: 6200, appointments: 19, noShows: 1, walkIns: 6, onlineBookings: 13 },
  { date: "2026-03-18", patientCount: 13, revenue: 4400, appointments: 14, noShows: 0, walkIns: 3, onlineBookings: 11 },
  { date: "2026-03-19", patientCount: 15, revenue: 5500, appointments: 16, noShows: 1, walkIns: 4, onlineBookings: 12 },
  { date: "2026-03-20", patientCount: 14, revenue: 4800, appointments: 15, noShows: 0, walkIns: 3, onlineBookings: 12 },
];

export interface WeeklyRevenue {
  week: string;
  revenue: number;
  patients: number;
}

export const weeklyRevenue: WeeklyRevenue[] = [
  { week: "Week 1 (Mar 1-7)", revenue: 25700, patients: 75 },
  { week: "Week 2 (Mar 8-14)", revenue: 27700, patients: 76 },
  { week: "Week 3 (Mar 15-20)", revenue: 24000, patients: 68 },
];

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  patients: number;
  appointments: number;
}

export const monthlyRevenue: MonthlyRevenue[] = [
  { month: "Oct 2025", revenue: 68400, patients: 185, appointments: 220 },
  { month: "Nov 2025", revenue: 72100, patients: 195, appointments: 238 },
  { month: "Dec 2025", revenue: 58200, patients: 158, appointments: 190 },
  { month: "Jan 2026", revenue: 76500, patients: 210, appointments: 255 },
  { month: "Feb 2026", revenue: 81200, patients: 220, appointments: 268 },
  { month: "Mar 2026", revenue: 77400, patients: 219, appointments: 260 },
];

export interface ServicePopularity {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export const servicePopularity: ServicePopularity[] = [
  { serviceName: "Dental Cleaning", count: 85, revenue: 25500, percentage: 28 },
  { serviceName: "Tooth Filling", count: 62, revenue: 31000, percentage: 21 },
  { serviceName: "Root Canal", count: 18, revenue: 36000, percentage: 6 },
  { serviceName: "Crown Placement", count: 15, revenue: 45000, percentage: 5 },
  { serviceName: "Tooth Extraction", count: 28, revenue: 16800, percentage: 9 },
  { serviceName: "Braces Adjustment", count: 45, revenue: 18000, percentage: 15 },
  { serviceName: "Dental Implant", count: 8, revenue: 64000, percentage: 3 },
  { serviceName: "Teeth Whitening", count: 22, revenue: 33000, percentage: 7 },
  { serviceName: "Consultation", count: 19, revenue: 3800, percentage: 6 },
];

export interface HourlyHeatmap {
  day: string;
  hours: { hour: number; count: number }[];
}

export const hourlyHeatmap: HourlyHeatmap[] = [
  { day: "Mon", hours: [{ hour: 9, count: 4 }, { hour: 10, count: 6 }, { hour: 11, count: 5 }, { hour: 12, count: 2 }, { hour: 14, count: 5 }, { hour: 15, count: 4 }, { hour: 16, count: 3 }, { hour: 17, count: 1 }] },
  { day: "Tue", hours: [{ hour: 9, count: 5 }, { hour: 10, count: 7 }, { hour: 11, count: 6 }, { hour: 12, count: 3 }, { hour: 14, count: 6 }, { hour: 15, count: 5 }, { hour: 16, count: 4 }, { hour: 17, count: 2 }] },
  { day: "Wed", hours: [{ hour: 9, count: 3 }, { hour: 10, count: 5 }, { hour: 11, count: 4 }, { hour: 12, count: 1 }, { hour: 14, count: 4 }, { hour: 15, count: 3 }, { hour: 16, count: 2 }, { hour: 17, count: 1 }] },
  { day: "Thu", hours: [{ hour: 9, count: 6 }, { hour: 10, count: 8 }, { hour: 11, count: 7 }, { hour: 12, count: 3 }, { hour: 14, count: 7 }, { hour: 15, count: 6 }, { hour: 16, count: 5 }, { hour: 17, count: 2 }] },
  { day: "Fri", hours: [{ hour: 9, count: 4 }, { hour: 10, count: 6 }, { hour: 11, count: 5 }, { hour: 12, count: 2 }, { hour: 14, count: 5 }, { hour: 15, count: 4 }, { hour: 16, count: 3 }, { hour: 17, count: 1 }] },
  { day: "Sat", hours: [{ hour: 9, count: 7 }, { hour: 10, count: 9 }, { hour: 11, count: 8 }, { hour: 12, count: 4 }] },
];

export interface ReviewTrend {
  month: string;
  averageScore: number;
  count: number;
}

export const reviewTrends: ReviewTrend[] = [
  { month: "Oct 2025", averageScore: 4.2, count: 18 },
  { month: "Nov 2025", averageScore: 4.4, count: 22 },
  { month: "Dec 2025", averageScore: 4.3, count: 15 },
  { month: "Jan 2026", averageScore: 4.5, count: 25 },
  { month: "Feb 2026", averageScore: 4.6, count: 28 },
  { month: "Mar 2026", averageScore: 4.7, count: 20 },
];

export interface PatientRetention {
  month: string;
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}

export const patientRetention: PatientRetention[] = [
  { month: "Oct 2025", newPatients: 42, returningPatients: 143, retentionRate: 77 },
  { month: "Nov 2025", newPatients: 38, returningPatients: 157, retentionRate: 80 },
  { month: "Dec 2025", newPatients: 25, returningPatients: 133, retentionRate: 84 },
  { month: "Jan 2026", newPatients: 45, returningPatients: 165, retentionRate: 79 },
  { month: "Feb 2026", newPatients: 40, returningPatients: 180, retentionRate: 82 },
  { month: "Mar 2026", newPatients: 35, returningPatients: 184, retentionRate: 84 },
];
