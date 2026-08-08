"use client";

import { OwnerActivity } from "@/components/admin/admin-owner-dashboard/activity";
import { AgendaPeek } from "@/components/admin/admin-owner-dashboard/agenda-peek";
import { OwnerAttention } from "@/components/admin/admin-owner-dashboard/attention";
import { OwnerDashboardHeader } from "@/components/admin/admin-owner-dashboard/header";
import { OwnerMetrics } from "@/components/admin/admin-owner-dashboard/metrics";
import { OwnerToday } from "@/components/admin/admin-owner-dashboard/today";
import { useLocale } from "@/components/locale-switcher";
import { calculateNoShowRate, getOwnerAttentionItems } from "@/lib/admin-owner-dashboard";
import type { OwnerAgendaPreviewItem, OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";

interface AdminDashboardViewProps {
  stats: DashboardStats;
  ownerName?: string | null;
  today: string;
  todaySummary: OwnerTodaySummary;
  todayAgenda: OwnerAgendaPreviewItem[];
}

export function AdminDashboardView({
  stats,
  ownerName,
  today,
  todaySummary,
  todayAgenda,
}: AdminDashboardViewProps) {
  const [locale] = useLocale();
  const noShowRate = calculateNoShowRate(stats);
  const attentionItems = getOwnerAttentionItems(stats, todaySummary);

  return (
    <div className="space-y-6">
      <OwnerDashboardHeader locale={locale} ownerName={ownerName} today={today} />
      <OwnerAttention
        items={attentionItems}
        locale={locale}
        noShowRate={noShowRate}
        averageRating={stats.averageRating}
        today={todaySummary}
      />
      <OwnerToday summary={todaySummary} locale={locale} />
      <AgendaPeek items={todayAgenda} locale={locale} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OwnerActivity activities={stats.recentActivity} locale={locale} />
        </div>
        <div className="xl:col-span-1">
          <OwnerMetrics stats={stats} locale={locale} noShowRate={noShowRate} />
        </div>
      </div>
    </div>
  );
}
