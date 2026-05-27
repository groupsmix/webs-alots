"use client";

/**
 * §3.1.3 — "What it is, in 5 lines."
 * Single column, max-width 720px, left-aligned. No imagery.
 */
export function ManifestoSection() {
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
        <div style={{ maxWidth: 720 }}>
          <h2
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-h1)",
              lineHeight: "var(--lh-h1)",
              letterSpacing: "var(--ls-h1)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Tout ce dont votre cabinet a besoin.
          </h2>

          <p
            style={{
              marginTop: "var(--space-5)",
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink-70)",
            }}
          >
            Des outils simples et puissants pour vous concentrer sur
            l&apos;essentiel&nbsp;: vos patients.
          </p>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
