"use client";

import { Calendar, Users, UserPlus, Clock, CreditCard, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { AppointmentCard } from "@/components/receptionist/appointment-card";
import { CashRegister } from "@/components/receptionist/cash-register";
import { EndOfDayReportButton } from "@/components/receptionist/end-of-day-report-button";
import { ManualBookingDialog } from "@/components/receptionist/manual-booking-dialog";
import { PaymentDialog } from "@/components/receptionist/payment-dialog";
import { QuickPatientRegistration } from "@/components/receptionist/quick-patient-registration";
import { RealtimeWaitingRoom } from "@/components/receptionist/realtime-waiting-room";
import { ReceptionistAIWidget } from "@/components/receptionist/receptionist-ai-widget";
import { WalkInDialog } from "@/components/receptionist/walk-in-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchAppointments,
  fetchInvoices,
  fetchPatients,
  type AppointmentView,
  type PatientView,
} from "@/lib/data/client";
import { formatCurrency } from "@/lib/utils";

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
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      setClinicId(user.clinic_id);
      // PERF-LAT-05: this dashboard only renders today/tomorrow lists,
      // recent status tabs and monthly revenue — fetch a 30-day lookback
      // plus future rows instead of the clinic's full history (which was
      // oldest-first and capped at 1000 rows, so busy clinics could even
      // lose today's schedule).
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);
      const [appts, invoices, patients] = await Promise.all([
        fetchAppointments(user.clinic_id, {
          sinceDate: lookback.toISOString().split("T")[0],
        }),
        fetchInvoices(user.clinic_id, { sinceDate: lookback.toISOString() }),
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
    return () => {
      controller.abort();
    };
  }, []);

  const todayDateStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDateStr = tomorrowDate.toISOString().split("T")[0];

  const todayApptsFiltered = todayAppts.filter((a) => a.date === todayDateStr);
  const tomorrowAppts = todayAppts.filter((a) => a.date === tomorrowDateStr);
  const checkedInAppts = todayAppts.filter(
    (a) => checkedInIds.has(a.id) || a.status === "in-progress",
  );
  const waitingAppts = todayApptsFiltered.filter(
    (a) => checkedInIds.has(a.id) && a.status !== "completed",
  );
  const completedAppts = todayAppts.filter((a) => a.status === "completed");
  const cancelledAppts = todayAppts.filter((a) => a.status === "cancelled");
  const noShowAppts = todayAppts.filter((a) => a.status === "no-show");

  const checkedInCount = todayApptsFiltered.filter(
    (a) => a.status === "confirmed" || a.status === "in-progress",
  ).length;

  const stats = [
    {
      icon: Calendar,
      label: "Today's Bookings",
      value: todayApptsFiltered.length.toString(),
      color: "text-blue-600",
    },
    {
      icon: Users,
      label: "Checked In",
      value: (checkedInCount + checkedInIds.size).toString(),
      color: "text-green-600",
    },
    { icon: UserPlus, label: "Walk-ins Today", value: "0", color: "text-purple-600" },
    {
      icon: CreditCard,
      label: "Revenue (Month)",
      value: `${formatCurrency(totalRevenue)}`,
      color: "text-orange-600",
    },
  ];

  const handleCheckIn = (id: string) => {
    setCheckedInIds((prev) => new Set(prev).add(id));
  };

  const handleConfirm = (id: string) => {
    setTodayAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a)));
  };

  const handleCancel = (id: string) => {
    setTodayAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
  };

  const handleNoShow = (id: string) => {
    setTodayAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "no-show" } : a)));
  };

  const handleReschedule = (_id: string) => {
    // TODO: Implement reschedule flow (open reschedule dialog)
  };

  const renderApptList = (appointments: AppointmentView[], emptyMessage: string) => {
    if (appointments.length === 0) {
      return (
        <EmptyState
          icon={Calendar}
          title={emptyMessage}
          description="Click Manual Booking or Walk-in Registration to add an appointment."
        />
      );
    }
    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {appointments.map((apt) => (
          <AppointmentCard
            key={apt.id}
            appointment={apt}
            patient={patientMap.get(apt.patientId)}
            isCheckedIn={checkedInIds.has(apt.id)}
            onCheckIn={handleCheckIn}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onNoShow={handleNoShow}
            onReschedule={handleReschedule}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
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
        {/* Column 1: Appointment Board */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointment Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap mb-4 bg-transparent p-0 gap-1">
                <TabsTrigger
                  value="today"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="tomorrow"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Tomorrow
                </TabsTrigger>
                <TabsTrigger
                  value="checked-in"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Checked In
                </TabsTrigger>
                <TabsTrigger
                  value="waiting"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Waiting
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Completed
                </TabsTrigger>
                <TabsTrigger
                  value="cancelled"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  Cancelled
                </TabsTrigger>
                <TabsTrigger
                  value="no-show"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  No-show
                </TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="m-0">
                {renderApptList(todayApptsFiltered, "No appointments scheduled for today.")}
              </TabsContent>
              <TabsContent value="tomorrow" className="m-0">
                {renderApptList(tomorrowAppts, "No appointments scheduled for tomorrow.")}
              </TabsContent>
              <TabsContent value="checked-in" className="m-0">
                {renderApptList(checkedInAppts, "No patients currently checked in.")}
              </TabsContent>
              <TabsContent value="waiting" className="m-0">
                {renderApptList(waitingAppts, "No patients waiting.")}
              </TabsContent>
              <TabsContent value="completed" className="m-0">
                {renderApptList(completedAppts, "No completed appointments yet.")}
              </TabsContent>
              <TabsContent value="cancelled" className="m-0">
                {renderApptList(cancelledAppts, "No cancelled appointments.")}
              </TabsContent>
              <TabsContent value="no-show" className="m-0">
                {renderApptList(noShowAppts, "No no-shows recorded.")}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Column 2: Waiting Room (Real-time via Supabase) */}
        {clinicId ? (
          <RealtimeWaitingRoom clinicId={clinicId} onCallIn={(id) => handleCheckIn(id)} />
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
          {clinicId && <QuickPatientRegistration clinicId={clinicId} />}

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

      {/* Receptionist AI Widget */}
      {clinicId && (
        <div className="mt-6">
          <ReceptionistAIWidget clinicId={clinicId} />
        </div>
      )}
    </div>
  );
}
