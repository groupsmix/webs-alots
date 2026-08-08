"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface AttentionCardProps {
  tone: "warning" | "danger" | "success";
  title: string;
  description: string;
  action?: { label: string; href: string };
  icon?: LucideIcon;
  className?: string;
}

const toneConfig = {
  warning: {
    icon: AlertTriangle,
    border: "border-l-[var(--signal-amber)]",
    text: "text-[var(--signal-amber)]",
    buttonVariant: "default" as const,
  },
  danger: {
    icon: AlertCircle,
    border: "border-l-destructive",
    text: "text-destructive",
    buttonVariant: "destructive" as const,
  },
  success: {
    icon: CheckCircle2,
    border: "border-l-[var(--signal-green)]",
    text: "text-[var(--signal-green)]",
    buttonVariant: "outline" as const,
  },
};

export function AttentionCard({
  tone,
  title,
  description,
  action,
  icon: IconProp,
  className,
}: AttentionCardProps) {
  const config = toneConfig[tone];
  const Icon = IconProp ?? config.icon;

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 border-l-4 bg-card shadow-sm",
        config.border,
        className,
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.text)} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-start font-semibold text-foreground">{title}</p>
            <p className="text-start text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className={cn(
              buttonVariants({ variant: config.buttonVariant, size: "sm" }),
              "shrink-0",
            )}
          >
            {action.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
