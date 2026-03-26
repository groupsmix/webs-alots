import {
  UserPlus,
  Settings,
  Share2,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const steps: readonly {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    number: "01",
    icon: UserPlus,
    title: "Cr\u00e9ez votre compte",
    description:
      "Inscrivez-vous en quelques secondes et configurez votre cabinet.",
  },
  {
    number: "02",
    icon: Settings,
    title: "Ajoutez vos services",
    description:
      "D\u00e9finissez vos consultations, tarifs et horaires de travail.",
  },
  {
    number: "03",
    icon: Share2,
    title: "Partagez votre lien",
    description:
      "Envoyez votre lien unique \u00e0 vos patients pour r\u00e9server.",
  },
  {
    number: "04",
    icon: CalendarCheck,
    title: "Recevez des rendez-vous",
    description:
      "Les patients r\u00e9servent en ligne, vous g\u00e9rez tout depuis votre tableau de bord.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="comment-ca-marche"
      className="relative bg-gray-950 py-24 sm:py-32"
    >
      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-400">
            Simple et rapide
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.15]">
            Comment &ccedil;a marche
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-gray-400">
            Lancez votre pr&eacute;sence en ligne en 4&nbsp;&eacute;tapes
            simples.
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, description, icon: Icon }) => (
            <div
              key={number}
              className="relative bg-gray-950 p-8 text-center lg:p-10"
            >
              <div className="mb-6 text-[13px] font-bold tabular-nums tracking-widest text-white/20">
                {number}
              </div>
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                <Icon className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white">{title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-gray-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
