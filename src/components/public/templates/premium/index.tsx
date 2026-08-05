import { Fragment } from "react";
import {
  BlogSection,
  ContactFormSection,
  FaqSection,
  InsuranceSection,
  LocationSection,
  ReviewsSection,
  WhyChooseSection,
} from "@/components/public/sections";
import { JsonLdScript } from "@/components/seo/json-ld";
import type { ClinicBranding, PublicReview } from "@/lib/data/public";
import type { Locale } from "@/lib/i18n";
import type { SectionVisibility } from "@/lib/section-visibility";
import { resolveSectionOrder, type TemplateDefinition } from "@/lib/templates";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { PremiumBooking } from "./booking";
import { PremiumDoctors } from "./doctors";
import { PremiumHero } from "./hero";
import { PremiumServices } from "./services";

interface PremiumTemplateProps {
  branding: ClinicBranding;
  reviews: PublicReview[];
  avgRating: number;
  locale: Locale;
  nonce?: string;
  template: TemplateDefinition;
  sections: SectionVisibility;
  clinicSchema: Record<string, unknown>;
}

export function PremiumTemplate({
  branding,
  reviews,
  avgRating,
  locale,
  nonce,
  template,
  sections,
  clinicSchema,
}: PremiumTemplateProps) {
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

  const renderers: Partial<Record<keyof SectionVisibility, React.ReactNode>> = {};

  if (sections.hero) renderers.hero = <PremiumHero branding={branding} />;
  if (sections.services) renderers.services = <PremiumServices cardStyle={template.cardStyle} />;
  if (sections.why)
    renderers.why = (
      <WhyChooseSection cardStyle={template.cardStyle} clinicName={branding.clinicName} />
    );
  if (sections.doctors) renderers.doctors = <PremiumDoctors clinicName={branding.clinicName} />;
  if (sections.reviews && reviews.length > 0)
    renderers.reviews = (
      <ReviewsSection
        reviews={reviews}
        avgRating={avgRating}
        locale={locale}
        cardStyle={template.cardStyle}
      />
    );
  if (sections.blog) renderers.blog = <BlogSection />;
  if (sections.location)
    renderers.location = (
      <LocationSection address={branding.address} websiteConfig={branding.websiteConfig} />
    );
  if (sections.booking) renderers.booking = <PremiumBooking locale={locale} />;
  if (sections.contactForm) renderers.contactForm = <ContactFormSection />;
  if (sections.insurance) renderers.insurance = <InsuranceSection />;
  if (sections.faq)
    renderers.faq = <FaqSection title={faq.title} subtitle={faq.subtitle} faqs={faq.items} />;

  const orderedSections = resolveSectionOrder(
    template.sectionOrder,
    Object.keys(renderers) as (keyof SectionVisibility)[],
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
