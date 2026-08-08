"use client";

import { Activity } from "lucide-react";
import { ActivityList } from "@/components/dashboard/activity-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecentActivityItem } from "@/lib/data/dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { formatDisplayDate } from "@/lib/utils";

interface OwnerActivityProps {
  activities: RecentActivityItem[];
  locale: Locale;
}

const activityLabel: Record<string, string> = {
  admin: "admin.owner.activity.admin",
  auth: "admin.owner.activity.auth",
  booking: "admin.owner.activity.booking",
  cancel: "admin.owner.activity.cancel",
  config: "admin.owner.activity.config",
  other: "admin.owner.activity.other",
  patient: "admin.owner.activity.patient",
  payment: "admin.owner.activity.payment",
  review: "admin.owner.activity.review",
  security: "admin.owner.activity.security",
};

function getActivityLabel(locale: Locale, type: string): string {
  const key = activityLabel[type] ?? activityLabel.other;
  return t(locale, key);
}

export function OwnerActivity({ activities, locale }: OwnerActivityProps) {
  const items = activities.map((activity, index) => ({
    id: `${activity.time}-${index}`,
    content: activity.message,
    badge: getActivityLabel(locale, activity.type),
    meta: formatDisplayDate(activity.time, locale, "relative"),
  }));

  return (
    <Card className="bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-start text-base">
          <Activity className="h-4 w-4" aria-hidden="true" />
          {t(locale, "admin.recentActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={Activity}
            title={t(locale, "admin.recentActivity")}
            description={t(locale, "admin.owner.noActivityDesc")}
            className="py-8"
          />
        ) : (
          <ActivityList items={items} maxItems={10} ariaLabel={t(locale, "admin.recentActivity")} />
        )}
      </CardContent>
    </Card>
  );
}
