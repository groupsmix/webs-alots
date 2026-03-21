"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Calendar, FileText, Clock, Bell, Pill, CreditCard, Users, MessageSquare, ArrowRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  fetchPatientAppointments,
  fetchPrescriptions,
  fetchInvoices,
  fetchNotifications,
  type AppointmentView,
  type PrescriptionView,
  type InvoiceView,
  type NotificationView,
} from "@/lib/data/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const quickLinks = [
  { icon: Calendar, label: "My Appointments", description: "View & manage bookings", href: "/patient/appointments" },
  { icon: Activity, label: "Medical History", description: "Past visits & diagnoses", href: "/patient/medical-history" },
  { icon: Pill, label: "Prescriptions", description: "View & download", href: "/patient/prescriptions" },
  { icon: FileText, label: "Documents", description: "Upload & manage files", href: "/patient/documents" },
  { icon: CreditCard, label: "Invoices", description: "Payment history", href: "/patient/invoices" },
  { icon: Users, label: "Family Members", description: "Manage family", href: "/patient/family" },
  { icon: Bell, label: "Notifications", description: "Alerts & reminders", href: "/patient/notifications" },
  { icon: MessageSquare, label: "Feedback", description: "Rate consultations", href: "/patient/feedback" },
];

export default function PatientDashboardPage() {
  const [appointmentsList, setAppointmentsList] = useState<AppointmentView[]>([]);
  const [prescriptionsList, setPrescriptionsList] = useState<PrescriptionView[]>([]);
  const [invoicesList, setInvoicesList] = useState<InvoiceView[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationView[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setUserName(user.name);
    const [appts, rxs, invs, notifs] = await Promise.all([
      fetchPatientAppointments(user.clinic_id, user.id),
      fetchPrescriptions(user.clinic_id),
      fetchInvoices(user.clinic_id),
      fetchNotifications(user.id),
    ]);
    setAppointmentsList(appts);
    setPrescriptionsList(rxs.filter(rx => rx.patientId === user.id));
    setInvoicesList(invs);
    setNotificationsList(notifs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const upcoming = appointmentsList.filter((a) => a.status === "scheduled" || a.status === "confirmed");
  const completedVisits = appointmentsList.filter((a) => a.status === "completed");
  const patientPrescriptions = prescriptionsList;
  const unreadNotifications = notificationsList.filter((n) => !n.read);
  const pendingInvoices = invoicesList.filter((inv) => inv.status === "pending");

  const statCards = [
    { icon: Calendar, label: "Upcoming Appointments", value: upcoming.length.toString(), color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50", href: "/patient/appointments" },
    { icon: Pill, label: "Active Prescriptions", value: patientPrescriptions.length.toString(), color: "text-green-600 bg-green-100 dark:bg-green-900/50", href: "/patient/prescriptions" },
    { icon: Clock, label: "Total Visits", value: completedVisits.length.toString(), color: "text-purple-600 bg-purple-100 dark:bg-purple-900/50", href: "/patient/medical-history" },
    { icon: Bell, label: "Unread Notifications", value: unreadNotifications.length.toString(), color: "text-orange-600 bg-orange-100 dark:bg-orange-900/50", href: "/patient/notifications" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here&apos;s an overview of your health portal.</p>
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
        <ErrorBoundary section="Upcoming Appointments" compact>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <Link href="/patient/appointments">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
                <Link href="/book">
                  <Button variant="link" size="sm" className="mt-1">Book an appointment</Button>
                </Link>
              </div>
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

        <ErrorBoundary section="Prescriptions" compact>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Prescriptions</CardTitle>
            <Link href="/patient/prescriptions">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {patientPrescriptions.length === 0 ? (
              <div className="text-center py-6">
                <Pill className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No prescriptions yet.</p>
              </div>
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
              Pending Payments
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
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-base font-semibold mb-3">Quick Access</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="flex flex-col items-center text-center p-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                    <link.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
