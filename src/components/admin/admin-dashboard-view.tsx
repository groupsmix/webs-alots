"use client";

import { OwnerActivity } from "@/components/admin/admin-owner-dashboard/activity";
import { OwnerAttention } from "@/components/admin/admin-owner-dashboard/attention";
import { OwnerBriefing } from "@/components/admin/admin-owner-dashboard/briefing";
import { OwnerDashboardHeader } from "@/components/admin/admin-owner-dashboard/header";
import { OwnerMetrics } from "@/components/admin/admin-owner-dashboard/metrics";
import { OwnerOverview } from "@/components/admin/admin-owner-dashboard/overview";
import { OwnerToday } from "@/components/admin/admin-owner-dashboard/today";
import { useLocale } from "@/components/locale-switcher";
import { calculateNoShowRate, getOwnerAttentionItems } from "@/lib/admin-owner-dashboard";
import type { OwnerDailyBriefing, OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";

interface AdminDashboardViewProps {
  stats: DashboardStats;
  ownerName?: string | null;
  today: string;
  todaySummary: OwnerTodaySummary;
  briefing: OwnerDailyBriefing | null;
}

export function AdminDashboardView({
  stats,
  ownerName,
  today,
  todaySummary,
  briefing,
}: AdminDashboardViewProps) {
  const [locale] = useLocale();
  const noShowRate = calculateNoShowRate(stats);
  const attentionItems = getOwnerAttentionItems(stats, todaySummary);

  return (
    <div className="space-y-6">
      <OwnerDashboardHeader locale={locale} ownerName={ownerName} today={today} />
      <OwnerToday summary={todaySummary} locale={locale} />
      <OwnerAttention
        items={attentionItems}
        locale={locale}
        noShowRate={noShowRate}
        averageRating={stats.averageRating}
        today={todaySummary}
      />
      <OwnerBriefing briefing={briefing} locale={locale} />
      <OwnerOverview stats={stats} locale={locale} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OwnerActivity activities={stats.recentActivity} locale={locale} />
        </div>
        <OwnerMetrics stats={stats} locale={locale} noShowRate={noShowRate} />
      </div>
    </div>
  );
}
