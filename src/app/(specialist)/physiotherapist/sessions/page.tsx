import { ClipboardList } from "lucide-react";
import { PhysioSessionTracker } from "@/components/para-medical/physio-session-tracker";
import { fetchPhysioSessions } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function PhysioSessionsPage() {
  const tenant = await requireTenant();
  const sessions = await fetchPhysioSessions(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t(locale, "physioSessionsTitle")}</h1>
      </div>
      <PhysioSessionTracker sessions={sessions} />
    </div>
  );
}
