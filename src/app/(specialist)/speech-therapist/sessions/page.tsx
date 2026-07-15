import { ClipboardList } from "lucide-react";
import { SpeechSessionTracker } from "@/components/para-medical/speech-session-tracker";
import { getSpeechSessions } from "@/lib/data/speech-therapy";
import { t, type Locale } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function SpeechSessionsPage() {
  const tenant = await requireTenant();
  const locale = getLocaleFromTenant(tenant) as Locale;

  let sessions: Awaited<ReturnType<typeof getSpeechSessions>> = [];
  let error = false;

  try {
    sessions = await getSpeechSessions(tenant.clinicId);
  } catch (err) {
    logger.warn("Failed to load speech sessions", {
      context: "speech-therapist/sessions",
      error: err,
    });
    error = true;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">
          {t(locale, "speech-therapist.sessionTracking.error")}
        </p>
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
