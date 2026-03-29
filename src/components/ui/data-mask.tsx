"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataMaskProps {
  /** The sensitive value to mask */
  value: string;
  /** Number of characters to show at the end (default: 4) */
  visibleChars?: number;
  /** Mask character (default: "•") */
  maskChar?: string;
  /** Label for accessibility */
  label?: string;
  className?: string;
}

/**
 * Data masking component for sensitive information (CIN, phone numbers, etc.).
 * Shows masked value by default with a toggle to reveal.
 *
 * Usage:
 * ```tsx
 * <DataMask value="AB123456" label="CIN" />
 * // Displays: ••••3456 [eye icon]
 * ```
 */
export function DataMask({
  value,
  visibleChars = 4,
  maskChar = "\u2022",
  label = "Donnée sensible",
  className,
}: DataMaskProps) {
  const [revealed, setRevealed] = useState(false);

  const masked =
    value.length <= visibleChars
      ? maskChar.repeat(value.length)
      : maskChar.repeat(value.length - visibleChars) +
        value.slice(-visibleChars);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`${label}: ${revealed ? value : "masqué"}`}
    >
      <span
        className={cn(
          "font-mono text-sm transition-all",
          !revealed && "select-none blur-[1px]"
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
