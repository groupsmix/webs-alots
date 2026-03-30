"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, UserPlus, Clock, CreditCard, FileText, Phone, MessageCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getCurrentUser,
  fetchTodayAppointments,
  fetchInvoices,
  fetchPatients,
  updateAppointmentStatus,
  type AppointmentView,
  type PatientView,
} from "@/lib/data/client";
import { ManualBookingDialog } from "@/components/receptionist/manual-booking-dialog";
import { WalkInDialog } from "@/components/receptionist/walk-in-dialog";
import { PaymentDialog } from "@/components/receptionist/payment-dialog";
import { PageLoader } from "@/components/ui/page-loader";
import { useOptimisticUpdate } from "@/lib/hooks/use-optimistic-update";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "checked-in": "success",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function ReceptionistDashboardPage() {
  const [initialAppts, setInitialAppts] = useState<AppointmentView[]>([]);
  const [patientMap, setPatientMap] = useState<Map<string, PatientView>>(new Map());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { data: todayAppts, mutate: mutateAppointments } = useOptimisticUpdate(initialAppts);
  const { addToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      const [appts, invoices, patients] = await Promise.all([
        fetchTodayAppointments(user.clinic_id),
        fetchInvoices(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setInitialAppts(appts);
      setPatientMap(new Map(patients.map((p) => [p.id, p])));
      const revenue = invoices
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + inv.amount, 0);
      setTotalRevenue(revenue);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  const checkedIn = todayAppts.filter((a) => a.status === "confirmed" || a.status === "in-progress" || a.status === "checked-in").length;

  const stats = [
    { icon: Calendar, label: "Today's Bookings", value: todayAppts.length.toString(), color: "text-blue-600" },
    { icon: Users, label: "Checked In", value: checkedIn.toString(), color: "text-green-600" },
    { icon: UserPlus, label: "Walk-ins Today", value: "0", color: "text-purple-600" },
    { icon: CreditCard, label: "Revenue (Month)", value: `${totalRevenue} MAD`, color: "text-orange-600" },
  ];

  // Issue 22: Optimistic UI for appointment status changes
  const handleStatusChange = useCallback(async (
    appointmentId: string,
    newStatus: string,
  ) => {
    const apt = todayAppts.find((a) => a.id === appointmentId);
    const previousStatus = apt?.status ?? "scheduled";
    const optimisticList = todayAppts.map((a) =>
      a.id === appointmentId ? { ...a, status: newStatus } : a
    );

    await mutateAppointments(
      optimisticList,
      async () => {
        const result = await updateAppointmentStatus(appointmentId, newStatus);
        if (!result.success) throw new Error(result.error?.message ?? "Failed to update status");
      },
      {
        onSuccess: () => {
          addToast(
            `Status updated to ${newStatus}`,
            "success",
            10_000,
            {
              label: "Undo",
              onClick: () => {
                const undoList = todayAppts.map((a) =>
                  a.id === appointmentId ? { ...a, status: previousStatus } : a
                );
                void mutateAppointments(
                  undoList,
                  async () => {
                    const undo = await updateAppointmentStatus(appointmentId, previousStatus);
                    if (!undo.success) throw new Error(undo.error?.message ?? "Undo failed");
                  },
                  {
                    onSuccess: () => addToast("Status reverted", "info"),
                    onError: (err) => {
                      logger.warn("Undo failed", { context: "receptionist-dashboard", error: err });
                      addToast("Failed to undo", "error");
                    },
                  },
                );
              },
            },
          );
        },
        onError: (err) => {
          logger.warn("Failed to update appointment status", { context: "receptionist-dashboard", error: err });
          addToast("Failed to update status", "error");
        },
      },
    );
  }, [todayAppts, mutateAppointments, addToast]);

  const handleCheckIn = (id: string) => {
    void handleStatusChange(id, "checked-in");
  };

  const handleCallPatient = (phone: string) => {
    window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "").replace("+", "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reception Dashboard</h1>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <WalkInDialog
          trigger={
            <Button>
              <UserPlus className="h-4 w-4 mr-1" />
              Walk-in Registration
            </Button>
          }
        />
        <ManualBookingDialog
          trigger={
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-1" />
              Manual Booking
            </Button>
          }
        />
        <PaymentDialog
          trigger={
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-1" />
              Collect Payment
            </Button>
          }
        />
        <a href="/receptionist/daily-report">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-1" />
            Daily Report
          </Button>
        </a>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((apt) => {
                  const patient = patientMap.get(apt.patientId);
                  return (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Avatar>
                        <AvatarFallback className="text-xs">
                          {apt.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{apt.serviceName}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className="text-sm font-medium">{apt.time}</p>
                        <Badge variant={statusVariant[apt.status] ?? "outline"}>
                          {apt.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                          {apt.status !== "checked-in" && apt.status !== "completed" && apt.status !== "cancelled" && apt.status !== "no-show" && (
                            <Button variant="outline" size="sm" onClick={() => handleCheckIn(apt.id)} title="Check in">
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                        {patient && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCallPatient(patient.phone)} title="Call">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiting Room Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waiting Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkedIn === 0 ? (
              <p className="text-sm text-muted-foreground">No patients in waiting room.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.filter((a) => a.status === "confirmed").map((apt, i) => {
                  const patient = patientMap.get(apt.patientId);
                  return (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">Est. wait: ~{(i + 1) * 15}min</p>
                      </div>
                      <div className="flex gap-1">
                        {patient && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCallPatient(patient.phone)} title="Call">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline">Call In</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
