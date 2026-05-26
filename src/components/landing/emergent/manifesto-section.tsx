"use client";

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
        {/* eslint-disable i18next/no-literal-string */}
        <h2
          className="mb-3"
          style={{ fontFamily: "var(--font-sans-landing)", fontSize: "var(--text-h2)", fontWeight: 600, color: "var(--ink)" }}
        >
          Pensé pour le Maroc. Pas adapté au Maroc.
        </h2>
        <p className="mb-16" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "var(--ink-60)", direction: "rtl" }}>
          مصمم للمغرب. ماشي معدّل للمغرب.
        </p>

        <div className="grid gap-8 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border p-8" style={{ borderColor: "var(--rule)", backgroundColor: "white" }}>
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
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
