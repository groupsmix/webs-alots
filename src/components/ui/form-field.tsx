"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

interface FormFieldProps extends ComponentProps<typeof Input> {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}

/**
 * Form field with label, real-time validation error display, and hint text.
 * Shows inline error messages in red below the input when validation fails.
 */
export function FormField({
  label,
  error,
  hint,
  required,
  id,
  className,
  ...inputProps
}: FormFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      </Label>
      <Input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50")}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
