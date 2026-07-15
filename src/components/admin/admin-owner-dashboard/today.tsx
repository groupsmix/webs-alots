import { CalendarDays, CheckCircle2, CircleHelp, Clock3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

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
      color: "text-[var(--oltigo-green)]",
    },
    {
      label: t(locale, "admin.owner.todayUnconfirmed"),
      value: summary.unconfirmedAppointments,
      helper: t(locale, "admin.owner.todayUnconfirmedHelper"),
      icon: CircleHelp,
      color: "text-[var(--signal-amber)]",
    },
    {
      label: t(locale, "admin.owner.todayWaiting"),
      value: summary.checkedInAppointments,
      helper: t(locale, "admin.owner.todayInConsultation", {
        count: summary.inProgressAppointments,
      }),
      icon: Clock3,
      color: "text-[var(--ink-70)]",
    },
    {
      label: t(locale, "admin.owner.todayCompleted"),
      value: summary.completedAppointments,
      helper: t(locale, "admin.owner.todayNoShows", {
        count: summary.noShowAppointments,
      }),
      icon: CheckCircle2,
      color: "text-[var(--signal-green)]",
    },
  ];

  return (
    <section aria-labelledby="today-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="today-title" className="text-lg font-semibold">
            {t(locale, "admin.owner.today")}
          </h2>
          <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.todayDesc")}</p>
        </div>
        <Badge variant="outline">{t(locale, "admin.owner.todayBadge")}</Badge>
      </div>

      {summary.totalAppointments === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <EmptyState
              icon={CalendarDays}
              title={t(locale, "admin.owner.noAppointmentsToday")}
              description={t(locale, "admin.owner.noAppointmentsTodayDesc")}
              action={
                <Link href="/admin/agenda" className={buttonVariants({ size: "sm" })}>
                  {t(locale, "admin.owner.viewAgenda")}
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <p className="mt-4 text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-sm font-medium">{card.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
