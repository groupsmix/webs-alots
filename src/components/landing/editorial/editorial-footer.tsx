"use client";

import Link from "next/link";
import { HairlineRule } from "./hairline-rule";

const COLUMNS = [
  {
    heading: "Produit",
    links: [
      { label: "Rendez-vous", href: "#product" },
      { label: "Dossier patient", href: "#product" },
      { label: "WhatsApp", href: "#product" },
      { label: "Facturation", href: "#product" },
    ],
  },
  {
    heading: "Ressources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Statut", href: "/status" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Entreprise",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Carrières", href: "/careers" },
    ],
  },
  {
    heading: "Légal",
    links: [
      { label: "Conditions", href: "/terms" },
      { label: "Confidentialité", href: "/privacy" },
      { label: "DPA", href: "/dpa" },
      { label: "Loi 09-08", href: "/compliance" },
    ],
  },
];

/**
 * §5.6 Footer — top 1px rule. 5-column grid.
 * Column heading --text-small/500/--ink. Links --text-body/400/--ink-70.
 * Bottom row --text-mono/--ink-60. No social icons in body.
 */
export function EditorialFooter() {
  return (
    <footer className="bg-[var(--bone)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <HairlineRule />

        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 py-[var(--space-8)]">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link
              href="/"
              className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-bold tracking-[-0.02em] text-[var(--ink)] no-underline"
            >
              oltig<span style={{ color: "var(--oltigo-green)" }}>o</span>
            </Link>
            <p className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)] max-w-[240px]">
              La plateforme complète pour gérer votre cabinet médical au Maroc.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <span className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink)]">
                {col.heading}
              </span>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)] no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <HairlineRule />

        {/* Bottom row */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          <span>© {new Date().getFullYear()} Oltigo Health. Tous droits réservés.</span>
          <span>X · LinkedIn · GitHub</span>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </footer>
  );
}
