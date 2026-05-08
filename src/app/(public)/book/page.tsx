import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { getTenant } from "@/lib/tenant";

/**
 * Dynamic metadata that includes the clinic name when available (Issue 58).
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const clinicName = tenant?.clinicName;

  const title = clinicName
    ? `Prendre Rendez-vous — ${clinicName}`
    : "Prendre Rendez-vous";
  const description = clinicName
    ? `Réservez votre rendez-vous chez ${clinicName} en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.`
    : "Réservez votre rendez-vous médical en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default function BookingPage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const bookingSchema = {
    "@context": "https://schema.org",
    "@type": "ReserveAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/book`,
      actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
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
      <ErrorBoundary section="Booking Form">
        <BookingForm />
      </ErrorBoundary>
    </div>
  );
}
