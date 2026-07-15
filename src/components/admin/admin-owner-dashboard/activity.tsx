import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
  admin: "default",
  auth: "default",
  security: "destructive",
  patient: "default",
  config: "warning",
};

export function OwnerActivity({ activities, locale }: OwnerActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          {t(locale, "admin.recentActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={t(locale, "admin.noRecentActivity")}
            description={t(locale, "admin.owner.noActivityDesc")}
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div
                key={`${activity.time}-${index}`}
                className="flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm sm:flex-nowrap"
              >
                <Badge
                  variant={activityVariant[activity.type] ?? "default"}
                  className="mt-0.5 min-w-16 justify-center text-[10px]"
                >
                  {t(
                    locale,
                    `admin.owner.activity.${
                      Object.hasOwn(activityVariant, activity.type) ? activity.type : "other"
                    }`,
                  )}
                </Badge>
                <p className="min-w-0 flex-1">{activity.message}</p>
                <span className="basis-full ps-[4.75rem] text-xs text-muted-foreground sm:basis-auto sm:ps-0">
                  {formatDisplayDate(activity.time, locale, "relative")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
