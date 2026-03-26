import {
  UserPlus,
  Settings,
  Share2,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const steps: readonly { number: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    number: "01",
    icon: UserPlus,
    title: "Cr\u00e9ez votre compte",
    description: "Inscrivez-vous en quelques secondes et configurez votre cabinet.",
  },
  {
    number: "02",
    icon: Settings,
    title: "Ajoutez vos services",
    description: "D\u00e9finissez vos consultations, tarifs et horaires de travail.",
  },
  {
    number: "03",
    icon: Share2,
    title: "Partagez votre lien",
    description: "Envoyez votre lien unique \u00e0 vos patients pour r\u00e9server.",
  },
  {
    number: "04",
    icon: CalendarCheck,
    title: "Recevez des rendez-vous",
    description: "Les patients r\u00e9servent en ligne, vous g\u00e9rez tout depuis votre tableau de bord.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="comment-ca-marche" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Simple et rapide
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Comment &ccedil;a marche
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Lancez votre pr&eacute;sence en ligne en 4&nbsp;&eacute;tapes simples.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, description, icon: Icon }, idx) => (
            <div key={number} className="relative text-center">
              {/* Connector line (hidden on first item and on mobile) */}
              {idx > 0 && (
                <div className="pointer-events-none absolute -left-4 top-7 hidden h-px w-8 bg-gray-200 lg:block" />
              )}

              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-gray-100">
                <Icon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-600">
                &Eacute;tape {number}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
