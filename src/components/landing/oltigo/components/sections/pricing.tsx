"use client";

import { Check } from "lucide-react";
import { BilingualNumeral } from "@/components/landing/oltigo/components/primitives/bilingual-numeral";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-kit";

export function Pricing() {
  const { dict } = useI18n();
  return (
    <section id="pricing" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow={dict.pricing.eyebrow}
          title={dict.pricing.title}
          sub={dict.pricing.sub}
          align="center"
        />

        <div className="mt-16 grid gap-4 lg:grid-cols-4">
          {dict.pricing.tiers.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 70}>
              <div
                className={cn(
                  "panel relative flex h-full flex-col rounded-2xl p-6",
                  tier.highlight && "border-emerald/50",
                )}
              >
                {tier.highlight && (
                  <>
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, var(--color-emerald), transparent)",
                      }}
                    />
                    <span className="telemetry absolute -top-2.5 left-6 rounded-full border border-emerald/40 bg-ink px-2.5 py-0.5 text-[9.5px] uppercase tracking-wider text-emerald">
                      {dict.pricing.popular}
                    </span>
                  </>
                )}

                <h3 className="text-[15px] font-medium text-text">{tier.name}</h3>
                <p className="mt-1 text-[12.5px] text-text-muted">{tier.blurb}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <BilingualNumeral
                    value={tier.price}
                    className="text-[2.2rem] font-medium text-text"
                  />
                  <span className="telemetry text-[12px] text-text-muted">
                    {dict.pricing.currency}
                  </span>
                  <span className="text-[12px] text-text-muted">{tier.cadence}</span>
                </div>

                <Button
                  variant={tier.highlight ? "primary" : "outline"}
                  size="sm"
                  href="#demo"
                  className="mt-5 w-full"
                >
                  {tier.cta}
                </Button>

                <ul className="mt-6 space-y-2.5 border-t border-hairline pt-6">
                  {tier.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          tier.highlight ? "text-emerald" : "text-text-muted",
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="text-[13px] text-text-secondary">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 text-center text-[12.5px] text-text-muted">{dict.pricing.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
