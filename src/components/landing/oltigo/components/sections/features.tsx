"use client";

import { Check } from "lucide-react";
import {
  AgendaFace,
  DossierFace,
  WhatsappFace,
} from "@/components/landing/oltigo/components/hero/faces";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { SectionHeading } from "./section-kit";

export function Features() {
  const { dict } = useI18n();
  const visuals = [<AgendaFace key="a" />, <DossierFace key="d" />, <WhatsappFace key="w" />];

  return (
    <section id="features" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow={dict.featuresHeading.eyebrow}
          title={dict.featuresHeading.title}
          sub={dict.featuresHeading.sub}
        />

        <div className="mt-20 space-y-24 sm:space-y-32">
          {dict.features.map((f, i) => (
            <FeatureRow key={f.num} feature={f} visual={visuals[i]} reversed={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  feature,
  visual,
  reversed,
}: {
  feature: { num: string; title: string; tagline: string; bullets: string[] };
  visual: React.ReactNode;
  reversed: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      {/* copy */}
      <div className={reversed ? "lg:order-2" : ""}>
        <Reveal>
          <div className="flex items-baseline gap-3">
            <span className="telemetry text-[13px] text-emerald/70">{feature.num}</span>
            <span className="h-px w-10 bg-hairline" />
          </div>
        </Reveal>
        <Reveal delay={60}>
          <h3 className="mt-4 text-2xl text-text sm:text-[1.75rem]">{feature.title}</h3>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
            {feature.tagline}
          </p>
        </Reveal>
        <ul className="mt-7 space-y-3">
          {feature.bullets.map((b, i) => (
            <Reveal key={i} delay={160 + i * 50} as="li">
              <span className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-emerald"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="text-[14.5px] text-text-secondary">{b}</span>
              </span>
            </Reveal>
          ))}
        </ul>
      </div>

      {/* visual */}
      <div className={reversed ? "lg:order-1" : ""}>
        <Reveal delay={80}>
          <div className="blueprint-grid relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface/40 p-8">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 50% 0%, rgba(255,255,255,0.03), transparent 60%)",
              }}
            />
            <div style={{ transform: "scale(1.05)" }}>{visual}</div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
