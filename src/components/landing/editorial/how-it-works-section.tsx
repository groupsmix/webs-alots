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
    description:
      "Ajoutez vos médecins, services, horaires et templates WhatsApp.",
  },
  {
    step: "03",
    title: "Accueillez vos patients",
    description:
      "Vos patients prennent rendez-vous en ligne. Rappels automatiques.",
  },
  {
    step: "04",
    title: "Suivez votre activité",
    description:
      "Tableau de bord analytique. Revenus, taux de no-show, satisfaction.",
  },
];

/**
 * §3.1.5 How it works — 4 numbered steps.
 * 4 columns desktop, 1 column mobile.
 * Each = mono "ÉTAPE 01" + h3 + 2 body lines. No icons, no illustration.
 */
export function HowItWorksSection() {
  return (
    <section
      style={{
        backgroundColor: "var(--bone)",
        paddingBlock: "var(--space-9)",
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step}>
              <span
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  color: "var(--ink-60)",
                }}
              >
                Étape {s.step}
              </span>
              <h3
                style={{
                  marginTop: "var(--space-3)",
                  fontFamily: "var(--font-sans-landing)",
                  fontSize: "var(--text-h3)",
                  lineHeight: "var(--lh-h3)",
                  letterSpacing: "var(--ls-h3)",
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  marginTop: "var(--space-2)",
                  fontFamily: "var(--font-sans-landing)",
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--ink-70)",
                }}
              >
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
