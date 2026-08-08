"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, primaryAction, className }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="space-y-1">
        <h1 className="text-start text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-start text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {primaryAction && <div className="flex shrink-0 items-start">{primaryAction}</div>}
    </div>
  );
}
