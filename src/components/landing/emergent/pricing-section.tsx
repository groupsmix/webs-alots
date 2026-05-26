"use client";

import { SectionHeading } from "./section-heading";

const PLANS = [
  {
    name: "Cabinet",
    description: "Pour les médecins indépendants et les petits cabinets",
    price: "499",
    features: ["1 praticien", "Rendez-vous en ligne", "Rappels WhatsApp", "Dossiers patients chiffrés", "CNSS/CNOPS/AMO"],
    highlighted: false,
  },
  {
    name: "Clinique",
    description: "Multi-praticien, multi-spécialité",
    price: "1 290",
    features: ["Jusqu'à 8 praticiens", "Tout Cabinet +", "Tableau de bord avancé", "Gestion des rôles", "Facturation intégrée", "API personnalisée"],
    highlighted: true,
    badge: "Le plus choisi par les cabinets de 3-8 praticiens",
  },
  {
    name: "Réseau",
    description: "Chaînes de cliniques et pharmacies",
    price: "Sur devis",
    features: ["Praticiens illimités", "Tout Clinique +", "Multi-sites", "SSO / SAML", "SLA dédié", "Onboarding personnalisé"],
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <SectionHeading
          fr="Tarifs"
          ar="الأسعار"
        />

        <div className="grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-xl border p-8"
              style={{
                borderColor: plan.highlighted ? "var(--surgical-sage)" : "var(--rule)",
                backgroundColor: "var(--bone)",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
              }}
            >
              {plan.badge && (
                <p
                  className="mb-4 text-xs font-medium"
                  style={{ color: "var(--surgical-sage)" }}
                >
                  {plan.badge}
                </p>
              )}
              <h3 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>{plan.name}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-60)" }}>{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span
                  className="text-3xl font-bold"
                  style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}
                >
                  {plan.price}
                </span>
                {plan.price !== "Sur devis" && (
                  <span className="text-sm" style={{ color: "var(--ink-60)" }}>MAD/mois</span>
                )}
              </div>
              <ul className="mt-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-70)" }}>
                    <span style={{ color: "var(--surgical-sage)" }}>·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
