"use client";

import Link from "next/link";

const COLS = [
  {
    title: "Produit",
    titleAr: "المنتج",
    links: [
      { label: "Rendez-vous en ligne", href: "/book" },
      { label: "Rappels WhatsApp", href: "/services" },
      { label: "Dossiers patients", href: "/services" },
      { label: "Tarifs", href: "/pricing" },
    ],
  },
  {
    title: "Entreprise",
    titleAr: "الشركة",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
      { label: "Carrières", href: "/contact" },
    ],
  },
  {
    title: "Juridique",
    titleAr: "القانون",
    links: [
      { label: "Conditions d'utilisation", href: "/terms" },
      { label: "Politique de confidentialité", href: "/privacy" },
      { label: "Accessibilité", href: "/accessibility" },
      { label: "Conformité Loi 09-08", href: "/privacy" },
    ],
  },
  {
    title: "Ressources",
    titleAr: "الموارد",
    links: [
      { label: "Documentation", href: "/how-to-book" },
      { label: "API", href: "/contact" },
      { label: "Statut", href: "/contact" },
      { label: "Sécurité", href: "/privacy" },
    ],
  },
];

export function EmergentFooter() {
  return (
    <footer className="py-16" style={{ backgroundColor: "var(--bone)", borderTop: "1px solid var(--rule)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{col.title}</h4>
              <p className="mt-0.5 text-xs" style={{ fontFamily: "var(--font-arabic)", color: "var(--ink-60)", direction: "rtl" }}>
                {col.titleAr}
              </p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:underline"
                      style={{ color: "var(--ink-60)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t pt-8" style={{ borderColor: "var(--rule)" }}>
          <p
            className="text-center text-xs"
            style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)" }}
          >
            Conçu pour la médecine marocaine. Déployé à la périphérie. Loi 09-08 conforme. &copy; Oltigo Health.
          </p>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </footer>
  );
}
