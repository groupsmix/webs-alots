"use client";

import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { SectionHeading } from "./section-kit";

export function Testimonials() {
  const { dict } = useI18n();
  return (
    <section className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={dict.testimonials.eyebrow} title={dict.testimonials.title} />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {dict.testimonials.items.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <figure className="panel flex h-full flex-col justify-between rounded-2xl p-6">
                <blockquote className="text-[15px] leading-relaxed text-text">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-7 flex items-center justify-between border-t border-hairline pt-5">
                  <div>
                    <p className="text-[13.5px] font-medium text-text">{t.name}</p>
                    <p className="text-[12px] text-text-muted">
                      {t.role} · {t.city}
                    </p>
                  </div>
                  <span className="telemetry rounded-full border border-hairline px-2.5 py-1 text-[10px] uppercase tracking-wider text-text-secondary">
                    {t.plan}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
