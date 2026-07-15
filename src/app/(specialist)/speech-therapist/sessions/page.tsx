"use client";

import { ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { SpeechSessionTracker } from "@/components/para-medical/speech-session-tracker";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser, fetchSpeechSessions } from "@/lib/data/client";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import type { SpeechSession } from "@/lib/types/para-medical";

export default function SpeechSessionsPage() {
  const [locale] = useLocale();
  const [sessions, setSessions] = useState<SpeechSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const data = await fetchSpeechSessions(user.clinic_id);
      if (controller.signal.aborted) return;
      setSessions(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load speech sessions", {
          context: "speech-therapist/sessions",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  if (loading)
    return <PageLoader message={t(locale, "speech-therapist.sessionTracking.loading")} />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">
          {t(locale, "speech-therapist.sessionTracking.error")}
        </p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">
          {t(locale, "speech-therapist.sessionTracking.title")}
        </h1>
      </div>
      <SpeechSessionTracker sessions={sessions} />
    </div>
  );
}
