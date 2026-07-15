import { ArrowRight, CalendarDays, CircleDollarSign, Stethoscope, UserPlus } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { MOROCCO_LOCALE_MAP } from "@/lib/utils";

interface OwnerDashboardHeaderProps {
  locale: Locale;
  ownerName?: string | null;
  today: string;
}

export function OwnerDashboardHeader({ locale, ownerName, today }: OwnerDashboardHeaderProps) {
  const todayLabel = new Intl.DateTimeFormat(MOROCCO_LOCALE_MAP[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${today}T12:00:00`));

  const quickActions = [
    {
      href: "/admin/patients",
      label: t(locale, "admin.owner.addPatient"),
      description: t(locale, "admin.owner.addPatientDesc"),
      icon: UserPlus,
    },
    {
      href: "/admin/doctors",
      label: t(locale, "admin.owner.manageTeam"),
      description: t(locale, "admin.owner.manageTeamDesc"),
      icon: Stethoscope,
    },
    {
      href: "/admin/financial-summary",
      label: t(locale, "admin.owner.viewFinances"),
      description: t(locale, "admin.owner.viewFinancesDesc"),
      icon: CircleDollarSign,
    },
    {
      href: "/admin/agenda",
      label: t(locale, "admin.owner.viewAgenda"),
      description: t(locale, "admin.owner.viewAgendaDesc"),
      icon: CalendarDays,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#00734d] p-5 text-primary-foreground shadow-sm sm:p-7">
      <p className="text-sm font-medium capitalize text-primary-foreground/75">{todayLabel}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {t(locale, "admin.owner.greeting", {
          name: ownerName?.trim() || t(locale, "admin.owner.defaultName"),
        })}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
        {t(locale, "admin.owner.subtitle")}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
              <action.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{action.label}</span>
              <span className="block truncate text-xs text-primary-foreground/70">
                {action.description}
              </span>
            </span>
            <ArrowRight className="ms-auto h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
