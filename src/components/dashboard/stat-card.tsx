"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface StatCardProps {
  value: string | number;
  label: string;
  helper?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "destructive";
  className?: string;
}

const toneClassMap = {
  neutral: "text-muted-foreground",
  success: "text-[var(--signal-green)]",
  warning: "text-[var(--signal-amber)]",
  destructive: "text-destructive",
};

export function StatCard({
  value,
  label,
  helper,
  icon: Icon,
  tone = "neutral",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-start text-2xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="text-start text-sm font-medium text-foreground">{label}</p>
            {helper && <p className="text-start text-xs text-muted-foreground">{helper}</p>}
          </div>
          {Icon && (
            <Icon className={cn("h-5 w-5 shrink-0", toneClassMap[tone])} aria-hidden="true" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
