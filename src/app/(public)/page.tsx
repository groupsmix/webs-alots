import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fragment } from "react";
import { LandingPage } from "@/components/landing/landing-page";
import { dictionaries as landingDictionaries } from "@/components/landing/oltigo/i18n/dictionaries";
import { HeroSection } from "@/components/public/hero-section";
import {
  BlogSection,
  BookingSection,
  ContactFormSection,
  DoctorsSection,
  FaqSection,
  InsuranceSection,
  LocationSection,
  ReviewsSection,
  WhyChooseSection,
} from "@/components/public/sections";
import { ServicesPreview } from "@/components/public/services-preview";
import { PremiumTemplate } from "@/components/public/templates/premium";
import { JsonLdScript } from "@/components/seo/json-ld";
import { getPublicAverageRating, getPublicBranding, getPublicReviews } from "@/lib/data/public";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import { t, type Locale } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { buildMetadata } from "@/lib/metadata";
import { mergeSectionVisibility, type SectionKey } from "@/lib/section-visibility";
import { getTemplate, resolveSectionOrder } from "@/lib/templates";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

/** Default timeout (ms) for Supabase data-fetching on public pages. */
const DATA_FETCH_TIMEOUT_MS = 10_000;

/**
 * Race a promise against a timeout. Rejects with a descriptive error
 * if the promise does not settle within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} did not respond within ${ms}ms`)), ms),
    ),
  ]);
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

  if (!tenant) {
    const metaTitle = t(locale, "public.meta.title");
    const metaDescription = t(locale, "public.meta.description");
    return buildMetadata({
      title: metaTitle,
      description: metaDescription,
      path: "/",
      locale,
      keywords: [
        "gestion cabinet médical Maroc",
        "rendez-vous en ligne",
        "logiciel médical",
        "WhatsApp rappels patients",
        "dossier patient chiffré",
        "SaaS santé Maroc",
        "Oltigo",
      ],
      imageAlt: metaTitle,
    });
  }

  const branding = await getPublicBranding();
  const clinicName = branding.clinicName || tenant.clinicName || t(locale, "public.clinicFallback");
  const rootDomain = getRootDomain() || "oltigo.com";
  const canonicalUrl = `https://${tenant.subdomain}.${rootDomain}`;

  const title = t(locale, "public.bookOnlineSuffix", { clinicName });
  const description = branding.tagline
    ? t(locale, "public.clinicMetaDesc", { clinicName, tagline: branding.tagline })
    : t(locale, "public.clinicMetaDescDefault", { clinicName });

  return buildMetadata({
    title,
    description,
    path: "/",
    locale,
    siteUrl: canonicalUrl,
    imageAlt: title,
  });
}

export default async function HomePage() {
  const tenant = await getTenant();
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const nonce = h.get("x-nonce") || undefined;

  // Root domain (no subdomain) → show SaaS landing page
  if (!tenant) {
    const siteUrl = getSiteUrl() || "https://oltigo.com";
    const saasJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Oltigo",
      url: siteUrl,
      logo: `${siteUrl}/opengraph-image.png`,
      sameAs: ["https://www.linkedin.com/company/oltigo"],
      contactPoint: {
        "@type": "ContactPoint",
        email: "contact@oltigo.com",
        areaServed: "MA",
        availableLanguage: ["French", "Arabic", "English"],
        contactType: "customer support",
      },
      description:
        "Plateforme SaaS de gestion de cabinets médicaux au Maroc. Rendez-vous en ligne, dossier patient chiffré, rappels WhatsApp.",
      foundingDate: "2024",
      areaServed: {
        "@type": "Country",
        name: "Morocco",
      },
    };
    const softwareJsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Oltigo Health",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Plateforme complète pour gérer votre cabinet médical : rendez-vous, dossiers patients chiffrés, rappels WhatsApp en darija.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "999",
        priceCurrency: "MAD",
        offerCount: 4,
      },
    };
    const landingDict =
      landingDictionaries[locale as keyof typeof landingDictionaries] ?? landingDictionaries.fr;
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: landingDict.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
    const webPageJsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": siteUrl,
      url: siteUrl,
      name: "Oltigo — Système d'exploitation des cabinets médicaux au Maroc",
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["#speakable-summary"],
      },
    };
    return (
      <>
        <JsonLdScript data={saasJsonLd} nonce={nonce} />
        <JsonLdScript data={softwareJsonLd} nonce={nonce} />
        <JsonLdScript data={faqJsonLd} nonce={nonce} />
        <JsonLdScript data={webPageJsonLd} nonce={nonce} />
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <div id="speakable-summary" className="sr-only">
          Oltigo est une plateforme SaaS marocaine de gestion de cabinets médicaux : rendez-vous en
          ligne, dossier patient chiffré, rappels WhatsApp en darija et paiements sécurisés.
        </div>
        <LandingPage />
      </>
    );
  }

  // Subdomain → show clinic homepage with tenant data
  let branding;
  let reviews;
  let avgRating;

  try {
    [branding, reviews, avgRating] = await withTimeout(
      Promise.all([getPublicBranding(), getPublicReviews(), getPublicAverageRating()]),
      DATA_FETCH_TIMEOUT_MS,
      "clinic public data",
    );
  } catch (err) {
    logger.error("Failed to fetch public clinic data", {
      context: "public-page",
      clinicId: tenant.clinicId,
      error: err,
    });
    throw err;
  }

  if (!branding) {
    throw new Error("Branding not found");
  }

  const sections = mergeSectionVisibility(branding.sectionVisibility as Record<string, boolean>);
  const template = getTemplate(branding.templateId);

  const rootDomain = getRootDomain() || "oltigo.com";
  const canonicalUrl = `https://${tenant.subdomain}.${rootDomain}`;

  const images = [branding.logoUrl, branding.heroImageUrl, branding.coverPhotoUrl].filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  );

  const workingHours =
    (
      branding.websiteConfig as {
        location?: { workingHours?: { day: string; hours: string }[] };
      }
    )?.location?.workingHours ?? defaultWebsiteConfig.location.workingHours;

  const DAY_MAP: Record<string, string> = {
    Lundi: "Monday",
    Mardi: "Tuesday",
    Mercredi: "Wednesday",
    Jeudi: "Thursday",
    Vendredi: "Friday",
    Samedi: "Saturday",
    Dimanche: "Sunday",
  };

  const openingHours = workingHours
    .filter((wh) => wh.hours && !wh.hours.toLowerCase().includes("fermé"))
    .map((wh) => {
      const [opens, closes] = wh.hours.split("-").map((s) => s.trim());
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DAY_MAP[wh.day] ?? wh.day,
        opens,
        closes,
      };
    })
    .filter((oh) => oh.opens && oh.closes);

  const geo = (branding.websiteConfig as { geo?: { latitude?: number; longitude?: number } })?.geo;
  const priceRange = (branding.websiteConfig as { priceRange?: string })?.priceRange ?? "€€";

  const clinicSchema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MedicalOrganization"],
    "@id": `${canonicalUrl}/#organization`,
    name: branding.clinicName || tenant.clinicName,
    url: canonicalUrl,
    ...(images.length ? { image: images } : {}),
    ...(branding.phone ? { telephone: branding.phone } : {}),
    ...(branding.email ? { email: branding.email } : {}),
    ...(branding.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: branding.address,
            addressCountry: "MA",
          },
        }
      : {}),
    ...(geo?.latitude != null && geo?.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        }
      : {}),
    ...(openingHours.length ? { openingHoursSpecification: openingHours } : {}),
    priceRange,
    ...(branding.logoUrl ? { logo: branding.logoUrl } : {}),
    ...(avgRating > 0 && reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avgRating,
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    potentialAction: {
      "@type": "ReserveAction",
      target: `${canonicalUrl}/book`,
      name: t(locale, "public.bookOnline"),
    },
  };

  const websiteHero = (
    branding.websiteConfig as { hero?: { title?: string; subtitle?: string } } | null
  )?.hero;
  const heroOverrides = {
    title: websiteHero?.title ?? branding.clinicName,
    subtitle: (websiteHero?.subtitle ?? branding.tagline) || undefined,
    imageUrl: branding.heroImageUrl ?? branding.coverPhotoUrl ?? undefined,
  };

  const websiteFaq = (
    branding.websiteConfig as {
      faq?: { title?: string; subtitle?: string; items?: { q: string; a: string }[] };
    } | null
  )?.faq;
  const faq = {
    title: websiteFaq?.title ?? defaultWebsiteConfig.faq.title,
    subtitle: websiteFaq?.subtitle ?? defaultWebsiteConfig.faq.subtitle,
    items: websiteFaq?.items ?? defaultWebsiteConfig.faq.items,
  };

  // Premium template gets its own self-contained package.
  if (template.id === "premium") {
    return (
      <PremiumTemplate
        branding={branding}
        reviews={reviews}
        avgRating={avgRating}
        locale={locale}
        nonce={nonce}
        template={template}
        sections={sections}
        clinicSchema={clinicSchema}
      />
    );
  }

  // Generic templates use the shared, neutral section components.
  const renderers: Partial<Record<SectionKey, React.ReactNode>> = {};

  if (sections.hero) {
    renderers.hero = <HeroSection variant={template.heroStyle} overrides={heroOverrides} />;
  }
  if (sections.services) {
    renderers.services = <ServicesPreview cardStyle={template.cardStyle} />;
  }
  if (sections.why) {
    renderers.why = (
      <WhyChooseSection cardStyle={template.cardStyle} clinicName={branding.clinicName} />
    );
  }
  if (sections.doctors) {
    renderers.doctors = <DoctorsSection cardStyle={template.cardStyle} />;
  }
  if (sections.reviews && reviews.length > 0) {
    renderers.reviews = (
      <ReviewsSection
        reviews={reviews}
        avgRating={avgRating}
        locale={locale}
        cardStyle={template.cardStyle}
      />
    );
  }
  if (sections.blog) renderers.blog = <BlogSection />;
  if (sections.location) {
    renderers.location = (
      <LocationSection address={branding.address} websiteConfig={branding.websiteConfig} />
    );
  }
  if (sections.booking) renderers.booking = <BookingSection locale={locale} />;
  if (sections.contactForm) renderers.contactForm = <ContactFormSection />;
  if (sections.insurance) renderers.insurance = <InsuranceSection />;
  if (sections.faq) {
    renderers.faq = <FaqSection title={faq.title} subtitle={faq.subtitle} faqs={faq.items} />;
  }

  const orderedSections = resolveSectionOrder(
    template.sectionOrder,
    Object.keys(renderers) as SectionKey[],
  );

  return (
    <div className={template.wrapperClass} dir={template.rtl ? "rtl" : "ltr"}>
      <JsonLdScript data={clinicSchema} nonce={nonce} />
      {orderedSections.map((key) => (
        <Fragment key={key}>{renderers[key]}</Fragment>
      ))}
    </div>
  );
}
