import {
  MapPin, Stethoscope, Calendar, ArrowRight,
  Phone, Languages, Award, Building2,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import {
  getDirectoryDoctorsByCity,
  getDirectorySpecialtiesInCity,
  getDirectoryDoctorBySlug,
  getDirectoryDoctors,
} from "@/lib/data/directory";
import {
  DIRECTORY_CITIES,
  getCityBySlug,
  getSpecialtyBySlug,
} from "@/lib/directory-constants";
import { safeJsonLdStringify } from "@/lib/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "oltigo.com";

interface PageProps {
  params: Promise<{ city: string }>;
}

function isDoctorSlug(slug: string): boolean {
  return slug.startsWith("dr-");
}

export async function generateStaticParams() {
  const cityParams = DIRECTORY_CITIES.map((c) => ({ city: c.slug }));
  const doctors = await getDirectoryDoctors();
  const doctorParams = doctors.map((d) => ({ city: d.slug }));
  return [...cityParams, ...doctorParams];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;

  // Doctor profile
  if (isDoctorSlug(slug)) {
    const doctor = await getDirectoryDoctorBySlug(slug);
    if (!doctor) return {};

    const title = `${doctor.name} — ${doctor.specialty} à ${doctor.city} | Oltigo`;
    const description = `Prenez rendez-vous avec ${doctor.name}, ${doctor.specialty.toLowerCase()} à ${doctor.city}. ${doctor.clinicName}. Consultation en ligne disponible.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "profile",
        locale: "fr_MA",
        url: `${BASE_URL}/annuaire/${doctor.slug}`,
        siteName: "Oltigo",
        ...(doctor.avatar ? { images: [{ url: doctor.avatar, width: 200, height: 200, alt: doctor.name }] } : {}),
      },
      alternates: { canonical: `${BASE_URL}/annuaire/${doctor.slug}` },
    };
  }

  // City page
  const city = getCityBySlug(slug);
  if (!city) return {};

  const title = `Médecins à ${city.name} — Annuaire Médical | Oltigo`;
  const description = `Trouvez un médecin, dentiste ou spécialiste à ${city.name}, Maroc. Consultez les profils, avis et prenez rendez-vous en ligne.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_MA",
      url: `${BASE_URL}/annuaire/${city.slug}`,
      siteName: "Oltigo",
    },
    alternates: { canonical: `${BASE_URL}/annuaire/${city.slug}` },
  };
}

// ── Doctor Profile View ──

