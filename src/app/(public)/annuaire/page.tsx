import type { Metadata } from "next";
import Link from "next/link";
import { Search, MapPin, Stethoscope, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { DIRECTORY_CITIES, DIRECTORY_SPECIALTIES } from "@/lib/directory-constants";
import {
  getDirectoryCities,
  getDirectorySpecialties,
} from "@/lib/data/directory";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";

export const metadata: Metadata = {
  title: "Annuaire Médical au Maroc — Trouvez votre médecin | Oltigo",
  description:
    "Trouvez un médecin, dentiste ou spécialiste près de chez vous au Maroc. Annuaire médical complet avec prise de rendez-vous en ligne à Casablanca, Rabat, Marrakech et plus.",
  openGraph: {
    title: "Annuaire Médical au Maroc — Trouvez votre médecin | Oltigo",
    description:
      "Trouvez un médecin, dentiste ou spécialiste près de chez vous au Maroc. Annuaire médical complet avec prise de rendez-vous en ligne.",
    type: "website",
    locale: "fr_MA",
    url: `${BASE_URL}/annuaire`,
    siteName: "Oltigo",
  },
  alternates: {
    canonical: `${BASE_URL}/annuaire`,
  },
};

export default async function AnnuairePage() {
  const [cities, specialties] = await Promise.all([
    getDirectoryCities(),
    getDirectorySpecialties(),
  ]);

  // Use static data for cities/specialties that don't yet have doctors
  const allCities = DIRECTORY_CITIES.map((c) => {
    const live = cities.find((lc) => lc.slug === c.slug);
    return { ...c, count: live?.count ?? 0 };
  });

  const allSpecialties = DIRECTORY_SPECIALTIES.map((s) => {
    const live = specialties.find((ls) => ls.slug === s.slug);
    return { ...s, count: live?.count ?? 0 };
  });

  const totalDoctors = cities.reduce((sum, c) => sum + c.count, 0);
  const totalCities = cities.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${BASE_URL}/annuaire#directory`,
    name: "Annuaire Médical Oltigo — Maroc",
    url: `${BASE_URL}/annuaire`,
    description:
      "Annuaire médical complet au Maroc. Trouvez un médecin, dentiste ou spécialiste et prenez rendez-vous en ligne.",
    areaServed: {
      "@type": "Country",
      name: "Morocco",
      alternateName: "Maroc",
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Annuaire Médical au Maroc
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Trouvez un médecin, dentiste ou spécialiste près de chez vous.
          {totalDoctors > 0 && (
            <span className="block mt-2 text-sm">
              {totalDoctors} professionnels de santé dans {totalCities} villes
            </span>
          )}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          <span>Sélectionnez une ville ou une spécialité ci-dessous</span>
        </div>
      </div>

      {/* Cities */}
      <section className="mb-16">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Par ville</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {allCities.map((city) => (
            <Link key={city.slug} href={`/annuaire/${city.slug}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{city.name}</p>
                    <p className="text-xs text-muted-foreground">{city.region}</p>
                  </div>
                  {city.count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {city.count}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Specialties */}
      <section className="mb-16">
        <div className="flex items-center gap-2 mb-6">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Par spécialité</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {allSpecialties.map((spec) => (
            <Card key={spec.slug} className="h-full">
              <CardContent className="pt-4 pb-4">
                <p className="font-medium">{spec.nameFr}</p>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {spec.description}
                </p>
                {spec.count > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {spec.count} praticien{spec.count > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Popular combos */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Recherches populaires</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { city: "casablanca", specialty: "dentiste", label: "Dentiste à Casablanca" },
            { city: "rabat", specialty: "medecin-generaliste", label: "Médecin généraliste à Rabat" },
            { city: "marrakech", specialty: "gynecologue", label: "Gynécologue à Marrakech" },
            { city: "casablanca", specialty: "cardiologue", label: "Cardiologue à Casablanca" },
            { city: "fes", specialty: "pediatre", label: "Pédiatre à Fès" },
            { city: "tanger", specialty: "dermatologue", label: "Dermatologue à Tanger" },
            { city: "agadir", specialty: "ophtalmologue", label: "Ophtalmologue à Agadir" },
            { city: "casablanca", specialty: "orl", label: "ORL à Casablanca" },
            { city: "rabat", specialty: "pediatre", label: "Pédiatre à Rabat" },
            { city: "marrakech", specialty: "dentiste", label: "Dentiste à Marrakech" },
          ].map((combo) => (
            <Link
              key={`${combo.city}-${combo.specialty}`}
              href={`/annuaire/${combo.city}/${combo.specialty}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              {combo.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
