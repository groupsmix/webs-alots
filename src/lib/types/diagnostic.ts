/**
 * Diagnostic center type definitions.
 * Covers Analysis Lab and Radiology/Medical Imaging modules.
 */

// ---------- Lab Test Catalog ----------

export interface LabTestCatalogItem {
  id: string;
  name: string;
  nameAr?: string;
  code?: string;
  category: string;
  sampleType: string;
  description?: string;
  price: number;
  currency: string;
  turnaroundHours: number;
  referenceRanges: ReferenceRange[];
  isActive: boolean;
  sortOrder: number;
}

export interface ReferenceRange {
  parameter: string;
  unit: string;
  min: number | null;
  max: number | null;
  gender?: "male" | "female" | "all";
  ageGroup?: string;
}

// ---------- Lab Test Orders ----------

export type LabTestOrderStatus =
  | "pending"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "validated"
  | "cancelled";

export type LabTestPriority = "normal" | "urgent" | "stat";

export interface LabTestOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorId?: string;
  orderingDoctorName?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  orderNumber: string;
  status: LabTestOrderStatus;
  priority: LabTestPriority;
  clinicalNotes?: string;
  fastingRequired: boolean;
  sampleCollectedAt?: string;
  completedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
  pdfUrl?: string;
  tests: LabTestItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LabTestItem {
  id: string;
  testId: string;
  testName: string;
  status: "pending" | "in_progress" | "completed";
}

// ---------- Lab Test Results ----------

export type ResultFlag = "normal" | "high" | "low" | "critical_high" | "critical_low";

export interface LabTestResult {
  id: string;
  orderId: string;
  testItemId: string;
  parameterName: string;
  value: string;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: ResultFlag | null;
  notes?: string;
  enteredBy?: string;
  enteredAt: string;
}

// ---------- Radiology Orders ----------

export type RadiologyModality =
  | "xray"
  | "ct"
  | "mri"
  | "ultrasound"
  | "mammography"
  | "pet"
  | "fluoroscopy"
  | "other";

export type RadiologyOrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "images_ready"
  | "reported"
  | "validated"
  | "cancelled";

export interface RadiologyOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorId?: string;
  orderingDoctorName?: string;
  radiologistId?: string;
  radiologistName?: string;
  orderNumber: string;
  modality: RadiologyModality;
  bodyPart?: string;
  clinicalIndication?: string;
  status: RadiologyOrderStatus;
  priority: "normal" | "urgent" | "stat";
  scheduledAt?: string;
  performedAt?: string;
  reportedAt?: string;
  reportText?: string;
  findings?: string;
  impression?: string;
  pdfUrl?: string;
  images: RadiologyImage[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Radiology Images ----------

export interface RadiologyImage {
  id: string;
  orderId: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  modality?: string;
  isDicom: boolean;
  dicomMetadata?: Record<string, unknown>;
  thumbnailUrl?: string;
  description?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

// ---------- Radiology Report Templates ----------

export interface RadiologyReportTemplate {
  id: string;
  name: string;
  modality?: string;
  bodyPart?: string;
  templateText: string;
  fields: ReportTemplateField[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ReportTemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
}
