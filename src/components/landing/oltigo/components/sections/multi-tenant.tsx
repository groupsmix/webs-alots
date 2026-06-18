"use client";

import { Database, Lock, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { SectionHeading } from "./section-kit";

/** The ONE section carrying the embossed zellige relief (<6% contrast). */
export function MultiTenant() {
  const { dict } = useI18n();
  return (
    <section className="relative overflow-hidden border-b border-hairline py-24 sm:py-32">
      {/* barely-visible monochrome zellige tessellation */}
      <div className="zellige-relief pointer-events-none absolute inset-0" aria-hidden />
      <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={dict.tenant.eyebrow} title={dict.tenant.title} sub={dict.tenant.sub} />

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {dict.tenant.subdomains.map((sd, i) => (
            <Reveal key={sd} delay={i * 90}>
              <div className="panel rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg border border-hairline bg-ink">
                    <Lock className="size-3.5 text-text-secondary" strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5">
                    <span className="size-1 rounded-full bg-emerald" />
                    <span className="telemetry text-[9.5px] uppercase tracking-wider text-emerald">
                      {dict.tenant.isolated}
                    </span>
                  </span>
                </div>
                <p className="telemetry mt-4 text-[12.5px] text-text">{sd}</p>
                <div className="mt-4 space-y-1.5">
                  {[70, 50, 60].map((w, j) => (
                    <span
                      key={j}
                      className="block h-1.5 rounded-full bg-surface-high"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* RLS bar */}
        <Reveal delay={120}>
          <div className="panel mt-4 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border border-cyan/30 bg-cyan/10">
                <Database className="size-4 text-cyan" strokeWidth={1.5} aria-hidden />
              </span>
              <div>
                <p className="telemetry text-[12px] uppercase tracking-[0.16em] text-text">
                  {dict.tenant.rlsTitle}
                </p>
                <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">
                  {dict.tenant.rlsBody}
                </p>
              </div>
            </div>
            <ShieldCheck className="hidden size-6 shrink-0 text-emerald sm:block" strokeWidth={1.25} aria-hidden />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
