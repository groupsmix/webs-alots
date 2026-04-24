import { defaultWebsiteConfig } from "@/lib/website-config";
import { safeJsonLdStringify } from "@/lib/json-ld";

interface MedicalBusinessSchemaProps {
  /** Override clinic name */
  name?: string;
  /** Override description */
  description?: string;
  /** URL of the clinic website */
  url?: string;
  /** Additional services offered */
  services?: string[];
  /** Geo coordinates for local search */
  coordinates?: { lat: number; lng: number };
}

/**
 * Schema.org structured data for medical business visibility in local search.
 * Renders a JSON-LD script tag with MedicalBusiness schema.
 *
 * Place this in your root layout or public pages to improve SEO.
 *
 * Usage:
 * ```tsx
 * <SEOStructuredData url="https://clinic.oltigo.com" />
 * ```
 */
export function SEOStructuredData({
  name,
  description,
  url,
  services,
  coordinates,
}: MedicalBusinessSchemaProps) {
  const contact = defaultWebsiteConfig.contact;
  const location = defaultWebsiteConfig.location;
  const clinicName = name || "Cabinet Médical";
  const clinicDescription =
    description ||
    `${clinicName} - Cabinet médical professionnel au Maroc. Prenez rendez-vous en ligne.`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: clinicName,
    description: clinicDescription,
    ...(url && { url }),
    telephone: contact.phone,
    email: contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.address,
      addressLocality: location.city,
      addressCountry: "MA",
    },
    ...(coordinates && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      },
    }),
    ...(services &&
      services.length > 0 && {
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Services médicaux",
          itemListElement: services.map((service, index) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "MedicalProcedure",
              name: service,
            },
            position: index + 1,
          })),
        },
      }),
    openingHoursSpecification: location.workingHours
      .filter((wh) => wh.hours !== "Fermé")
      .map((wh) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: wh.day,
        opens: wh.hours.split(" - ")[0],
        closes: wh.hours.split(" - ")[1],
      })),
    priceRange: "$$",
    currenciesAccepted: "MAD",
    paymentAccepted: "Cash, Credit Card",
    medicalSpecialty: "GeneralPractice",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schema) }}
    />
  );
}
