import { ClipboardList } from "lucide-react";
import { SpeechSessionTracker } from "@/components/para-medical/speech-session-tracker";
import { fetchSpeechSessions } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function SpeechSessionsPage() {
  const tenant = await requireTenant();
  const sessions = await fetchSpeechSessions(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">{t(locale, "speechSessionsTitle")}</h1>
      </div>
      <SpeechSessionTracker sessions={sessions} />
    </div>
  );
}
