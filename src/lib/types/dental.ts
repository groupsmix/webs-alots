/**
 * Dental-specific type definitions.
 *
 * Extracted from dental-demo-data.ts so that components can import
 * pure types without pulling in demo/mock data modules.
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

// ---------- Odontogram ----------

export type ToothStatus =
  | "healthy"
  | "decayed"
  | "filled"
  | "missing"
  | "crown"
  | "implant"
  | "root_canal"
  | "extraction_needed";

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

// ---------- Pain Questionnaire ----------

export interface PainQuestionnaire {
  patientId: string;
  appointmentId: string;
  painLevel: number;
  painLocation: string;
  painDuration: string;
  painType: string;
  triggers: string[];
  hasSwelling: boolean;
  hasBleeding: boolean;
  additionalNotes: string;
}

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

// ---------- Analytics ----------

export interface DailyAnalytics {
  date: string;
  patientCount: number;
  revenue: number;
  appointments: number;
  noShows: number;
  walkIns: number;
  onlineBookings: number;
}

export interface WeeklyRevenue {
  week: string;
  revenue: number;
  patients: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  patients: number;
  appointments: number;
}

export interface ServicePopularity {
  serviceName: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface HourlyHeatmap {
  day: string;
  hours: { hour: number; count: number }[];
}

export interface ReviewTrend {
  month: string;
  averageScore: number;
  count: number;
}

export interface PatientRetention {
  month: string;
  newPatients: number;
  returningPatients: number;
  retentionRate: number;
}
