"use client";

import { Calendar, Users, UserPlus, Clock, CreditCard, FileText, Phone, MessageCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { CashRegister } from "@/components/receptionist/cash-register";
import { EndOfDayReportButton } from "@/components/receptionist/end-of-day-report-button";
import { ManualBookingDialog } from "@/components/receptionist/manual-booking-dialog";
import { PaymentDialog } from "@/components/receptionist/payment-dialog";
import { QuickPatientRegistration } from "@/components/receptionist/quick-patient-registration";
import { RealtimeWaitingRoom } from "@/components/receptionist/realtime-waiting-room";
import { WalkInDialog } from "@/components/receptionist/walk-in-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchTodayAppointments,
  fetchInvoices,
  fetchPatients,
  type AppointmentView,
  type PatientView,
} from "@/lib/data/client";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function ReceptionistDashboardPage() {
  const [todayAppts, setTodayAppts] = useState<AppointmentView[]>([]);
  const [patientMap, setPatientMap] = useState<Map<string, PatientView>>(new Map());
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      setClinicId(user.clinic_id);
      const [appts, invoices, patients] = await Promise.all([
        fetchTodayAppointments(user.clinic_id),
        fetchInvoices(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setTodayAppts(appts);
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

  const checkedIn = todayAppts.filter((a) => a.status === "confirmed" || a.status === "in-progress").length;

  const stats = [
    { icon: Calendar, label: "Today's Bookings", value: todayAppts.length.toString(), color: "text-blue-600" },
    { icon: Users, label: "Checked In", value: (checkedIn + checkedInIds.size).toString(), color: "text-green-600" },
    { icon: UserPlus, label: "Walk-ins Today", value: "0", color: "text-purple-600" },
    { icon: CreditCard, label: "Revenue (Month)", value: `${totalRevenue} MAD`, color: "text-orange-600" },
  ];

  const handleCheckIn = (id: string) => {
    setCheckedInIds((prev) => new Set(prev).add(id));
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reception Dashboard</h1>
        <div className="flex gap-2">
          <ManualBookingDialog
            trigger={
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-1" />
                Manual Booking
              </Button>
            }
          />
          <EndOfDayReportButton />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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

      {/* Three-column layout: Schedule | Waiting Room | Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Today's Schedule */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {todayAppts.map((apt) => {
                  const patient = patientMap.get(apt.patientId);
                  const isCheckedIn = checkedInIds.has(apt.id);
                  return (
                    <div key={apt.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">
                          {apt.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.patientName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{apt.serviceName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{apt.time}</p>
                        <Badge
                          variant={isCheckedIn ? "success" : statusVariant[apt.status]}
                          className="text-[10px]"
                        >
                          {isCheckedIn ? "checked-in" : apt.status}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        {!isCheckedIn && apt.status !== "completed" && apt.status !== "cancelled" && (
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleCheckIn(apt.id)} title="Check in">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          </Button>
                        )}
                        {patient && (
                          <>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCallPatient(patient.phone)} title="Call">
                              <Phone className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                              <MessageCircle className="h-3 w-3 text-green-600" />
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

        {/* Column 2: Waiting Room (Real-time via Supabase) */}
        {clinicId ? (
          <RealtimeWaitingRoom
            clinicId={clinicId}
            onCallIn={(id) => handleCheckIn(id)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Waiting Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        )}

        {/* Column 3: Quick Actions */}
        <div className="space-y-4">
          {/* Walk-in Registration */}
          <WalkInDialog
            trigger={
              <Button className="w-full">
                <UserPlus className="h-4 w-4 mr-1" />
                Walk-in Registration
              </Button>
            }
          />

          {/* Quick Patient Registration */}
          {clinicId && (
            <QuickPatientRegistration clinicId={clinicId} />
          )}

          {/* Cash Register */}
          <CashRegister />

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href="/receptionist/daily-report" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Full Daily Report
                </Button>
              </a>
              <PaymentDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <CreditCard className="h-3.5 w-3.5 mr-2" />
                    Advanced Payment
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
