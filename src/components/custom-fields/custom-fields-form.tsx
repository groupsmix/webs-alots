"use client";

import { useState, useEffect, useCallback } from "react";
import { CustomFieldRenderer } from "./custom-field-renderer";
import type { CustomFieldDefinition } from "@/lib/types/custom-fields";
import { logger } from "@/lib/logger";

interface CustomFieldsFormProps {
  clinicTypeKey: string;
  entityType: string;
  clinicId: string;
  entityId: string;
  locale?: "fr" | "ar" | "en";
  disabled?: boolean;
  onChange?: (values: Record<string, unknown>) => void;
}

/**
 * Complete custom fields form component.
 * Fetches field definitions for the given clinic type + entity,
 * loads existing values, and renders all fields dynamically.
 */
export function CustomFieldsForm({
  clinicTypeKey,
  entityType,
  clinicId,
  entityId,
  locale = "fr",
  disabled = false,
  onChange,
}: CustomFieldsFormProps) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      try {
        const [defsRes, valsRes] = await Promise.all([
          fetch(
            `/api/custom-fields?clinic_type_key=${encodeURIComponent(clinicTypeKey)}&entity_type=${encodeURIComponent(entityType)}`,
          ),
          entityId
            ? fetch(
                `/api/custom-fields/values?clinic_id=${encodeURIComponent(clinicId)}&entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
              )
            : Promise.resolve(null),
        ]);

        const defsData = await defsRes.json();
        setDefinitions(defsData.definitions ?? []);

        if (valsRes) {
          const valsData = await valsRes.json();
          setValues(valsData.values ?? {});
        }
      } catch (err) {
        logger.warn("Operation failed", { context: "custom-fields-form", error: err });
      } finally {
        setLoading(false);
      }
    }

    if (clinicTypeKey && entityType) {
      loadData();
    }
    return () => { controller.abort(); };
  }, [clinicTypeKey, entityType, clinicId, entityId]);

  const handleFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [fieldKey]: value };
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {locale === "ar" ? "حقول مخصصة" : "Champs personnalisés"}
      </h4>
      <div className="grid gap-4 sm:grid-cols-2">
        {definitions.map((field) => (
          <CustomFieldRenderer
            key={field.id}
            field={field}
            value={values[field.field_key]}
            onChange={handleFieldChange}
            locale={locale}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Hook to save custom field values.
 * Call this when the parent form is submitted.
 */
export function useSaveCustomFields() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveValues = async (
    clinicId: string,
    entityType: string,
    entityId: string,
    fieldValues: Record<string, unknown>,
  ) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/custom-fields/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          entity_type: entityType,
          entity_id: entityId,
          field_values: fieldValues,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save custom fields");
      }

      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return { saveValues, saving, error };
}
