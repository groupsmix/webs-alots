"use client";

import Link from "next/link";
import { Calendar, FileText, Clock, Bell, Pill, CreditCard, Users, MessageSquare, ArrowRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import type { PatientDashboardData } from "@/lib/data/server";

const quickLinkDefs = [
  { icon: Calendar, labelKey: "patient.myAppointments" as const, descKey: "patient.myAppointmentsDesc" as const, href: "/patient/appointments" },
  { icon: Activity, labelKey: "patient.medicalHistory" as const, descKey: "patient.medicalHistoryDesc" as const, href: "/patient/medical-history" },
  { icon: Pill, labelKey: "patient.prescriptions" as const, descKey: "patient.prescriptionsDesc" as const, href: "/patient/prescriptions" },
  { icon: FileText, labelKey: "patient.documents" as const, descKey: "patient.documentsDesc" as const, href: "/patient/documents" },
  { icon: CreditCard, labelKey: "patient.invoices" as const, descKey: "patient.invoicesDesc" as const, href: "/patient/invoices" },
  { icon: Users, labelKey: "patient.familyMembers" as const, descKey: "patient.familyMembersDesc" as const, href: "/patient/family" },
  { icon: Bell, labelKey: "patient.notifications" as const, descKey: "patient.notificationsDesc" as const, href: "/patient/notifications" },
  { icon: MessageSquare, labelKey: "patient.feedback" as const, descKey: "patient.feedbackDesc" as const, href: "/patient/feedback" },
];

interface PatientDashboardViewProps {
  data: PatientDashboardData;
}

export function PatientDashboardView({ data }: PatientDashboardViewProps) {
  const [locale] = useLocale();
  const { userName, appointments: appointmentsList, prescriptions: prescriptionsList, invoices: invoicesList, notifications: notificationsList } = data;

  const upcoming = appointmentsList.filter((a) => a.status === "scheduled" || a.status === "confirmed");
  const completedVisits = appointmentsList.filter((a) => a.status === "completed");
  const patientPrescriptions = prescriptionsList;
  const unreadNotifications = notificationsList.filter((n) => !n.read);
  const pendingInvoices = invoicesList.filter((inv) => inv.status === "pending");

  const statCards = [
    { icon: Calendar, label: t(locale, "patient.upcomingAppointments"), value: upcoming.length.toString(), color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50", href: "/patient/appointments" },
    { icon: Pill, label: t(locale, "patient.activePrescriptions"), value: patientPrescriptions.length.toString(), color: "text-green-600 bg-green-100 dark:bg-green-900/50", href: "/patient/prescriptions" },
    { icon: Clock, label: t(locale, "patient.totalVisits"), value: completedVisits.length.toString(), color: "text-purple-600 bg-purple-100 dark:bg-purple-900/50", href: "/patient/medical-history" },
    { icon: Bell, label: t(locale, "patient.unreadNotifications"), value: unreadNotifications.length.toString(), color: "text-orange-600 bg-orange-100 dark:bg-orange-900/50", href: "/patient/notifications" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t(locale, "patient.welcome")}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t(locale, "patient.portalOverview")}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <ErrorBoundary section={t(locale, "patient.upcomingAppointments")} compact>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t(locale, "patient.upcomingAppointments")}</CardTitle>
            <Link href="/patient/appointments">
              <Button variant="ghost" size="sm">
                {t(locale, "patient.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={t(locale, "patient.noUpcoming")}
                description={t(locale, "patient.bookAppointment")}
                action={
                  <Link href="/book">
                    <Button size="sm">{t(locale, "patient.bookAppointment")}</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 3).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{apt.serviceName}</p>
                        <p className="text-xs text-muted-foreground">{apt.doctorName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.date}</p>
                      <p className="text-xs text-muted-foreground">{apt.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </ErrorBoundary>

        <ErrorBoundary section={t(locale, "patient.prescriptions")} compact>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t(locale, "patient.recentPrescriptions")}</CardTitle>
            <Link href="/patient/prescriptions">
              <Button variant="ghost" size="sm">
                {t(locale, "patient.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {patientPrescriptions.length === 0 ? (
              <EmptyState
                icon={Pill}
                title={t(locale, "patient.noPrescriptions")}
                description={t(locale, "patient.noPrescriptions")}
              />
            ) : (
              <div className="space-y-3">
                {patientPrescriptions.map((rx) => (
                  <div key={rx.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{rx.doctorName}</p>
                      <Badge variant="outline">{rx.date}</Badge>
                    </div>
                    <div className="space-y-1">
                      {rx.medications.map((med, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {med.name} — {med.dosage}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </ErrorBoundary>
      </div>

      {pendingInvoices.length > 0 && (
        <Card className="mb-8 border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-orange-600" />
              {t(locale, "patient.pendingPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Invoice #{inv.id.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{inv.amount} {inv.currency}</span>
                    <Badge variant="warning">{t(locale, "patient.pending")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-base font-semibold mb-3">{t(locale, "patient.quickAccess")}</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {quickLinkDefs.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="flex flex-col items-center text-center p-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                    <link.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{t(locale, link.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(locale, link.descKey)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
