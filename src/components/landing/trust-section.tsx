import {
  CalendarCheck,
  Users,
  Globe,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const items: readonly { icon: LucideIcon; label: string; detail: string }[] = [
  {
    icon: CalendarCheck,
    label: "Rendez-vous",
    detail: "Gestion intelligente",
  },
  {
    icon: Users,
    label: "Patients",
    detail: "Suivi centralis\u00e9",
  },
  {
    icon: Globe,
    label: "Site web",
    detail: "Cl\u00e9 en main",
  },
  {
    icon: ShieldCheck,
    label: "S\u00e9curit\u00e9",
    detail: "Donn\u00e9es prot\u00e9g\u00e9es",
  },
];

export function TrustSection() {
  return (
    <section className="border-y border-gray-950/[0.04] bg-gray-50/60 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-12 lg:gap-16">
          <p className="shrink-0 text-[13px] font-medium uppercase tracking-wider text-gray-400">
            Tout-en-un
          </p>
          <div className="h-px w-12 bg-gray-200 sm:h-8 sm:w-px" />
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:flex sm:gap-12 lg:gap-16">
            {items.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="h-[18px] w-[18px] shrink-0 text-gray-400" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {label}
                  </div>
                  <div className="text-[12px] text-gray-400">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
