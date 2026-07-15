import { Camera } from "lucide-react";
import { ProgressPhotoGallery } from "@/components/para-medical/progress-photo-gallery";
import { fetchProgressPhotos } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function ProgressPhotosPage() {
  const tenant = await requireTenant();
  const photos = await fetchProgressPhotos(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Camera className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t(locale, "progressPhotosTitle")}</h1>
      </div>
      <ProgressPhotoGallery photos={photos} />
    </div>
  );
}
