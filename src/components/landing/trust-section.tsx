import {
  CalendarCheck,
  Users,
  Globe,
  ShieldCheck,
} from "lucide-react";

const items = [
  { icon: CalendarCheck, label: "Gestion intelligente des rendez-vous" },
  { icon: Users, label: "Suivi des patients" },
  { icon: Globe, label: "Site professionnel pour votre cabinet" },
  { icon: ShieldCheck, label: "Sécurité des données" },
] as const;

export function TrustSection() {
  return (
    <section className="border-y border-gray-100 bg-gray-50/50 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-sm font-medium uppercase tracking-wide text-gray-500">
          Utilisé par des médecins et cabinets pour gérer leurs rendez-vous
          efficacement
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <Icon className="h-5 w-5 text-gray-700" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
