"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/data/dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { cn, formatCurrency } from "@/lib/utils";

interface OwnerMetricsProps {
  stats: DashboardStats;
  locale: Locale;
  noShowRate: number;
}

export function OwnerMetrics({ stats, locale, noShowRate }: OwnerMetricsProps) {
  const metrics = [
    {
      label: t(locale, "admin.owner.revenueCollected"),
      value: formatCurrency(stats.totalRevenue, locale),
    },
    {
      label: t(locale, "admin.noShowRate"),
      value: `${noShowRate}%`,
    },
    {
      label: t(locale, "admin.activeDoctors"),
      value: stats.doctorCount.toString(),
    },
  ];

  return (
    <Card className="h-full bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-start text-base">
          {t(locale, "admin.owner.usefulMetrics")}
        </CardTitle>
        <CardDescription>{t(locale, "admin.owner.overviewDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="text-sm font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/admin/analytics"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 w-full")}
        >
          {t(locale, "admin.owner.viewPerformance")}
          <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
        </Link>
      </CardContent>
    </Card>
  );
}
