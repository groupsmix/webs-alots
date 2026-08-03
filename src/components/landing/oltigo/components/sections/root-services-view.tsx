"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { SectionHeading } from "./section-kit";

export function RootServicesView() {
  const { dict } = useI18n();

  return (
    <section className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow={dict.featuresHeading.eyebrow}
          title={dict.featuresHeading.title}
          sub={dict.featuresHeading.sub}
          align="center"
          as="h1"
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dict.features.map((feature) => (
            <div key={feature.id} className="panel flex flex-col rounded-2xl p-6 sm:p-8">
              <span className="telemetry text-[14px] text-emerald/70">{feature.num}</span>
              <h2 className="mt-3 text-xl text-text">{feature.title}</h2>
              <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-text-secondary">
                {feature.tagline}
              </p>
              <ul className="mt-5 space-y-2">
                {feature.bullets.slice(0, 3).map((bullet, i) => (
                  <li key={i} className="text-[13.5px] text-text-secondary">
                    {bullet}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                size="sm"
                href={`/features/${feature.id}`}
                className="mt-6 group/btn"
                data-event={`cta-services-${feature.id}`}
              >
                {feature.cta}
                <ArrowRight
                  className="size-4 transition-transform group-hover/btn:translate-x-0.5 rtl:rotate-180"
                  strokeWidth={1.75}
                />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button
            variant="primary"
            size="lg"
            href="/register-clinic"
            data-event="cta-services-register"
          >
            Créer votre clinique
            <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </section>
  );
}
