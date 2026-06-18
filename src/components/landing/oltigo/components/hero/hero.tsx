"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BilingualNumeral } from "@/components/landing/oltigo/components/primitives/bilingual-numeral";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { ConsoleStatic } from "./console-static";

// The 3D console is client-only WebGL. Lazy-load it so three.js stays out of
// the shared bundle and never executes during SSR; the static console is both
// the loading state and the WebGL-unavailable fallback.
const Console3D = dynamic(() => import("./console-3d"), {
  ssr: false,
  loading: () => <ConsoleStatic />,
});

export function Hero() {
  const { dict } = useI18n();
  const [wide, setWide] = useState(false);
  const [focus, setFocus] = useState(-1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-hairline">
      {/* faint ruled grid + top vignette */}
      <div className="ruled-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 70% -10%, rgba(74,166,201,0.06), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-36">
        {/* Headline — LEFT */}
        <div className="max-w-xl">
          <Reveal>
            <span className="telemetry inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-secondary">
              <span className="size-1.5 rounded-full bg-emerald" />
              {dict.hero.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1
              className="mt-6 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.05] text-text"
              style={{ fontWeight: 500, letterSpacing: "-0.03em" }}
            >
              {dict.hero.titleLead}{" "}
              <span className="text-text-secondary">{dict.hero.titleAccent}</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-text-secondary sm:text-base">
              {dict.hero.sub}
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" href="#demo">
                {dict.hero.ctaPrimary}
                <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="lg" href="#features">
                {dict.hero.ctaSecondary}
              </Button>
            </div>
          </Reveal>

          {/* Trust strip */}
          <Reveal delay={260}>
            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-6 sm:grid-cols-4">
              <TrustItem
                value={<BilingualNumeral value={dict.hero.trust.uptime} />}
                label={dict.hero.trust.uptimeLabel}
              />
              <TrustItem value={<span className="telemetry">{dict.hero.trust.cipher}</span>} label="" />
              <TrustItem value={<span className="text-emerald">●</span>} label={dict.hero.trust.law} />
              <TrustItem
                value={<span className="telemetry">{dict.hero.trust.latency}</span>}
                label=""
              />
            </dl>
          </Reveal>
        </div>

        {/* Object — RIGHT */}
        <div className="relative">
          {wide ? <Console3D onFocus={setFocus} /> : <ConsoleStatic />}

          {/* Explode captions, synced to the focused layer */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <div className="relative h-6">
              {dict.hero.captions.map((cap, i) => (
                <span
                  key={i}
                  className="telemetry absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.22em] text-text-secondary transition-all duration-500"
                  style={{
                    opacity: focus === i ? 1 : 0,
                    transform: `translateX(-50%) translateY(${focus === i ? 0 : 6}px)`,
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustItem({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dd className="text-[15px] font-medium text-text">{value}</dd>
      {label ? (
        <dt className="text-[11px] leading-tight text-text-muted">{label}</dt>
      ) : null}
    </div>
  );
}
