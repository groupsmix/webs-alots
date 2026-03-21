"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type {
  CustomFieldDefinition,
  CustomFieldOption,
  CustomFieldValidation,
} from "@/lib/types/custom-fields";

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (fieldKey: string, value: unknown) => void;
  locale?: "fr" | "ar" | "en";
  disabled?: boolean;
}

/**
 * Renders a single custom field dynamically based on its field_type.
 * Supports: text, number, date, select, multi_select, file, tooth_number
 */
export function CustomFieldRenderer({
  field,
  value,
  onChange,
  locale = "fr",
  disabled = false,
}: CustomFieldRendererProps) {
  const label = locale === "ar" && field.label_ar ? field.label_ar : field.label_fr;
  const validation = field.validation ?? {};

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.field_key} className="text-sm font-medium">
        {label}
        {field.is_required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {renderFieldInput(field, value, onChange, validation, locale, disabled)}
    </div>
  );
}

function renderFieldInput(
  field: CustomFieldDefinition,
  value: unknown,
  onChange: (fieldKey: string, value: unknown) => void,
  validation: CustomFieldValidation,
  locale: string,
  disabled: boolean,
) {
  switch (field.field_type) {
    case "text":
      return (
        <Input
          id={field.field_key}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          placeholder={field.placeholder ?? ""}
          required={field.is_required}
          minLength={validation.min_length}
          maxLength={validation.max_length}
          disabled={disabled}
        />
      );

    case "number":
      return (
        <Input
          id={field.field_key}
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder ?? ""}
          required={field.is_required}
          min={validation.min}
          max={validation.max}
          step={validation.step ?? 1}
          disabled={disabled}
        />
      );

    case "date":
      return (
        <Input
          id={field.field_key}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          required={field.is_required}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(field.field_key, v)}
        >
          <SelectTrigger id={field.field_key}>
            <SelectValue placeholder={field.placeholder ?? "Sélectionner..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt: CustomFieldOption) => (
              <SelectItem key={opt.value} value={opt.value}>
                {locale === "ar" && opt.label_ar ? opt.label_ar : opt.label_fr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select":
      return (
        <MultiSelectField
          field={field}
          value={(value as string[]) ?? []}
          onChange={onChange}
          locale={locale}
          disabled={disabled}
        />
      );

    case "file":
      return (
        <Input
          id={field.field_key}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onChange(field.field_key, file.name);
            }
          }}
          required={field.is_required}
          disabled={disabled}
        />
      );

    case "tooth_number":
      return (
        <ToothNumberField
          field={field}
          value={value as number | null}
          onChange={onChange}
          validation={validation}
          disabled={disabled}
        />
      );

    default:
      return (
        <Input
          id={field.field_key}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          disabled={disabled}
        />
      );
  }
}

// ---- Multi-Select Component ----

interface MultiSelectFieldProps {
  field: CustomFieldDefinition;
  value: string[];
  onChange: (fieldKey: string, value: string[]) => void;
  locale: string;
  disabled: boolean;
}

function MultiSelectField({ field, value, onChange, locale, disabled }: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (optValue: string) => {
    if (disabled) return;
    const newValue = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange(field.field_key, newValue);
  };

  const removeOption = (optValue: string) => {
    if (disabled) return;
    onChange(field.field_key, value.filter((v) => v !== optValue));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[32px]">
        {value.map((v) => {
          const opt = (field.options ?? []).find((o) => o.value === v);
          return (
            <Badge key={v} variant="secondary" className="gap-1">
              {opt ? (locale === "ar" && opt.label_ar ? opt.label_ar : opt.label_fr) : v}
              {!disabled && (
                <button type="button" onClick={() => removeOption(v)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {isOpen ? "Fermer" : "Ajouter..."}
      </Button>
      {isOpen && (
        <div className="border rounded-md p-2 space-y-1 max-h-48 overflow-y-auto">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1 rounded"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggleOption(opt.value)}
                disabled={disabled}
              />
              <span className="text-sm">
                {locale === "ar" && opt.label_ar ? opt.label_ar : opt.label_fr}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Tooth Number Field ----

interface ToothNumberFieldProps {
  field: CustomFieldDefinition;
  value: number | null;
  onChange: (fieldKey: string, value: number | null) => void;
  validation: CustomFieldValidation;
  disabled: boolean;
}

const TOOTH_QUADRANTS = [
  { label: "UR", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { label: "UL", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: "LR", teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { label: "LL", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

function ToothNumberField({ field, value, onChange, disabled }: ToothNumberFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          id={field.field_key}
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(field.field_key, e.target.value ? Number(e.target.value) : null)
          }
          placeholder="FDI tooth number (11-48)"
          min={11}
          max={85}
          disabled={disabled}
          className="w-40"
        />
        {value && (
          <Badge variant="outline">Tooth #{value}</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TOOTH_QUADRANTS.map((quadrant) => (
          <div key={quadrant.label} className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{quadrant.label}</span>
            <div className="flex gap-0.5 flex-wrap">
              {quadrant.teeth.map((tooth) => (
                <button
                  key={tooth}
                  type="button"
                  onClick={() => !disabled && onChange(field.field_key, tooth)}
                  className={`w-7 h-7 text-xs rounded border transition-colors ${
                    value === tooth
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted border-border"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  disabled={disabled}
                >
                  {tooth}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
