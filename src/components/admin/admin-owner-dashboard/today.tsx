"use client";

import { CalendarDays, CheckCircle2, Clock3, UserCheck } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface OwnerTodayProps {
  summary: OwnerTodaySummary;
  locale: Locale;
}

export function OwnerToday({ summary, locale }: OwnerTodayProps) {
  const cards = [
    {
      label: t(locale, "admin.owner.todayAppointments"),
      value: summary.totalAppointments,
      helper: t(locale, "admin.owner.todayScheduled", {
        count: summary.unconfirmedAppointments + summary.confirmedAppointments,
      }),
      icon: CalendarDays,
      tone: "neutral" as const,
    },
    {
      label: t(locale, "admin.owner.todayConfirmed"),
      value: summary.confirmedAppointments,
      helper:
        summary.unconfirmedAppointments > 0
          ? t(locale, "admin.owner.todayUnconfirmedHelper")
          : undefined,
      icon: UserCheck,
      tone: "success" as const,
    },
    {
      label: t(locale, "admin.owner.todayWaiting"),
      value: summary.checkedInAppointments,
      helper: t(locale, "admin.owner.todayInConsultation", {
        count: summary.inProgressAppointments,
      }),
      icon: Clock3,
      tone: "neutral" as const,
    },
    {
      label: t(locale, "admin.owner.todayCompleted"),
      value: summary.completedAppointments,
      helper: t(locale, "admin.owner.todayNoShows", {
        count: summary.noShowAppointments,
      }),
      icon: CheckCircle2,
      tone: "success" as const,
    },
  ];

  return (
    <section aria-labelledby="today-title">
      <div className="mb-3">
        <h2 id="today-title" className="text-lg font-semibold">
          {t(locale, "admin.owner.today")}
        </h2>
        <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.todayDesc")}</p>
      </div>

      {summary.totalAppointments === 0 ? (
        <Card>
          <CardContent className="p-5">
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.label}
              value={card.value}
              label={card.label}
              helper={card.helper}
              icon={card.icon}
              tone={card.tone}
            />
          ))}
        </div>
      )}
    </section>
  );
}
