"use client";

const TEMPLATES = [
  { label: "Rappel de rendez-vous (24h)", msg: "سلام، هاد تذكير بموعيدك غدا ف Cabinet Dr. Bennani، 10h30. الله يسهل." },
  { label: "Confirmation de rendez-vous", msg: "سلام، تسجيلك ف Cabinet Dr. Bennani تأكد. موعيد: الخميس 18 أبريل، 10h30. باش تلغي، كتبي 1." },
  { label: "Annulation par le cabinet", msg: "سلام، معذرة، موعيدك ف Cabinet Dr. Bennani يوم الخميس تلغى. عافاك اتصل بينا باش نبدلو الوقت." },
  { label: "Ordonnance prête", msg: "سلام، الوصفة ديالك جاهزة ف Pharmacie Atlas. تقدر تجي تاخدها من 8h حتى 20h." },
  { label: "Résultat d'analyse", msg: "سلام، نتائج التحاليل ديالك جاهزة. تقدر تشوفهم ف الحساب ديالك أو تجي للعيادة." },
  { label: "Rappel de paiement", msg: "سلام، عندك دفعة فايتة ف Cabinet Dr. Bennani بقيمة 350 MAD. عافاك خلص أونلاين أو ف الاستقبال." },
  { label: "Anniversaire / suivi annuel", msg: "سلام، عام سعيد! كتقترح عليك عيادة Dr. Bennani فحص سنوي. ابدأ الحجز من الموقع." },
  { label: "Vaccin enfant — rappel", msg: "سلام، هاد تذكير بالتلقيح ديال ولدك/بنتك. عافاك حجز موعد ف Centre Médical Souissi." },
];

export function WhatsAppSection() {
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
          Les rappels en darija. Parce que vos patients lisent en darija.
        </h2>
        <p className="mb-16" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "var(--ink-60)", direction: "rtl" }}>
          التذكيرات بالدارجة. حيت المرضى كيقراو بالدارجة.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <div key={t.label} className="space-y-2">
              <p className="text-xs font-medium" style={{ color: "var(--ink-60)", fontFamily: "var(--font-sans-landing)" }}>
                {t.label}
              </p>
              <div
                className="relative rounded-xl rounded-tl-sm p-3"
                style={{ backgroundColor: "#DCF8C6" }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#303030", direction: "rtl", fontFamily: "var(--font-arabic)" }}
                >
                  {t.msg}
                </p>
                <p className="mt-1 text-right text-[10px]" style={{ color: "#6B7B6B" }}>
                  10:32 ✓✓
                </p>
              </div>
            </div>
          ))}
        </div>

        <p
          className="mt-12 text-center text-sm"
          style={{
            fontFamily: "var(--font-mono-landing)",
            color: "var(--ink-60)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          10 modèles approuvés par Meta. Validation Meta Business API gérée par Oltigo.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
