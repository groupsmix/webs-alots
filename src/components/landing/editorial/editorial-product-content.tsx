"use client";

import { useState } from "react";
import { HairlineRule } from "./hairline-rule";

interface ProductSection {
  id: string;
  nav: string;
  title: string;
  items: readonly { heading: string; lines: readonly string[] }[];
  sla: string | null;
  note: string | null;
  rbac?: string;
}

const SECTIONS: readonly ProductSection[] = [
  {
    id: "appointments",
    nav: "01 \u2014 Rendez-vous",
    title: "Rendez-vous en ligne",
    items: [
      { heading: "Ce que le patient voit", lines: ["Calendrier disponible 24/7", "Confirmation instantan\u00E9e", "Rappel WhatsApp 24h avant", "Annulation en un clic", "Liste d\u2019attente automatique"] },
      { heading: "Ce que le bureau voit", lines: ["Tableau de bord temps r\u00E9el", "Drag-and-drop pour d\u00E9placer", "Vue jour / semaine / mois", "Filtres par m\u00E9decin, sp\u00E9cialit\u00E9", "No-show tracking"] },
    ],
    sla: "\u00E9criture < 200 ms p95",
    note: "Fonctionne sans connexion patient ; le r\u00E9ceptionniste peut saisir en cabinet.",
  },
  {
    id: "patients",
    nav: "02 \u2014 Dossier patient",
    title: "Dossier patient",
    items: [
      { heading: "Cycle de vie PHI", lines: ["Cr\u00E9ation", "\u00C9dition", "Export", "Suppression (droit \u00E0 l\u2019oubli)"] },
      { heading: "Permissions", lines: ["M\u00E9decin : lecture / \u00E9criture compl\u00E8te", "R\u00E9ception : lecture dossier, pas d\u2019ordonnances", "Patient : lecture de son propre dossier"] },
    ],
    sla: null,
    note: "Chiffrement AES-256-GCM par fichier, IV unique.",
  },
  {
    id: "whatsapp",
    nav: "03 \u2014 Rappels & WhatsApp",
    title: "Rappels & WhatsApp",
    items: [
      { heading: "Templates Darija", lines: ["Confirmation RDV", "Rappel 24h", "Rappel 1h", "Annulation patient", "Disponibilit\u00E9 cr\u00E9neau", "R\u00E9sultat labo", "Ordonnance pr\u00EAte", "Avis patient", "Bienvenue", "Suivi post-consultation"] },
    ],
    sla: null,
    note: "Fen\u00EAtre Meta de 24h respect\u00E9e. D\u00E9clenchement automatique ou manuel.",
  },
  {
    id: "billing",
    nav: "04 \u2014 Facturation",
    title: "Facturation & encaissement",
    items: [
      { heading: "Passerelles", lines: ["CMI (interban\u00ADcaire marocain)", "Stripe (international)"] },
      { heading: "Assurances", lines: ["CNSS", "CNOPS", "AMO", "RAMED"] },
    ],
    sla: null,
    note: null,
  },
  {
    id: "rbac",
    nav: "05 \u2014 R\u00F4les",
    title: "Multi-cabinets & r\u00F4les",
    items: [],
    sla: null,
    note: null,
    rbac: "super_admin > clinic_admin > receptionist > doctor > patient",
  } satisfies ProductSection,
  {
    id: "export",
    nav: "06 \u2014 Export",
    title: "Sauvegarde & exportation",
    items: [
      { heading: "Droit \u00E0 la portabilit\u00E9", lines: ["Sortie en CSV + PDF chiffr\u00E9", "Conserv\u00E9e 30 jours apr\u00E8s r\u00E9siliation", "Fr\u00E9quence : \u00E0 la demande ou planifi\u00E9e"] },
    ],
    sla: null,
    note: null,
  },
];

/**
 * Editorial product page \u2014 documentation-style.
 * Two columns: sticky left nav (200px) + right scroll-region.
 * Tables, not cards. Hairlines between rows. Code blocks for API endpoints.
 */
export function EditorialProductContent() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  return (
    <div style={{ backgroundColor: "var(--bone)", color: "var(--ink)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingTop: "var(--space-9)",
          paddingBottom: "var(--space-9)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <h1
          style={{
            fontSize: "var(--text-h1)",
            lineHeight: "var(--lh-h1)",
            letterSpacing: "var(--ls-h1)",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: "var(--space-7)",
          }}
        >
          {"Produit"}
        </h1>

        <div className="grid grid-cols-1 gap-[var(--space-8)] lg:grid-cols-[200px_1fr]">
          {/* Left: sticky nav */}
          <nav className="hidden lg:block" style={{ position: "sticky", top: "96px", alignSelf: "start" }}>
            <ul className="m-0 list-none space-y-[var(--space-3)] p-0">
              {SECTIONS.map(({ id, nav }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={() => setActiveSection(id)}
                    style={{
                      display: "block",
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      lineHeight: "var(--lh-mono)",
                      letterSpacing: "var(--ls-mono)",
                      color: activeSection === id ? "var(--oltigo-green)" : "var(--ink-60)",
                      textDecoration: "none",
                      transitionProperty: "color",
                      transitionDuration: "var(--duration)",
                    }}
                  >
                    {nav}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right: content */}
          <div>
            {SECTIONS.map(({ id, title, items, sla, note, rbac }) => (
              <section key={id} id={id} className="mb-[var(--space-9)]">
                <HairlineRule />
                <h2
                  className="mt-[var(--space-5)]"
                  style={{
                    fontSize: "var(--text-h2)",
                    lineHeight: "var(--lh-h2)",
                    letterSpacing: "var(--ls-h2)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {title}
                </h2>

                {sla && (
                  <p
                    className="mt-[var(--space-3)]"
                    style={{
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      lineHeight: "var(--lh-mono)",
                      letterSpacing: "var(--ls-mono)",
                      color: "var(--ink-60)",
                    }}
                  >
                    {`SLA: ${sla}`}
                  </p>
                )}

                {items.map(({ heading, lines }) => (
                  <div key={heading} className="mt-[var(--space-5)]">
                    <h3
                      style={{
                        fontSize: "var(--text-body)",
                        lineHeight: "var(--lh-body)",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {heading}
                    </h3>
                    <ul className="mt-[var(--space-2)] list-none space-y-[var(--space-1)] p-0">
                      {lines.map((line) => (
                        <li
                          key={line}
                          style={{
                            fontSize: "var(--text-body)",
                            lineHeight: "var(--lh-body)",
                            color: "var(--ink-70)",
                            paddingInlineStart: "var(--space-4)",
                          }}
                        >
                          {`\u2014 ${line}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {rbac && (
                  <div
                    className="mt-[var(--space-5)]"
                    style={{
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      lineHeight: 1.8,
                      letterSpacing: "var(--ls-mono)",
                      color: "var(--ink-60)",
                      backgroundColor: "rgba(11, 15, 14, 0.02)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                      padding: "var(--space-4)",
                    }}
                  >
                    {rbac}
                  </div>
                )}

                {note && (
                  <p
                    className="mt-[var(--space-3)]"
                    style={{
                      fontSize: "var(--text-small)",
                      lineHeight: "var(--lh-small)",
                      color: "var(--ink-60)",
                      fontStyle: "italic",
                    }}
                  >
                    {note}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </div>
  );
}
