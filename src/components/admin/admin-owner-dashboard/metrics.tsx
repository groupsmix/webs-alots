import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/data/dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface OwnerMetricsProps {
  stats: DashboardStats;
  locale: Locale;
  noShowRate: number;
}

export function OwnerMetrics({ stats, locale, noShowRate }: OwnerMetricsProps) {
  const metrics = [
    {
      label: t(locale, "admin.activeDoctors"),
      value: stats.doctorCount.toString(),
    },
    {
      label: t(locale, "admin.completedAppts"),
      value: stats.completedAppointments.toString(),
    },
    {
      label: t(locale, "admin.noShowRate"),
      value: `${noShowRate}%`,
    },
    {
      label: t(locale, "admin.insurancePatients"),
      value: stats.insurancePatients.toString(),
    },
  ];

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t(locale, "admin.owner.usefulMetrics")}</h2>
          <Badge variant="outline">{t(locale, "admin.owner.allTime")}</Badge>
        </div>
        <div className="space-y-1">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0"
            >
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="font-semibold">{metric.value}</span>
            </div>
          ))}
        </div>
        <Link
          href="/admin/analytics"
          className="mt-3 flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          {t(locale, "admin.owner.viewPerformance")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </CardContent>
    </Card>
  );
}
