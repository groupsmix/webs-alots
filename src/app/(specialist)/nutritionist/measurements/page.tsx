import { Scale } from "lucide-react";
import { BodyMeasurementTracker } from "@/components/para-medical/body-measurement-tracker";
import { fetchBodyMeasurements } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function MeasurementsPage() {
  const tenant = await requireTenant();
  const measurements = await fetchBodyMeasurements(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Scale className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">{t(locale, "bodyMeasurementsTitle")}</h1>
      </div>
      <BodyMeasurementTracker measurements={measurements} />
    </div>
  );
}
