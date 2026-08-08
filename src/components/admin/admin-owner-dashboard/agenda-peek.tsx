"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OwnerAgendaPreviewItem } from "@/lib/data/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { AppointmentStatus } from "@/lib/types/database";
import { cn, formatDisplayDate } from "@/lib/utils";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const statusVariant: Record<AppointmentStatus, BadgeVariant> = {
  pending: "warning",
  reminded: "warning",
  confirmed: "outline",
  scheduled: "outline",
  checked_in: "success",
  in_progress: "success",
  completed: "success",
  no_show: "destructive",
  cancelled: "destructive",
  rescheduled: "warning",
};

interface AgendaPeekProps {
  items: OwnerAgendaPreviewItem[];
  locale: Locale;
  className?: string;
}

function getStatusLabel(locale: Locale, status: AppointmentStatus): string {
  const key = `admin.agenda.status.${status}` as const;
  const label = t(locale, key);
  if (label !== key) return label;
  return t(locale, "admin.agenda.status.other");
}

export function AgendaPeek({ items, locale, className }: AgendaPeekProps) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-start text-base">
            {t(locale, "admin.owner.nextAppointments")}
          </CardTitle>
        </div>
        <Link
          href="/admin/agenda"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t(locale, "admin.owner.viewAgenda")}
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={CalendarDays}
            title={t(locale, "admin.owner.noAppointmentsToday")}
            description={t(locale, "admin.owner.noAppointmentsTodayDesc")}
            action={
              <Link href="/admin/agenda" className={cn(buttonVariants({ size: "sm" }))}>
                {t(locale, "admin.owner.viewAgenda")}
              </Link>
            }
            className="py-8"
          />
        ) : (
          <ul className="divide-y" aria-label={t(locale, "admin.owner.nextAppointments")}>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href="/admin/agenda"
                  className="flex items-start justify-between gap-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <p className="text-start text-sm font-medium text-foreground">
                      {formatDisplayDate(item.slotStart, locale, "time")} — {item.patientName}
                    </p>
                    <p className="text-start text-xs text-muted-foreground">
                      {item.serviceName} • {item.doctorName}
                    </p>
                  </div>
                  <Badge variant={statusVariant[item.status]} className="shrink-0">
                    {getStatusLabel(locale, item.status)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
