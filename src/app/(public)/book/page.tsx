import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { safeJsonLdStringify } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Prendre Rendez-vous",
  description:
    "Réservez votre rendez-vous médical en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.",
  openGraph: {
    title: "Prendre Rendez-vous",
    description: "Réservez votre rendez-vous médical en ligne en quelques clics.",
  },
};

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
