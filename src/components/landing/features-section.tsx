import {
  CalendarDays,
  ClipboardList,
  MonitorSmartphone,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: readonly {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}[] = [
  {
    icon: CalendarDays,
    title: "Gestion des rendez-vous",
    description:
      "Planifiez, confirmez et suivez tous vos rendez-vous depuis une seule interface intuitive.",
    accent: "bg-blue-50 text-blue-600",
  },
  {
    icon: ClipboardList,
    title: "Gestion des patients",
    description:
      "Dossiers patients complets, historique des visites et suivi m\u00e9dical centralis\u00e9.",
    accent: "bg-violet-50 text-violet-600",
  },
  {
    icon: MonitorSmartphone,
    title: "Site web du cabinet",
    description:
      "Un site professionnel pr\u00eat \u00e0 l\u2019emploi, accessible sur mobile et ordinateur.",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Zap,
    title: "Automatisation intelligente",
    description:
      "Rappels automatiques, notifications et gestion de la liste d\u2019attente.",
    accent: "bg-amber-50 text-amber-600",
  },
];

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600">
            Fonctionnalit&eacute;s
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-[2.5rem] sm:leading-[1.15]">
            Tout ce dont votre cabinet a besoin
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-gray-500">
            Des outils simples et puissants pour vous concentrer sur
            l&apos;essentiel&nbsp;: vos patients.
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description, accent }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-gray-100 bg-white p-8 transition-all duration-200 hover:border-gray-200/80 hover:shadow-xl hover:shadow-gray-950/[0.04] sm:p-10"
            >
              <div
                className={`mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-[17px] font-semibold text-gray-900">
                {title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-gray-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
