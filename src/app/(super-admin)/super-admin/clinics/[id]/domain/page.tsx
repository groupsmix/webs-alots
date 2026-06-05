/* eslint-disable i18next/no-literal-string */
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { CustomDomainForm } from "./custom-domain-form";

export default async function ClinicDomainPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("super_admin");
  const { id } = await params;

  // Feature flag — guard the entire page when custom domains are not enabled
  if (!process.env.NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Domaines personnalisés non activés sur cet environnement.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant read
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, custom_domain, domain_status")
    .eq("id", id)
    .single();

  if (!clinic) notFound();

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Cliniques", href: "/super-admin/clinics" },
          { label: clinic.name, href: `/super-admin/clinics/${id}` },
          { label: "Domaine personnalisé" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Domaine personnalisé</h1>
        <p className="text-muted-foreground">
          Configurez et vérifiez le domaine personnalisé pour {clinic.name}.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CustomDomainForm
            clinicId={clinic.id}
            currentDomain={clinic.custom_domain ?? null}
            status={clinic.domain_status ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
