import { Suspense } from "react";
import { ExceptionDayPicker } from "@/components/schedule/ExceptionDayPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAuth } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";

export default async function DoctorSchedulePage() {
  const profile = await requireAuth();
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Contexte clinique introuvable. Accédez via votre sous-domaine.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion de l&apos;agenda</h1>
        <p className="text-muted-foreground mt-1">
          Marquez vos jours d&apos;indisponibilité (congés, maladie, jours fériés). Les patients ne
          pourront pas réserver de créneaux ces jours-là.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jours d&apos;exception</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <ExceptionDayPicker doctorId={profile.id} clinicId={tenant.clinicId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
