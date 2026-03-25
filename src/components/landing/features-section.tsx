import {
  CalendarDays,
  ClipboardList,
  MonitorSmartphone,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: CalendarDays,
    title: "Gestion des rendez-vous",
    description:
      "Planifiez, confirmez et suivez tous vos rendez-vous depuis une seule interface simple et intuitive.",
  },
  {
    icon: ClipboardList,
    title: "Gestion des patients",
    description:
      "Dossiers patients complets, historique des visites et suivi médical centralisé et sécurisé.",
  },
  {
    icon: MonitorSmartphone,
    title: "Site web du cabinet",
    description:
      "Un site professionnel prêt à l'emploi pour votre cabinet, accessible sur mobile et ordinateur.",
  },
  {
    icon: Zap,
    title: "Automatisation intelligente",
    description:
      "Rappels automatiques, notifications et gestion de la liste d'attente pour gagner du temps.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Tout ce dont votre cabinet a besoin
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Des outils simples et puissants pour vous concentrer sur
            l&apos;essentiel : vos patients.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-gray-100 bg-white p-8 transition-all hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors group-hover:bg-blue-600">
                <Icon className="h-5 w-5" />
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
