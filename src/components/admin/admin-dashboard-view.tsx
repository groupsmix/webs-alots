"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  HeartPulse,
  Star,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardStats, RecentActivityItem } from "@/lib/data/dashboard";
import { t } from "@/lib/i18n";
import { formatCurrency, formatDisplayDate } from "@/lib/utils";

interface AdminDashboardViewProps {
  stats: DashboardStats;
  ownerName?: string | null;
  today: string;
}

interface AttentionItem {
  title: string;
  description: string;
  href: string;
  action: string;
  tone: "warning" | "danger";
}

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
  admin: "default",
  auth: "default",
  security: "destructive",
  patient: "default",
  config: "warning",
};

function localeTag(locale: string): string {
  if (locale === "ar" || locale === "ary") return "ar-MA";
  if (locale === "en") return "en-MA";
  return "fr-MA";
}

export function AdminDashboardView({ stats, ownerName, today }: AdminDashboardViewProps) {
  const [locale] = useLocale();

  const noShowRate =
    stats.totalAppointments > 0
      ? Math.round((stats.noShowCount / stats.totalAppointments) * 100)
      : 0;
  const todayLabel = new Intl.DateTimeFormat(localeTag(locale), {
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

  const attentionItems: AttentionItem[] = [];

  if (stats.doctorCount === 0) {
    attentionItems.push({
      title: t(locale, "admin.owner.addFirstDoctor"),
      description: t(locale, "admin.owner.addFirstDoctorDesc"),
      href: "/admin/doctors",
      action: t(locale, "admin.owner.takeAction"),
      tone: "warning",
    });
  }

  if (stats.totalPatients === 0) {
    attentionItems.push({
      title: t(locale, "admin.owner.addFirstPatient"),
      description: t(locale, "admin.owner.addFirstPatientDesc"),
      href: "/admin/patients",
      action: t(locale, "admin.owner.takeAction"),
      tone: "warning",
    });
  }

  if (noShowRate >= 10) {
    attentionItems.push({
      title: t(locale, "admin.owner.noShowAttention", { rate: noShowRate }),
      description: t(locale, "admin.owner.noShowAttentionDesc"),
      href: "/admin/analytics",
      action: t(locale, "admin.owner.viewPerformance"),
      tone: noShowRate >= 20 ? "danger" : "warning",
    });
  }

  if (stats.averageRating > 0 && stats.averageRating < 4) {
    attentionItems.push({
      title: t(locale, "admin.owner.ratingAttention", {
        rating: stats.averageRating.toFixed(1),
      }),
      description: t(locale, "admin.owner.ratingAttentionDesc"),
      href: "/admin/reviews",
      action: t(locale, "admin.owner.viewReviews"),
      tone: "warning",
    });
  }

  const overviewCards = [
    {
      icon: Users,
      label: t(locale, "admin.totalPatients"),
      value: stats.totalPatients.toString(),
      helper: t(locale, "admin.owner.patientsHelper"),
      color: "text-[var(--oltigo-green)]",
    },
    {
      icon: CalendarDays,
      label: t(locale, "admin.totalAppointments"),
      value: stats.totalAppointments.toString(),
      helper: t(locale, "admin.owner.appointmentsHelper"),
      color: "text-[var(--ink-70)]",
    },
    {
      icon: CircleDollarSign,
      label: t(locale, "admin.owner.revenueCollected"),
      value: formatCurrency(stats.totalRevenue),
      helper: t(locale, "admin.owner.revenueHelper"),
      color: "text-[var(--signal-green)]",
    },
    {
      icon: Star,
      label: t(locale, "admin.averageRating"),
      value: stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)} / 5` : "—",
      helper: t(locale, "admin.owner.ratingHelper"),
      color: "text-[var(--signal-amber)]",
    },
  ];

  const usefulMetrics = [
    {
      label: t(locale, "admin.activeDoctors"),
      value: stats.doctorCount.toString(),
    },
    {
      label: t(locale, "admin.completedAppts"),
      value: stats.completedAppointments.toString(),
    },
    {
      label: t(locale, "admin.noShowRate"),
      value: `${noShowRate}%`,
    },
    {
      label: t(locale, "admin.insurancePatients"),
      value: stats.insurancePatients.toString(),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#00734d] p-5 text-primary-foreground shadow-sm sm:p-7">
        <p className="text-sm font-medium text-primary-foreground/75 capitalize">{todayLabel}</p>
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

      <section aria-labelledby="attention-title">
        <div className="mb-3">
          <h2 id="attention-title" className="text-lg font-semibold">
            {t(locale, "admin.owner.attention")}
          </h2>
          <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.attentionDesc")}</p>
        </div>

        {attentionItems.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {attentionItems.map((item) => (
              <Card key={item.title} className="overflow-hidden">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        item.tone === "danger"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-[var(--signal-amber)]/10 text-[var(--signal-amber)]"
                      }`}
                    >
                      <CircleAlert className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="self-start rounded-lg border px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    {item.action}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-[var(--signal-green)]/20 bg-[var(--signal-green)]/5">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--signal-green)]/10 text-[var(--signal-green)]">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">{t(locale, "admin.owner.allGood")}</p>
                <p className="text-sm text-muted-foreground">
                  {t(locale, "admin.owner.allGoodDesc")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="overview-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="overview-title" className="text-lg font-semibold">
              {t(locale, "admin.owner.overview")}
            </h2>
            <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.overviewDesc")}</p>
          </div>
          <Link
            href="/admin/analytics"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            {t(locale, "admin.owner.viewPerformance")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <p className="mt-4 text-2xl font-bold">{stat.value}</p>
                <p className="mt-1 text-sm font-medium">{stat.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t(locale, "admin.recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={t(locale, "admin.noRecentActivity")}
                description={t(locale, "admin.owner.noActivityDesc")}
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((activity: RecentActivityItem, index) => (
                  <div
                    key={`${activity.time}-${index}`}
                    className="flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm sm:flex-nowrap"
                  >
                    <Badge
                      variant={activityVariant[activity.type] ?? "default"}
                      className="mt-0.5 min-w-16 justify-center text-[10px]"
                    >
                      {t(
                        locale,
                        `admin.owner.activity.${
                          Object.hasOwn(activityVariant, activity.type) ? activity.type : "other"
                        }`,
                      )}
                    </Badge>
                    <p className="min-w-0 flex-1">{activity.message}</p>
                    <span className="basis-full ps-[4.75rem] text-xs text-muted-foreground sm:basis-auto sm:ps-0">
                      {formatDisplayDate(activity.time, locale, "relative")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t(locale, "admin.owner.usefulMetrics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {usefulMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{metric.label}</span>
                <span className="font-semibold">{metric.value}</span>
              </div>
            ))}
            <Link
              href="/admin/analytics"
              className="mt-3 flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              {t(locale, "admin.owner.viewPerformance")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
