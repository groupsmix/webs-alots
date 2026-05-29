"use client";

import { useMemo } from "react";
import { evaluatePasswordStrength } from "@/lib/validations/password-policy";
import type { PasswordStrength } from "@/lib/validations/password-policy";

const STRENGTH_CONFIG: Record<
  PasswordStrength["label"],
  { color: string; bg: string; text: string }
> = {
  weak: { color: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  fair: { color: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
  good: { color: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700" },
  strong: { color: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
};

const LABELS: Record<PasswordStrength["label"], string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  if (!password) return null;

  const config = STRENGTH_CONFIG[strength.label];
  const percentage = (strength.score / 5) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${config.color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${config.text}`}>{LABELS[strength.label]}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <li className={strength.checks.minLength ? "text-green-600" : ""}>
          {strength.checks.minLength ? "✓" : "○"} 8+ characters
        </li>
        <li className={strength.checks.hasUppercase ? "text-green-600" : ""}>
          {strength.checks.hasUppercase ? "✓" : "○"} Uppercase letter
        </li>
        <li className={strength.checks.hasLowercase ? "text-green-600" : ""}>
          {strength.checks.hasLowercase ? "✓" : "○"} Lowercase letter
        </li>
        <li className={strength.checks.hasNumber ? "text-green-600" : ""}>
          {strength.checks.hasNumber ? "✓" : "○"} Number
        </li>
        <li className={strength.checks.hasSpecial ? "text-green-600" : ""}>
          {strength.checks.hasSpecial ? "✓" : "○"} Special character
        </li>
      </ul>
    </div>
  );
}
