import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingForm } from "@/components/booking/booking-form";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import { t, type Locale } from "@/lib/i18n";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";

/**
 * Dynamic metadata that includes the clinic name when available (Issue 58).
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const h = await headers();
  const locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const clinicName = tenant?.clinicName;
  const rootDomain = getRootDomain() || "oltigo.com";
  const siteUrl = tenant ? `https://${tenant.subdomain}.${rootDomain}` : undefined;

  const title = clinicName ? `Prendre Rendez-vous — ${clinicName}` : "Prendre Rendez-vous";
  const description = clinicName
    ? `Réservez votre rendez-vous chez ${clinicName} en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.`
    : "Réservez votre rendez-vous médical en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.";

  return buildMetadata({
    title,
    description,
    path: "/book",
    locale,
    siteUrl,
  });
}

export default async function BookingPage() {
  const tenant = await getTenant();
  if (!tenant) {
    redirect("/annuaire/");
  }

  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const baseUrl = getSiteUrl() || "https://oltigo.com";

  const bookingSchema = {
    "@context": "https://schema.org",
    "@type": "ReserveAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/book`,
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    result: {
      "@type": "MedicalAppointment",
    },
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(bookingSchema) }}
      />
      <h1 className="sr-only">{t(locale, "booking.title")}</h1>
      <ErrorBoundary section="Booking Form">
        <BookingForm />
      </ErrorBoundary>
    </div>
  );
}
