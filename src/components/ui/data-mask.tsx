"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { mask, getMaskLevel, type MaskLevel } from "@/lib/mask";
import { cn } from "@/lib/utils";

interface DataMaskProps {
  /** The sensitive value to mask */
  value: string;
  /** Type of data — determines the masking strategy */
  type: "phone" | "email" | "cin";
  /** Override the environment-level masking level for this instance */
  level?: MaskLevel;
  /** Label for accessibility */
  label?: string;
  className?: string;
}

/**
 * Masks sensitive patient data based on user role and environment.
 *
 * Masking level is controlled by `NEXT_PUBLIC_DATA_MASKING` (full | partial | none).
 * When masking is active, a reveal/hide toggle is shown.
 *
 * - Full mask for demo:  `"06 *** *** 78"`
 * - Partial mask for staff:  `"0612 *** 78"`
 * - No mask for authorized doctors
 *
 * Usage:
 * ```tsx
 * <DataMask value="0612345678" type="phone" />
 * <DataMask value="ahmed@example.com" type="email" />
 * <DataMask value="AB123456" type="cin" />
 * ```
 *
 * Issue 46
 */
export function DataMask({
  value,
  type,
  level,
  label,
  className,
}: DataMaskProps) {
  const effectiveLevel = level ?? getMaskLevel();
  const [revealed, setRevealed] = useState(false);

  // When masking is disabled, render the value directly — no toggle needed.
  if (effectiveLevel === "none") {
    return <span className={className}>{value}</span>;
  }

  const masked = mask(value, type, effectiveLevel);

  const defaultLabel =
    type === "phone" ? "Téléphone" : type === "email" ? "Email" : "CIN";
  const a11yLabel = label ?? defaultLabel;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`${a11yLabel}: ${revealed ? value : "masqué"}`}
    >
      <span
        className={cn(
          "font-mono text-sm transition-all",
          !revealed && "select-none blur-[1px]",
        )}
        aria-hidden={!revealed}
      >
        {revealed ? value : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((prev) => !prev)}
        className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={revealed ? "Masquer" : "Révéler"}
        title={revealed ? "Masquer" : "Révéler"}
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}
