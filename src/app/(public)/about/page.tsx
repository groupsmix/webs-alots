import {
  Award,
  Languages,
  GraduationCap,
  Briefcase,
  Building2,
  Shield,
  Users,
  Globe,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRootDomain } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const h = await headers();
  const locale = (h.get("x-tenant-locale") as "fr" | "ar" | "en" | "ary") || "fr";
  if (!tenant) {
    return buildMetadata({
      title: "À propos",
      description:
        "Oltigo est la plateforme marocaine dédiée à la gestion opérationnelle des cabinets, cliniques et pharmacies au Maroc.",
      path: "/about",
      locale,
    });
  }
  const rootDomain = getRootDomain() || "oltigo.com";
  return buildMetadata({
    title: "À propos — Notre Médecin",
    description:
      "Découvrez notre médecin, ses qualifications, son expérience et sa spécialité. Un professionnel de santé dédié à votre bien-être.",
    path: "/about",
    locale,
    siteUrl: `https://${tenant.subdomain}.${rootDomain}`,
  });
}

function OltigoAbout() {
  const title = "À propos de la plateforme";
  const body =
    "Oltigo est la plateforme marocaine de gestion opérationnelle pour les cabinets, cliniques et pharmacies. Rendez-vous, rappels WhatsApp, dossiers patients chiffrés et analyses : tout réuni dans un outil simple, rapide et conforme à la Loi 09-08.";
  const values = [
    {
      icon: Shield,
      label: "Sécurité des données",
      value: "Chiffrement AES-256-GCM et conformité Loi 09-08 / CNDP.",
    },
    {
      icon: Globe,
      label: "Hébergement au Maroc",
      value:
        "Données stockées sur l'infrastructure Supabase UE, avec cloisonnement strict par cabinet.",
    },
    {
      icon: Users,
      label: "Conçu par et pour les praticiens",
      value: "Une interface pensée pour le flux de travail réel d'un cabinet médical marocain.",
    },
    {
      icon: Building2,
      label: "Multi-sites & multi-praticiens",
      value: "Un sous-domaine dédié par cabinet, une gestion unifiée pour les groupes.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-12">{body}</p>

        <div className="grid gap-4 md:grid-cols-2 mb-12 text-start">
          {values.map((v) => (
            <Card key={v.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <v.icon className="h-5 w-5 text-primary" />
                  {v.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{v.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClinicAbout() {
  const cfg = defaultWebsiteConfig.about;

  const credentials = [
    { icon: GraduationCap, label: "Formation", value: cfg.education },
    { icon: Award, label: "Spécialisation", value: cfg.specialization },
    { icon: Briefcase, label: "Expérience", value: cfg.experience },
    { icon: Languages, label: "Langues", value: cfg.languages },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          {cfg.photoUrl ? (
            <Image
              src={cfg.photoUrl}
              alt={cfg.doctorName}
              width={128}
              height={128}
              className="h-32 w-32 rounded-full mx-auto mb-4 object-cover shadow-lg"
            />
          ) : (
            <Avatar className="h-24 w-24 mx-auto mb-4">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {cfg.doctorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          )}
          <h1 className="text-3xl font-bold mb-2">{cfg.doctorName}</h1>
          <p className="text-lg text-primary font-medium">{cfg.specialty}</p>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{cfg.bio}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-12">
          {credentials.map((cred) => (
            <Card key={cred.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <cred.icon className="h-5 w-5 text-primary" />
                  {cred.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{cred.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>À propos de notre cabinet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{cfg.practiceDescription}</p>
            <p>{cfg.practiceDetails}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function AboutPage() {
  const tenant = await getTenant();
  return tenant ? <ClinicAbout /> : <OltigoAbout />;
}
