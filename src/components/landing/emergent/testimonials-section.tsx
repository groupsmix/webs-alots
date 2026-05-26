"use client";

const TESTIMONIALS = [
  {
    quote: "On a divisé les appels téléphoniques pour rendez-vous par quatre. Mes patients réservent à 22h, dimanche compris. Et personne ne m'appelle pour confirmer.",
    author: "Dr. K. Bennani, Cardiologue, Casablanca",
    note: "14 ans d'exercice",
  },
  {
    quote: "Avant Oltigo, je passais une heure chaque matin à rappeler les patients. Maintenant, WhatsApp le fait pour moi en darija. Les no-shows ont baissé de 60 %.",
    author: "Réceptionniste, Cabinet Dentaire, Rabat-Agdal",
    note: "23 réceptionnistes Oltigo en 2026",
  },
  {
    quote: "Je cherchais un système où les dossiers restent dans ma pharmacie, pas dans un cloud américain. Le chiffrement AES-256-GCM et l'hébergement Cloudflare m'ont convaincu.",
    author: "Pharmacien titulaire, Pharmacie de quartier, Tanger",
    note: "",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <h2
          className="mb-16 text-center"
          style={{ fontFamily: "var(--font-sans-landing)", fontSize: "var(--text-h2)", fontWeight: 600, color: "var(--ink)" }}
        >
          Ce qu&apos;ils en disent.
        </h2>

        <div className="grid gap-8 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="rounded-xl border p-8" style={{ borderColor: "var(--rule)", backgroundColor: "var(--bone)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)" }}>
              <p className="text-sm leading-relaxed italic" style={{ color: "var(--ink-70)" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6">
                <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>— {t.author}</p>
                {t.note && (
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-60)" }}>{t.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
