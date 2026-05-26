"use client";

import { useState } from "react";
import { SectionHeading } from "./section-heading";

const ROLES = [
  { key: "super_admin", label: "Super Admin", description: "Opérateur de la plateforme", perms: ["Gestion globale", "Configuration système", "Audit complet"] },
  { key: "clinic_admin", label: "Clinic Admin", description: "Propriétaire de cabinet", perms: ["Gestion des praticiens", "Facturation", "Statistiques", "Configuration"] },
  { key: "receptionist", label: "Réceptionniste", description: "Chef d'orchestre", perms: ["Rendez-vous", "Accueil patients", "Appels", "WhatsApp"] },
  { key: "doctor", label: "Médecin", description: "Voit ses patients", perms: ["Consultations", "Ordonnances", "Dossiers patients", "Résultats"] },
  { key: "patient", label: "Patient", description: "Voit son propre dossier", perms: ["Ses rendez-vous", "Ses ordonnances", "Ses résultats"] },
];

export function RbacSection() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <SectionHeading
          fr="Cinq rôles. Une seule cohérence."
          ar="خمسة أدوار. تماسك واحد."
        />

        <div className="flex flex-wrap items-start justify-center gap-8">
          {ROLES.map((role, i) => (
            <div // eslint-disable-line jsx-a11y/no-static-element-interactions
              key={role.key}
              className="group flex cursor-default flex-col items-center"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {/* Avatar */}
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold transition-opacity duration-300"
                style={{
                  backgroundColor: "var(--bone-2)",
                  color: "var(--graphite)",
                  opacity: active !== null && active !== i ? 0.4 : 1,
                }}
              >
                {role.label[0]}
              </div>
              <p className="mt-2 text-center text-xs font-medium" style={{ color: "var(--ink)" }}>
                {role.label}
              </p>
              <p className="text-center text-[10px]" style={{ color: "var(--ink-60)" }}>
                {role.description}
              </p>

              {/* Permission card on hover */}
              <div
                className="mt-2 overflow-hidden rounded-lg border transition-all duration-300"
                style={{
                  maxHeight: active === i ? 200 : 0,
                  opacity: active === i ? 1 : 0,
                  borderColor: "var(--rule)",
                  backgroundColor: "var(--bone)",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
                  minWidth: 140,
                }}
              >
                <div className="p-3">
                  {role.perms.map((p) => (
                    <p key={p} className="text-[11px]" style={{ color: "var(--ink-70)" }}>
                      · {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Connection line */}
        <div className="mx-auto mt-8 hidden h-px lg:block" style={{ backgroundColor: "var(--rule)", maxWidth: 600 }} />
        <p className="mt-6 text-center text-sm" style={{ color: "var(--ink-60)" }}>
          Chaque rôle voit exactement ce qu&apos;il doit voir. Ni plus, ni moins.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
