import { TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTherapySessionNotes } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

const MoodChart = dynamic(() => import("./mood-chart").then((m) => m.MoodChart), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" />,
});

export default async function ProgressTrackingPage() {
  const tenant = await requireTenant();
  const sessions = await fetchTherapySessionNotes(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  const moodData = sessions
    .filter((s) => s.mood_rating !== null)
    .map((s) => ({ date: s.session_date, mood: s.mood_rating }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">{t(locale, "therapyProgressTitle")}</h1>
      </div>

      {moodData.length >= 2 ? (
        <MoodChart data={moodData} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t(locale, "therapyProgressEmptyMessage")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(locale, "therapyProgressEmptyHint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
