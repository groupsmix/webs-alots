"use client";

const STEPS = [
  {
    step: "01",
    title: "Créez votre compte",
    description:
      "Inscrivez votre cabinet en 2 minutes. Nous configurons votre sous-domaine sécurisé.",
  },
  {
    step: "02",
    title: "Configurez votre cabinet",
    description: "Ajoutez vos médecins, services, horaires et templates WhatsApp.",
  },
  {
    step: "03",
    title: "Accueillez vos patients",
    description: "Vos patients prennent rendez-vous en ligne. Rappels automatiques.",
  },
  {
    step: "04",
    title: "Suivez votre activité",
    description: "Tableau de bord analytique. Revenus, taux de no-show, satisfaction.",
  },
];

/**
 * §3.1.5 How it works — 4 numbered steps.
 * 4 columns desktop, 1 column mobile.
 * Each = mono "ÉTAPE 01" + h3 + 2 body lines. No icons, no illustration.
 */
export function HowItWorksSection() {
  return (
    <section className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step}>
              <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)]">
                Étape {s.step}
              </span>
              <h3 className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-h3)] leading-[var(--lh-h3)] tracking-[var(--ls-h3)] font-medium text-[var(--ink)]">
                {s.title}
              </h3>
              <p className="mt-[var(--space-2)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
                {s.description}
              </p>
            </div>
          ))}
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
