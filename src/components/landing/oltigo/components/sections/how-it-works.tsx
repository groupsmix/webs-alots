"use client";

import { BarChart3, Settings, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { SectionHeading } from "./section-kit";

const stepIcons = [UserPlus, Settings, Users, BarChart3];

export function HowItWorks() {
  const { dict } = useI18n();
  return (
    <section id="how" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={dict.how.eyebrow} title={dict.how.title} sub={dict.how.sub} />

        <div className="relative mt-16">
          {/* connecting hairline that draws in */}
          <Reveal
            variant="line"
            className="absolute inset-x-0 top-[14px] hidden h-px bg-hairline lg:block"
          />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {dict.how.steps.map((s, i) => {
              const Icon = stepIcons[i];
              return (
                <Reveal key={s.num} delay={i * 90} as="li">
                  <div className="relative">
                    <span className="relative z-10 inline-grid size-7 place-items-center rounded-full border border-hairline bg-ink">
                      <Icon className="size-3.5 text-emerald" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="telemetry mt-5 block text-[12px] text-text-muted">
                      {s.num}
                    </span>
                    <h3 className="mt-1.5 text-[17px] font-medium text-text">{s.title}</h3>
                    <p className="mt-2 max-w-[28ch] text-[14px] leading-relaxed text-text-secondary">
                      {s.body}
                    </p>
                    {i === 2 && dict.how.securityNote ? (
                      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-emerald/80">
                        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {dict.how.securityNote}
                      </p>
                    ) : null}
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
