"use client";

const LOGOS = ["Cloudflare", "Supabase", "Sentry", "Meta Business", "Stripe", "CMI", "Resend"];

export function TrustStripSection() {
  return (
    <section className="py-16" style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <div className="flex flex-wrap items-center justify-center gap-8">
          {LOGOS.map((logo) => (
            <span
              key={logo}
              className="text-sm font-medium"
              style={{ color: "var(--ink-20)", fontFamily: "var(--font-sans-landing)" }}
            >
              {logo}
            </span>
          ))}
        </div>
        <p
          className="mx-auto mt-8 max-w-2xl text-center text-xs"
          style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)" }}
        >
          Audit logs on every state change. Webhook signatures verified. Backups encrypted. Health checks every 60 seconds.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
