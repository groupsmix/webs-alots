/* eslint-disable i18next/no-literal-string */
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { SubscriptionTierForm } from "./subscription-tier-form";

export default async function ClinicSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, tier, status")
    .eq("id", id)
    .single();

  if (!clinic) return notFound();

  const tierColors: Record<
    string,
    "default" | "secondary" | "outline" | "destructive" | "success"
  > = {
    trial: "outline",
    starter: "secondary",
    pro: "default",
    enterprise: "success",
  };

  const currentTier = clinic.tier ?? "trial";
  const badgeVariant = tierColors[currentTier] ?? "outline";

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Cliniques", href: "/super-admin/clinics" },
          { label: clinic.name, href: `/super-admin/clinics/${id}` },
          { label: "Abonnement" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion de l&apos;abonnement</h1>
        <p className="text-muted-foreground">
          Modifier le plan d&apos;abonnement pour {clinic.name}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {clinic.name}
            <Badge variant={badgeVariant}>{currentTier}</Badge>
          </CardTitle>
          <CardDescription>
            Plan actuel : <strong>{currentTier}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionTierForm clinicId={clinic.id} currentTier={currentTier} />
        </CardContent>
      </Card>
    </div>
  );
}