function DoctorProfileView({
  doctor,
}: {
  doctor: NonNullable<Awaited<ReturnType<typeof getDirectoryDoctorBySlug>>>;
}) {
  const city = getCityBySlug(doctor.citySlug);
  const specialty = getSpecialtyBySlug(doctor.specialtySlug);
  const bookingUrl = doctor.clinicSubdomain
    ? `https://${doctor.clinicSubdomain}.${ROOT_DOMAIN}/book`
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": `${BASE_URL}/annuaire/${doctor.slug}#physician`,
    name: doctor.name,
    url: `${BASE_URL}/annuaire/${doctor.slug}`,
    medicalSpecialty: doctor.specialty,
    ...(doctor.avatar ? { image: doctor.avatar } : {}),
    ...(doctor.phone ? { telephone: doctor.phone } : {}),
    ...(doctor.languages.length > 0 ? { knowsLanguage: doctor.languages } : {}),
    ...(doctor.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: doctor.address,
            addressLocality: doctor.city,
            addressCountry: "MA",
          },
        }
      : {}),
    worksFor: {
      "@type": "MedicalBusiness",
      name: doctor.clinicName,
      ...(doctor.clinicSubdomain ? { url: `https://${doctor.clinicSubdomain}.${ROOT_DOMAIN}` } : {}),
    },
    ...(bookingUrl
      ? {
          potentialAction: {
            "@type": "ReserveAction",
            target: bookingUrl,
            name: "Prendre rendez-vous en ligne",
          },
        }
      : {}),
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/annuaire" className="hover:text-foreground">Annuaire</Link>
        {city && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/annuaire/${city.slug}`} className="hover:text-foreground">{city.name}</Link>
          </>
        )}
        {city && specialty && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/annuaire/${city.slug}/${specialty.slug}`} className="hover:text-foreground">
              {specialty.nameFr}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-foreground">{doctor.name}</span>
      </nav>

      {/* Profile card */}
      <Card className="mb-8">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex-shrink-0">
              {doctor.avatar ? (
                <Image
                  src={doctor.avatar}
                  alt={doctor.name}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-full object-cover shadow-lg"
                />
              ) : (
                <Avatar className="h-32 w-32">
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{doctor.name}</h1>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  {doctor.specialty}
                </Badge>
                {city && (
                  <Badge variant="outline">
                    <MapPin className="h-3 w-3 mr-1" />
                    {city.name}
                  </Badge>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 mb-4">
                {doctor.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{doctor.address}</span>
                  </div>
                )}
                {doctor.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                    <a href={`tel:${doctor.phone}`} className="hover:text-foreground">{doctor.phone}</a>
                  </div>
                )}
                {doctor.consultationFee > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Consultation : <strong>{doctor.consultationFee} MAD</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{doctor.clinicName}</span>
                </div>
              </div>
              {doctor.languages.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="h-4 w-4 text-primary" />
                  <div className="flex gap-1">
                    {doctor.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {bookingUrl && (
                <a href={bookingUrl} className={buttonVariants({ size: "lg" })}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Prendre rendez-vous en ligne
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {doctor.bio && (
        <Card className="mb-8">
          <CardContent className="pt-6 pb-6">
            <h2 className="text-lg font-semibold mb-3">À propos</h2>
            <p className="text-muted-foreground whitespace-pre-line">{doctor.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Clinic info */}
      <Card className="mb-8">
        <CardContent className="pt-6 pb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Cabinet
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{doctor.clinicName}</p>
            {doctor.address && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {doctor.address}
              </p>
            )}
            {doctor.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <a href={`tel:${doctor.phone}`} className="hover:text-foreground">{doctor.phone}</a>
              </p>
            )}
          </div>
          {doctor.clinicSubdomain && (
            <div className="mt-4">
              <a
                href={`https://${doctor.clinicSubdomain}.${ROOT_DOMAIN}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visiter le site du cabinet
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related links */}
      <div className="flex flex-wrap gap-3">
        {city && (
          <Link href={`/annuaire/${city.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Tous les médecins à {city.name}
          </Link>
        )}
        {city && specialty && (
          <Link
            href={`/annuaire/${city.slug}/${specialty.slug}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {specialty.nameFr}s à {city.name}
          </Link>
        )}
        <Link href="/annuaire" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Annuaire complet
        </Link>
      </div>
    </div>
  );
}

// ── City Listing View ──

function CityListingView({
  citySlug,
  city,
  doctors,
  specialties,
}: {
  citySlug: string;
  city: NonNullable<ReturnType<typeof getCityBySlug>>;
  doctors: Awaited<ReturnType<typeof getDirectoryDoctorsByCity>>;
  specialties: Awaited<ReturnType<typeof getDirectorySpecialtiesInCity>>;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: `Médecins à ${city.name}`,
    url: `${BASE_URL}/annuaire/${city.slug}`,
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: { "@type": "Country", name: "Morocco" },
    },
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
        <span className="text-foreground">{city.name}</span>
      </nav>

      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold">Médecins à {city.name}</h1>
        </div>
        <p className="text-muted-foreground">
          {doctors.length} professionnel{doctors.length !== 1 ? "s" : ""} de santé à {city.name}, {city.region}
        </p>
      </div>

      {/* Specialties filter */}
      {specialties.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Filtrer par spécialité
          </h2>
          <div className="flex flex-wrap gap-2">
            {specialties.map((spec) => {
              const specInfo = getSpecialtyBySlug(spec.slug);
              return (
                <Link
                  key={spec.slug}
                  href={`/annuaire/${citySlug}/${spec.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  {specInfo?.nameFr ?? spec.name}
                  <Badge variant="secondary" className="ml-1 text-xs">{spec.count}</Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Doctor list */}
      {doctors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun médecin trouvé à {city.name} pour le moment.</p>
          <Link href="/annuaire" className="text-primary hover:underline mt-2 inline-block">
            Retour à l&apos;annuaire
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <Link key={doctor.id} href={`/annuaire/${doctor.slug}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    {doctor.avatar ? (
                      <Image
                        src={doctor.avatar}
                        alt={doctor.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-sm bg-primary/10 text-primary">
                          {doctor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{doctor.name}</p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                      <p className="text-xs text-muted-foreground mt-1">{doctor.clinicName}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {doctor.consultationFee > 0 && (
                      <span className="text-sm font-medium">{doctor.consultationFee} MAD</span>
                    )}
                    {doctor.clinicSubdomain && (
                      <span className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <Calendar className="h-3 w-3 mr-1" />
                        Rendez-vous
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Other cities */}
      <section className="mt-16">
        <h2 className="text-xl font-bold mb-4">Autres villes</h2>
        <div className="flex flex-wrap gap-2">
          {DIRECTORY_CITIES
            .filter((c) => c.slug !== citySlug)
            .slice(0, 12)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/annuaire/${c.slug}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {c.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

// ── Page Component ──

export default async function CityOrDoctorPage({ params }: PageProps) {
  const { city: slug } = await params;

  // Doctor profile page (slug starts with "dr-")
  if (isDoctorSlug(slug)) {
    const doctor = await getDirectoryDoctorBySlug(slug);
    if (!doctor) notFound();
    return <DoctorProfileView doctor={doctor} />;
  }

  // City listing page
  const city = getCityBySlug(slug);
  if (!city) notFound();

  const [doctors, specialties] = await Promise.all([
    getDirectoryDoctorsByCity(slug),
    getDirectorySpecialtiesInCity(slug),
  ]);

  return (
    <CityListingView
      citySlug={slug}
      city={city}
      doctors={doctors}
      specialties={specialties}
    />
  );
}
