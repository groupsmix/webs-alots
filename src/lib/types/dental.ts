/**
 * Dental-specific type definitions.
 *
 * Extracted from dental-demo-data.ts so that components can import
 * pure types without pulling in demo/mock data modules.
 */

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
  dentition?: "adult" | "child";
}

// ---------- Treatment Plans ----------

export interface TreatmentStep {
  step: number;
  description: string;
  status: "pending" | "in_progress" | "completed";
  date: string | null;
  cost: number;
  toothNumbers?: number[];
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

// ---------- Sterilization Log ----------

export interface SterilizationEntry {
  id: string;
  toolName: string;
  sterilizedBy: string;
  sterilizedAt: string;
  nextDue: string | null;
  method: "autoclave" | "chemical" | "dry_heat";
  notes: string;
  batchNumber?: string;
  cycleNumber?: number;
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
