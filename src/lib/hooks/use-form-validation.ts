"use client";

import { useState, useCallback } from "react";

type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

type FieldErrors = Record<string, string | null>;

/**
 * Lightweight real-time form validation hook.
 * Validates individual fields on change and provides error messages.
 */
export function useFormValidation<T extends Record<string, unknown>>(
  rules: Partial<Record<keyof T, ValidationRule<unknown>[]>>
) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: keyof T, value: unknown): string | null => {
      const fieldRules = rules[field];
      if (!fieldRules) return null;

      for (const rule of fieldRules) {
        if (!rule.validate(value)) {
          return rule.message;
        }
      }
      return null;
    },
    [rules]
  );

  const onFieldChange = useCallback(
    (field: keyof T, value: unknown) => {
      const fieldKey = field as string;
      if (touched[fieldKey]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [fieldKey]: error }));
      }
    },
    [validateField, touched]
  );

  const onFieldBlur = useCallback(
    (field: keyof T, value: unknown) => {
      const fieldKey = field as string;
      setTouched((prev) => ({ ...prev, [fieldKey]: true }));
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [fieldKey]: error }));
    },
    [validateField]
  );

  const validateAll = useCallback(
    (values: T): boolean => {
      const newErrors: FieldErrors = {};
      const newTouched: Record<string, boolean> = {};
      let valid = true;

      for (const field of Object.keys(rules)) {
        newTouched[field] = true;
        const error = validateField(field as keyof T, values[field]);
        newErrors[field] = error;
        if (error) valid = false;
      }

      setErrors(newErrors);
      setTouched(newTouched);
      return valid;
    },
    [rules, validateField]
  );

  const getFieldError = useCallback(
    (field: keyof T): string | null => {
      const fieldKey = field as string;
      return touched[fieldKey] ? (errors[fieldKey] ?? null) : null;
    },
    [errors, touched]
  );

  return { errors, touched, onFieldChange, onFieldBlur, validateAll, getFieldError };
}

// Common validation rules for the Moroccan healthcare context
export const commonRules = {
  required: (message = "Ce champ est obligatoire") => ({
    validate: (value: unknown) => {
      if (typeof value === "string") return value.trim().length > 0;
      return value !== null && value !== undefined;
    },
    message,
  }),
  phone: (message = "Numéro de téléphone invalide") => ({
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      const cleaned = value.replace(/[\s-]/g, "");
      return /^(\+212|0)[5-7]\d{8}$/.test(cleaned) || cleaned.length >= 6;
    },
    message,
  }),
  email: (message = "Adresse email invalide") => ({
    validate: (value: unknown) => {
      if (typeof value !== "string" || !value.trim()) return true; // optional
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    message,
  }),
  minLength: (min: number, message?: string) => ({
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      return value.trim().length >= min;
    },
    message: message ?? `Minimum ${min} caractères`,
  }),
};
