import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Stethoscope, Calendar, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { notFound } from "next/navigation";
import Image from "next/image";
import {
  getCityBySlug,
  getSpecialtyBySlug,
  TOP_CITY_SPECIALTY_COMBOS,
} from "@/lib/directory-constants";
import { getDirectoryDoctorsByCityAndSpecialty } from "@/lib/data/directory";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "oltigo.com";

interface CitySpecialtyPageProps {
  params: Promise<{ city: string; specialty: string }>;
}

export async function generateStaticParams() {
  return TOP_CITY_SPECIALTY_COMBOS;
}

export async function generateMetadata({ params }: CitySpecialtyPageProps): Promise<Metadata> {
  const { city: citySlug, specialty: specialtySlug } = await params;
  const city = getCityBySlug(citySlug);
  const specialty = getSpecialtyBySlug(specialtySlug);
  if (!city || !specialty) return {};

  const title = `${specialty.nameFr} à ${city.name} — Annuaire Médical | Oltigo`;
  const description = `Trouvez un ${specialty.nameFr.toLowerCase()} à ${city.name}, Maroc. ${specialty.description}. Prenez rendez-vous en ligne.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_MA",
      url: `${BASE_URL}/annuaire/${city.slug}/${specialty.slug}`,
      siteName: "Oltigo",
    },
    alternates: {
      canonical: `${BASE_URL}/annuaire/${city.slug}/${specialty.slug}`,
    },
  };
}

export default async function CitySpecialtyPage({ params }: CitySpecialtyPageProps) {
  const { city: citySlug, specialty: specialtySlug } = await params;
  const city = getCityBySlug(citySlug);
  const specialty = getSpecialtyBySlug(specialtySlug);
  if (!city || !specialty) notFound();

  const doctors = await getDirectoryDoctorsByCityAndSpecialty(citySlug, specialtySlug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: `${specialty.nameFr} à ${city.name}`,
    url: `${BASE_URL}/annuaire/${city.slug}/${specialty.slug}`,
    medicalSpecialty: specialty.name,
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "Country",
        name: "Morocco",
      },
    },
    ...(doctors.length > 0
      ? {
          member: doctors.map((d) => ({
            "@type": "Physician",
            name: d.name,
            medicalSpecialty: d.specialty,
            url: `${BASE_URL}/annuaire/${d.slug}`,
            ...(d.phone ? { telephone: d.phone } : {}),
            ...(d.address
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: d.address,
                    addressLocality: city.name,
                    addressCountry: "MA",
                  },
                }
              : {}),
          })),
        }
      : {}),
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/annuaire" className="hover:text-foreground">Annuaire</Link>
        <span className="mx-2">/</span>
        <Link href={`/annuaire/${city.slug}`} className="hover:text-foreground">{city.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{specialty.nameFr}</span>
      </nav>

      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">
          {specialty.nameFr} à {city.name}
        </h1>
        <p className="text-muted-foreground">
          {doctors.length} {specialty.nameFr.toLowerCase()}{doctors.length !== 1 ? "s" : ""} trouvé{doctors.length !== 1 ? "s" : ""} à {city.name}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {specialty.description}
        </p>
      </div>

      {/* Doctor list */}
      {doctors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun {specialty.nameFr.toLowerCase()} trouvé à {city.name} pour le moment.</p>
          <div className="flex justify-center gap-4 mt-4">
            <Link href={`/annuaire/${city.slug}`} className="text-primary hover:underline">
              Tous les médecins à {city.name}
            </Link>
            <Link href="/annuaire" className="text-primary hover:underline">
              Retour à l&apos;annuaire
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {doctors.map((doctor) => {
            const bookingUrl = doctor.clinicSubdomain
              ? `https://${doctor.clinicSubdomain}.${ROOT_DOMAIN}/book`
              : null;

            return (
              <Card key={doctor.id} className="hover:border-primary/50 transition-all">
                <CardContent className="pt-5 pb-5">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Avatar */}
                    {doctor.avatar ? (
                      <Image
                        src={doctor.avatar}
                        alt={doctor.name}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <Avatar className="h-16 w-16 flex-shrink-0">
                        <AvatarFallback className="text-lg bg-primary/10 text-primary">
                          {doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/annuaire/${doctor.slug}`} className="hover:underline">
                        <h2 className="text-lg font-semibold">{doctor.name}</h2>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          <Stethoscope className="h-3 w-3 mr-1" />
                          {doctor.specialty}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {doctor.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {doctor.address}
                          </span>
                        )}
                        {doctor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {doctor.phone}
                          </span>
                        )}
                      </div>
                      {doctor.consultationFee > 0 && (
                        <p className="text-sm font-medium mt-2">
                          Consultation : {doctor.consultationFee} MAD
                        </p>
                      )}
                      {doctor.languages.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {doctor.languages.map((lang) => (
                            <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col gap-2 sm:items-end mt-2 sm:mt-0">
                      <Link
                        href={`/annuaire/${doctor.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Voir le profil
                      </Link>
                      {bookingUrl && (
                        <a
                          href={bookingUrl}
                          className={buttonVariants({ size: "sm" })}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          Prendre RDV
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
