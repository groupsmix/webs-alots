import { Fragment } from "react";
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
import { JsonLdScript } from "@/components/seo/json-ld";
import type { ClinicBranding, PublicReview } from "@/lib/data/public";
import type { Locale } from "@/lib/i18n";
import type { SectionKey, SectionVisibility } from "@/lib/section-visibility";
import { resolveSectionOrder, type TemplateDefinition } from "@/lib/templates";
import { BaseHero, type HeroVariant } from "./base-hero";
import { BaseServices } from "./base-services";
import { getFaqFromBranding, getHeroOverrides } from "./template-helpers";

export interface PublicPageProps {
  branding: ClinicBranding;
  reviews: PublicReview[];
  avgRating: number;
  locale: Locale;
  nonce?: string;
  template: TemplateDefinition;
  sections: SectionVisibility;
  clinicSchema: Record<string, unknown>;
}

interface BaseTemplateProps extends PublicPageProps {
  renderers?: Partial<Record<SectionKey, React.ReactNode>>;
}

export function buildDefaultRenderers({
  branding,
  reviews,
  avgRating,
  locale,
  template,
  sections,
}: PublicPageProps): Partial<Record<SectionKey, React.ReactNode>> {
  const heroOverrides = getHeroOverrides(branding);
  const faq = getFaqFromBranding(branding);

  const renderers: Partial<Record<SectionKey, React.ReactNode>> = {};

  if (sections.hero) {
    renderers.hero = (
      <BaseHero
        branding={branding}
        overrides={heroOverrides}
        variant={template.heroStyle as HeroVariant}
        dark={template.bgMode === "dark"}
      />
    );
  }
  if (sections.services) {
    renderers.services = <BaseServices cardStyle={template.cardStyle} />;
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
  if (sections.blog) {
    renderers.blog = <BlogSection />;
  }
  if (sections.location) {
    renderers.location = (
      <LocationSection address={branding.address} websiteConfig={branding.websiteConfig} />
    );
  }
  if (sections.booking) {
    renderers.booking = <BookingSection locale={locale} />;
  }
  if (sections.contactForm) {
    renderers.contactForm = <ContactFormSection />;
  }
  if (sections.insurance) {
    renderers.insurance = <InsuranceSection />;
  }
  if (sections.faq) {
    renderers.faq = <FaqSection title={faq.title} subtitle={faq.subtitle} faqs={faq.items} />;
  }

  return renderers;
}

export function BaseTemplate({ template, nonce, clinicSchema, renderers = {} }: BaseTemplateProps) {
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

export type { HeroVariant } from "./base-hero";
