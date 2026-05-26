"use client";

import { useState } from "react";
import { SectionHeading } from "./section-heading";

const CLINICS = [
  { domain: "bennani.clinic.oltigo.com", name: "Cabinet Dr. Bennani", specialty: "Cardiologie", colors: { bg: "#1B2D45", text: "#F5F0E8", accent: "#F5F0E8" } },
  { domain: "tazi-dental.clinic.oltigo.com", name: "Cabinet Dentaire Tazi", specialty: "Dentisterie", colors: { bg: "#FFFFFF", text: "#1A1D21", accent: "#6BB89C" } },
  { domain: "andalous.clinic.oltigo.com", name: "Clinique El Andalous", specialty: "Médecine Générale", colors: { bg: "#FDF5EE", text: "#1A1D21", accent: "#C4734A" } },
  { domain: "pharmacie-atlas.clinic.oltigo.com", name: "Pharmacie Atlas", specialty: "Pharmacie", colors: { bg: "#F0FAF0", text: "#1A1D21", accent: "#2D8A4E" } },
  { domain: "centre-souissi.clinic.oltigo.com", name: "Centre Médical Souissi", specialty: "Polyclinique", colors: { bg: "#1A1F36", text: "#F6F4EE", accent: "#C9A94E" } },
  { domain: "dr-amrani.clinic.oltigo.com", name: "Dr. Amrani", specialty: "Pédiatrie", colors: { bg: "#FFF5F5", text: "#1A1D21", accent: "#B48EAD" } },
];

export function MultiTenantSection() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        <SectionHeading
          fr="Une plateforme. L'identité de chaque clinique."
          ar="منصة واحدة. هوية كل عيادة."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CLINICS.map((c, i) => {
            const isDark = c.colors.bg === "#1B2D45" || c.colors.bg === "#1A1F36";
            return (
              <div // eslint-disable-line jsx-a11y/no-static-element-interactions
                key={c.domain}
                className="group relative cursor-default overflow-hidden rounded-xl border transition-all duration-300"
                style={{
                  borderColor: "var(--rule)",
                  transform: hovered === i ? "translateY(-8px)" : "translateY(0)",
                  boxShadow: hovered === i
                    ? "inset 0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)"
                    : "inset 0 2px 4px rgba(0,0,0,0.04)",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Browser mockup */}
                <div
                  className="rounded-t-xl p-5 pb-8"
                  style={{ backgroundColor: c.colors.bg, minHeight: 160 }}
                >
                  <div className="mb-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-300" />
                    <span className="h-2 w-2 rounded-full bg-yellow-300" />
                    <span className="h-2 w-2 rounded-full bg-green-300" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: c.colors.accent, color: isDark ? "#fff" : c.colors.bg }}
                    >
                      {c.name[0]}
                    </div>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: c.colors.text }}
                    >
                      {c.name}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                  >
                    {c.specialty}
                  </p>
                </div>

                {/* URL bar on hover */}
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: hovered === i ? 48 : 0,
                    opacity: hovered === i ? 1 : 0,
                    backgroundColor: "var(--bone)",
                  }}
                >
                  <div className="px-4 py-2">
                    <p
                      className="text-[10px]"
                      style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)" }}
                    >
                      { }
                      {c.domain}
                    </p>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <p className="mt-0.5 text-[9px]" style={{ color: "var(--reassurance-teal)" }}>
                      Domaine personnalisé · Hébergé sur Cloudflare · Données isolées par RLS
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* eslint-disable i18next/no-literal-string */}
        <p
          className="mt-12 text-center"
          style={{
            fontFamily: "var(--font-sans-landing)",
            fontSize: "var(--text-body)",
            color: "var(--ink-60)",
            lineHeight: "var(--lh-body)",
          }}
        >
          Une plateforme. L&apos;identité de chaque clinique. Les données de chaque clinique, jamais mélangées.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
