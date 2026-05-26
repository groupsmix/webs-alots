"use client";

const PIPELINE = [
  { label: "Upload", mono: "multipart/form-data", icon: "↑" },
  { label: "Magic-byte", mono: "magic-byte OK", icon: "◎" },
  { label: "AES-256-GCM", mono: "IV: c8f3...e2a1", icon: "⬡" },
  { label: "Cloudflare R2", mono: "key: rotated 30d", icon: "☁" },
  { label: "Presigned URL", mono: "audit: logged", icon: "🔗" },
];

export function SecuritySection() {
  return (
    <section
      className="py-24 lg:py-32"
      style={{ backgroundColor: "var(--night-navy)", color: "var(--lab-linen)" }}
    >
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <h2
          className="mb-3"
          style={{
            fontFamily: "var(--font-sans-landing)",
            fontSize: "var(--text-h2)",
            fontWeight: 600,
          }}
        >
          Le dossier patient, chiffré. Et ça veut dire chiffré.
        </h2>
        <p className="mb-16" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "rgba(250,248,243,0.6)", direction: "rtl" }}>
          ملف المريض، مشفر. وهاد الشي كيعني مشفر فعلا.
        </p>

        {/* Pipeline diagram */}
        <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-2">
          {PIPELINE.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2 lg:gap-4">
              <div
                className="flex flex-col items-center gap-2 rounded-xl p-4"
                style={{ backgroundColor: "var(--night-navy-surface)", minWidth: 120 }}
              >
                <span className="text-2xl">{step.icon}</span>
                <span className="text-sm font-medium">{step.label}</span>
                <span
                  className="text-[10px]"
                  style={{ fontFamily: "var(--font-mono-landing)", color: "rgba(250,248,243,0.5)" }}
                >
                  {step.mono}
                </span>
              </div>
              {i < PIPELINE.length - 1 && (
                <span className="hidden text-lg lg:block" style={{ color: "rgba(250,248,243,0.3)" }}>→</span>
              )}
            </div>
          ))}
        </div>

        <p
          className="mx-auto mt-16 max-w-2xl text-center text-sm leading-relaxed"
          style={{ color: "rgba(250,248,243,0.7)" }}
        >
          Loi 09-08 marocaine. RLS Supabase. AES-256-GCM.
          Pas de données patients qui traversent une clinique vers une autre. Jamais.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
