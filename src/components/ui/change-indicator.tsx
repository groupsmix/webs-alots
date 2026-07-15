"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChangeIndicatorProps {
  value: number;
  inverted?: boolean;
  variant?: "inline" | "badge";
  className?: string;
}

/**
 * Displays a percentage change value. Use `variant="badge"` for the dashboard
 * metric-card style, or `variant="inline"` for a compact inline arrow label.
 */
export function ChangeIndicator({
  value,
  inverted = false,
  variant = "inline",
  className,
}: ChangeIndicatorProps) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  const formatted = `${value > 0 ? "+" : ""}${value}%`;

  if (variant === "badge") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs",
          isPositive && "text-green-600 border-green-200",
          isNegative && "text-red-600 border-red-200",
          className,
        )}
      >
        {formatted}
      </Badge>
    );
  }

  if (value === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>0%</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-[var(--signal-green)]" : "text-[var(--signal-red)]",
        className,
      )}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatted}
    </span>
  );
}
