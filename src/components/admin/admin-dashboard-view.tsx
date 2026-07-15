"use client";

import { OwnerActivity } from "@/components/admin/admin-owner-dashboard/activity";
import { OwnerAttention } from "@/components/admin/admin-owner-dashboard/attention";
import { OwnerDashboardHeader } from "@/components/admin/admin-owner-dashboard/header";
import { OwnerMetrics } from "@/components/admin/admin-owner-dashboard/metrics";
import { OwnerOverview } from "@/components/admin/admin-owner-dashboard/overview";
import { useLocale } from "@/components/locale-switcher";
import { calculateNoShowRate, getOwnerAttentionItems } from "@/lib/admin-owner-dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";

interface AdminDashboardViewProps {
  stats: DashboardStats;
  ownerName?: string | null;
  today: string;
}

export function AdminDashboardView({ stats, ownerName, today }: AdminDashboardViewProps) {
  const [locale] = useLocale();
  const noShowRate = calculateNoShowRate(stats);
  const attentionItems = getOwnerAttentionItems(stats);

  return (
    <div className="space-y-6">
      <OwnerDashboardHeader locale={locale} ownerName={ownerName} today={today} />
      <OwnerAttention
        items={attentionItems}
        locale={locale}
        noShowRate={noShowRate}
        averageRating={stats.averageRating}
      />
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
