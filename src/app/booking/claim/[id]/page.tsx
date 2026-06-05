/* eslint-disable i18next/no-literal-string */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase-server";

interface WaitlistRow {
  id: string;
  expires_at: string | null;
  claimed_at: string | null;
  doctor: { name: string } | null;
  patient: { name: string } | null;
  clinic: { name: string } | null;
}

export default async function ClaimSlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();

  const { data } = await supabase
    .from("waitlist")
    .select(
      `
      id, expires_at, claimed_at,
      doctor:users!doctor_id  ( name ),
      patient:users!patient_id ( name ),
      clinic:clinics ( name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-2">
            <p className="text-xl font-semibold">Lien invalide</p>
            <p className="text-sm text-muted-foreground">
              Ce lien de réservation n&apos;existe pas ou a été supprimé.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const row = data as unknown as WaitlistRow;

  if (row.claimed_at) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Créneau déjà confirmé</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <Badge variant="secondary">Réclamé</Badge>
            <p className="text-sm text-muted-foreground mt-3">
              Ce créneau a déjà été confirmé par un autre patient.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Lien expiré</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <Badge variant="destructive">Expiré</Badge>
            <p className="text-sm text-muted-foreground mt-3">
              Le délai de 2 heures pour confirmer ce créneau est dépassé.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirmer votre rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Médecin</dt>
              <dd className="font-medium">{row.doctor?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Patient</dt>
              <dd className="font-medium">{row.patient?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Clinique</dt>
              <dd className="font-medium">{row.clinic?.name ?? "—"}</dd>
            </div>
            {row.expires_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expire à</dt>
                <dd className="font-medium text-amber-600">
                  {new Date(row.expires_at).toLocaleTimeString("fr-MA", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Africa/Casablanca",
                  })}
                </dd>
              </div>
            )}
          </dl>

          {/* Native form POST to the claim API */}
          <form action={`/api/waitlist/${id}/claim`} method="POST">
            <Button type="submit" className="w-full">
              Confirmer mon rendez-vous
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            En confirmant, vous acceptez les conditions de la clinique.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
