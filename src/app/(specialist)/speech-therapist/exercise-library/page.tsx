import { BookOpen } from "lucide-react";
import { SpeechExerciseLibrary } from "@/components/para-medical/speech-exercise-library";
import { fetchSpeechExercises } from "@/lib/data/para-medical";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";

export default async function ExerciseLibraryPage() {
  const tenant = await requireTenant();
  const exercises = await fetchSpeechExercises(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant) as Locale;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">{t(locale, "speechExerciseLibraryTitle")}</h1>
      </div>
      <SpeechExerciseLibrary exercises={exercises} />
    </div>
  );
}
