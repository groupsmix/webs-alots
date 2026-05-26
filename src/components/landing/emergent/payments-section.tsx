"use client";

export function PaymentsSection() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
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
            color: "var(--ink)",
          }}
        >
          Les paiements, sans surprise.
        </h2>
        <p className="mb-16" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "var(--ink-60)", direction: "rtl" }}>
          الدفع، بلا مفاجآت.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* CMI */}
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--rule)", backgroundColor: "white" }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: "var(--reassurance-teal)", color: "white" }}>
                CMI
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Centre Monétique Interbancaire</p>
                <p className="text-xs" style={{ color: "var(--ink-60)" }}>Paiement local · MAD</p>
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: "var(--lab-linen)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--ink-70)" }}>Consultation cardiologie</span>
                <span style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>350,00 MAD</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--ink-70)" }}>ECG</span>
                <span style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>200,00 MAD</span>
              </div>
              <div className="mt-3 border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--rule)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Total</span>
                <span className="font-semibold" style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>550,00 MAD</span>
              </div>
            </div>
          </div>

          {/* Stripe */}
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--rule)", backgroundColor: "white" }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: "#635BFF", color: "white" }}>
                S
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Stripe</p>
                <p className="text-xs" style={{ color: "var(--ink-60)" }}>Paiement international · Multi-devises</p>
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: "var(--lab-linen)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--ink-70)" }}>Dental cleaning</span>
                <span style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>450,00 MAD</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--ink-70)" }}>X-Ray</span>
                <span style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>300,00 MAD</span>
              </div>
              <div className="mt-3 border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--rule)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Total</span>
                <span className="font-semibold" style={{ fontFamily: "var(--font-mono-landing)", color: "var(--graphite)", fontVariantNumeric: "tabular-nums" }}>750,00 MAD</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-sm" style={{ color: "var(--ink-60)" }}>
          Paiement en ligne avant le rendez-vous. Ou à la réception. Ou en différé. La clinique choisit.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
