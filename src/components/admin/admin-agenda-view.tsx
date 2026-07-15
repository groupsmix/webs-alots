"use client";

import { CalendarDays, Clock, Settings2, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/i18n";
import { getLocalDateStr } from "@/lib/utils";

export interface AdminAgendaAppointment {
  id: string;
  slotStart: string;
  status: string;
  patientName: string;
  doctorName: string;
  serviceName: string;
}

interface AdminAgendaViewProps {
  appointments: AdminAgendaAppointment[];
  today: string;
  timezone: string;
}

const statusVariants: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  checked_in: "warning",
  in_progress: "warning",
  completed: "success",
  no_show: "destructive",
  cancelled: "secondary",
  rescheduled: "outline",
};

function localeTag(locale: string): string {
  if (locale === "ar" || locale === "ary") return "ar-MA";
  if (locale === "en") return "en-MA";
  return "fr-MA";
}

export function AdminAgendaView({ appointments, today, timezone }: AdminAgendaViewProps) {
  const [locale] = useLocale();
  const intlLocale = localeTag(locale);

  const appointmentsByDate = appointments.reduce<Map<string, AdminAgendaAppointment[]>>(
    (groups, appointment) => {
      const dateKey = getLocalDateStr(new Date(appointment.slotStart), timezone);
      const group = groups.get(dateKey) ?? [];
      group.push(appointment);
      groups.set(dateKey, group);
      return groups;
    },
    new Map(),
  );

  const todayAppointments = appointmentsByDate.get(today) ?? [];
  const confirmedCount = todayAppointments.filter((appointment) =>
    ["confirmed", "checked_in", "in_progress"].includes(appointment.status),
  ).length;
  const completedCount = todayAppointments.filter(
    (appointment) => appointment.status === "completed",
  ).length;
  const remainingCount = todayAppointments.filter(
    (appointment) => !["completed", "cancelled", "no_show"].includes(appointment.status),
  ).length;

  const summary = [
    {
      label: t(locale, "admin.agenda.todayAppointments"),
      value: todayAppointments.length,
    },
    {
      label: t(locale, "admin.agenda.confirmed"),
      value: confirmedCount,
    },
    {
      label: t(locale, "admin.agenda.completed"),
      value: completedCount,
    },
    {
      label: t(locale, "admin.agenda.remaining"),
      value: remainingCount,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "admin.agenda.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, "admin.agenda.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/working-hours"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
            {t(locale, "admin.agenda.workingHours")}
          </Link>
          <Link
            href="/admin/doctors"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Stethoscope className="h-4 w-4" />
            {t(locale, "admin.agenda.manageTeam")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            {t(locale, "admin.agenda.nextSevenDays")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t(locale, "admin.agenda.empty")}
              description={t(locale, "admin.agenda.emptyDesc")}
              className="py-10"
            />
          ) : (
            <div className="space-y-6">
              {[...appointmentsByDate.entries()].map(([date, dayAppointments]) => (
                <section key={date} aria-labelledby={`agenda-${date}`}>
                  <h2
                    id={`agenda-${date}`}
                    className="mb-2 text-sm font-semibold capitalize text-muted-foreground"
                  >
                    {date === today
                      ? t(locale, "admin.agenda.today")
                      : new Intl.DateTimeFormat(intlLocale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: timezone,
                        }).format(new Date(`${date}T12:00:00Z`))}
                  </h2>
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <Clock className="h-4 w-4 text-primary" />
                          {new Intl.DateTimeFormat(intlLocale, {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: timezone,
                          }).format(new Date(appointment.slotStart))}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{appointment.patientName}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {appointment.doctorName} · {appointment.serviceName}
                          </p>
                        </div>
                        <Badge
                          variant={statusVariants[appointment.status] ?? "outline"}
                          className="w-fit"
                        >
                          {t(
                            locale,
                            `admin.agenda.status.${
                              Object.hasOwn(statusVariants, appointment.status)
                                ? appointment.status
                                : "other"
                            }`,
                          )}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
