"use client";

import { useState } from "react";
import { SectionHeading } from "./section-heading";

const FAQS = [
  {
    q: "Mes données sont-elles partagées avec d'autres cliniques ?",
    qAr: "هل بياناتي مشتركة مع عيادات أخرى؟",
    a: "Non. Jamais. C'est techniquement impossible : RLS au niveau base de données + scoping applicatif. Si vous voulez les détails, on a écrit un livre blanc.",
  },
  {
    q: "Et si Oltigo disparaît demain ?",
    qAr: "وإلا Oltigo ختفات غدا؟",
    a: "Vos données sont les vôtres. Export complet en un clic. SQL, CSV, ou format FHIR si vous le voulez.",
  },
  {
    q: "Pourquoi pas une app mobile ?",
    qAr: "علاش ماكاينش تطبيق موبايل؟",
    a: "Parce que les patients réservent sur le site de votre clinique, et reçoivent les rappels sur WhatsApp. Une app de plus dans leur téléphone, personne n'en a besoin.",
  },
  {
    q: "Est-ce conforme à la Loi 09-08 ?",
    qAr: "هل متوافق مع القانون 09-08؟",
    a: "Oui. Hébergement sur Cloudflare (edge Casablanca), chiffrement AES-256-GCM, audit logs immutables, isolation RLS par clinique. Le détail est dans notre DPIA.",
  },
  {
    q: "Combien de temps pour intégrer ma clinique ?",
    qAr: "شحال من وقت باش نبدأ؟",
    a: "Entre 24h et 72h selon la taille de votre cabinet. On importe vos patients existants, on configure votre planning, et on forme votre réceptionniste en une session.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: 800 }}
      >
        { }
        <SectionHeading
          fr="Questions fréquentes"
          ar="أسئلة شائعة"
        />

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--rule)", backgroundColor: "var(--bone)" }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{faq.q}</span>
                  <span className="ml-3 text-sm" style={{ fontFamily: "var(--font-arabic)", color: "var(--ink-60)" }}>
                    {faq.qAr}
                  </span>
                </div>
                <span
                  className="ml-4 flex-shrink-0 text-lg transition-transform duration-200"
                  style={{ color: "var(--ink-60)", transform: open === i ? "rotate(45deg)" : "rotate(0)" }}
                >
                  +
                </span>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: open === i ? 200 : 0, opacity: open === i ? 1 : 0 }}
              >
                <p className="px-6 pb-4 text-sm leading-relaxed" style={{ color: "var(--ink-70)" }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
        { }
      </div>
    </section>
  );
}
