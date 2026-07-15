import { Brain } from "lucide-react";
import { TherapySessionNotes } from "@/components/para-medical/therapy-session-notes";
import { fetchTherapySessionNotes } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function SessionNotesPage() {
  const tenant = await requireTenant();
  const sessions = await fetchTherapySessionNotes(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">{t(locale, "therapySessionNotesTitle")}</h1>
      </div>
      <TherapySessionNotes sessions={sessions} />
    </div>
  );
}
