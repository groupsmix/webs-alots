"use client";

import { SectionHeading } from "./section-heading";

const PILLARS = [
  {
    title: "Fuseau Africa/Casablanca",
    titleAr: "توقيت أفريقيا/الدار البيضاء",
    body: "Aucune confusion d'horaire. Aucun rendez-vous décalé d'une heure.",
  },
  {
    title: "Bilingue de naissance",
    titleAr: "ثنائي اللغة منذ البداية",
    body: "Le français et l'arabe ont les mêmes droits d'affichage. La darija vit dans WhatsApp.",
  },
  {
    title: "Conforme Loi 09-08",
    titleAr: "متوافق مع القانون 09-08",
    body: "Hébergement, chiffrement, et audit pensés pour le cadre marocain de protection des données.",
  },
];

export function ManifestoSection() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        { }
        <SectionHeading
          fr="Pensé pour le Maroc. Pas adapté au Maroc."
          ar="مصمم للمغرب. ماشي معدّل للمغرب."
        />

        <div className="grid gap-8 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border p-8" style={{ borderColor: "var(--rule)", backgroundColor: "var(--bone)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)" }}>
              <h3 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>{p.title}</h3>
              <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-arabic)", color: "var(--ink-60)", direction: "rtl" }}>
                {p.titleAr}
              </p>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-70)" }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
        { }
      </div>
    </section>
  );
}
