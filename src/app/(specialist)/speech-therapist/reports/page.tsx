import { FileText } from "lucide-react";
import { SpeechProgressReports } from "@/components/para-medical/speech-progress-reports";
import { fetchSpeechProgressReports } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function SpeechReportsPage() {
  const tenant = await requireTenant();
  const reports = await fetchSpeechProgressReports(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">{t(locale, "speechProgressReportsTitle")}</h1>
      </div>
      <SpeechProgressReports reports={reports} />
    </div>
  );
}
