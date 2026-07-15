import { ArrowRight, CalendarDays, CircleDollarSign, Star, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/data/dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";

interface OwnerOverviewProps {
  stats: DashboardStats;
  locale: Locale;
}

export function OwnerOverview({ stats, locale }: OwnerOverviewProps) {
  const overviewCards = [
    {
      icon: Users,
      label: t(locale, "admin.totalPatients"),
      value: stats.totalPatients.toString(),
      helper: t(locale, "admin.owner.patientsHelper"),
      color: "text-[var(--oltigo-green)]",
    },
    {
      icon: CalendarDays,
      label: t(locale, "admin.totalAppointments"),
      value: stats.totalAppointments.toString(),
      helper: t(locale, "admin.owner.appointmentsHelper"),
      color: "text-[var(--ink-70)]",
    },
    {
      icon: CircleDollarSign,
      label: t(locale, "admin.owner.revenueCollected"),
      value: formatCurrency(stats.totalRevenue, locale),
      helper: t(locale, "admin.owner.revenueHelper"),
      color: "text-[var(--signal-green)]",
    },
    {
      icon: Star,
      label: t(locale, "admin.averageRating"),
      value: stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)} / 5` : "—",
      helper: t(locale, "admin.owner.ratingHelper"),
      color: "text-[var(--signal-amber)]",
    },
  ];

  return (
    <section aria-labelledby="overview-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="overview-title" className="text-lg font-semibold">
              {t(locale, "admin.owner.overview")}
            </h2>
            <Badge variant="outline">{t(locale, "admin.owner.allTime")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.overviewDesc")}</p>
        </div>
        <Link
          href="/admin/analytics"
          className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
        >
          {t(locale, "admin.owner.viewPerformance")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <p className="mt-4 text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-sm font-medium">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
