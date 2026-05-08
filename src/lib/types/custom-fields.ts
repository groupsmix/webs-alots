/**
 * Custom Fields Engine Types
 *
 * Supports dynamic field definitions per clinic type,
 * with flexible JSONB value storage.
 */

// ---- Field Types ----

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "file"
  | "tooth_number";

export type CustomFieldEntityType =
  | "appointment"
  | "patient"
  | "consultation"
  | "product"
  | "lab_order";

// ---- Select Option ----

export interface CustomFieldOption {
  value: string;
  label_fr: string;
  label_ar: string;
}

// ---- Validation Rules ----

export interface CustomFieldValidation {
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

// ---- Field Values (stored per entity instance) ----

export interface CustomFieldValues {
  id: string;
  clinic_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  field_values: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---- Field Override (clinic-level customization) ----

export interface CustomFieldOverride {
  id: string;
  clinic_id: string;
  field_definition_id: string;
  is_enabled: boolean;
  is_required: boolean | null;
  sort_order: number | null;
  created_at: string;
}

// ---- API Request/Response Types ----

export interface CreateFieldDefinitionRequest {
  clinic_type_key: string;
  entity_type: CustomFieldEntityType;
  field_key: string;
  field_type: CustomFieldType;
  label_fr: string;
  label_ar?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  sort_order?: number;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  default_value?: unknown;
}

export interface UpdateFieldDefinitionRequest {
  label_fr?: string;
  label_ar?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  sort_order?: number;
  options?: CustomFieldOption[];
  validation?: CustomFieldValidation;
  default_value?: unknown;
  is_active?: boolean;
}

export interface SaveFieldValuesRequest {
  clinic_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  field_values: Record<string, unknown>;
}

// ---- Resolved field (definition + override merged) ----

export interface ResolvedCustomField {
  definition: CustomFieldDefinition;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
}
