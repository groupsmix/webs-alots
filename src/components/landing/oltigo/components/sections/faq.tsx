"use client";

import { Accordion } from "@/components/landing/oltigo/components/ui/accordion";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { SectionHeading } from "./section-kit";

export function FaqSchema() {
  const { dict } = useI18n();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}

export function Faq() {
  const { dict } = useI18n();
  return (
    <section id="faq" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow={dict.faq.eyebrow} title={dict.faq.title} />
        <div className="lg:pt-2">
          <Accordion items={dict.faq.items} />
        </div>
      </div>
    </section>
  );
}
