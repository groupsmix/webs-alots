"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { MOROCCO_LOCALE_MAP, cn } from "@/lib/utils";

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

  const title = t(locale, "admin.owner.greeting", {
    name: ownerName?.trim() || t(locale, "admin.owner.defaultName"),
  });

  const primaryAction = (
    <Link href="/admin/agenda" className={cn(buttonVariants({ size: "sm" }))}>
      <CalendarPlus className="me-2 h-4 w-4" aria-hidden="true" />
      {t(locale, "admin.owner.newAppointment")}
    </Link>
  );

  return <PageHeader title={title} subtitle={todayLabel} primaryAction={primaryAction} />;
}
