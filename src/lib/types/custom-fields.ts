/**
 * Custom Fields Engine Types
 *
 * Supports dynamic field definitions per clinic type,
 * with flexible JSONB value storage.
 */

// ---- Field Types ----

type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "file"
  | "tooth_number";

type CustomFieldEntityType =
  | "appointment"
  | "patient"
  | "consultation"
  | "product"
  | "lab_order";

// ---- Select Option ----

interface CustomFieldOption {
  value: string;
  label_fr: string;
  label_ar: string;
}

// ---- Validation Rules ----

interface CustomFieldValidation {
  min?: number;
  max?: number;
  step?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
}

// ---- Field Definition ----

export interface CustomFieldDefinition {
  id: string;
  clinic_type_key: string;
  entity_type: CustomFieldEntityType;
  field_key: string;
  field_type: CustomFieldType;
  label_fr: string;
  label_ar: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  options: CustomFieldOption[];
  validation: CustomFieldValidation;
  default_value: unknown;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}
