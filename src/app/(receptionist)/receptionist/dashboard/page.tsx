"use client";

import {
  Calendar,
  Users,
  UserPlus,
  Clock,
  CreditCard,
  FileText,
  CalendarCheck,
  UserX,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { RescheduleDialog } from "@/components/patient/reschedule-dialog";
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
import { t } from "@/lib/i18n";
import { formatCurrency, getLocalDateStr } from "@/lib/utils";

export default function ReceptionistDashboardPage() {
  const [todayAppts, setTodayAppts] = useState<AppointmentView[]>([]);
  const [patientMap, setPatientMap] = useState<Map<string, PatientView>>(new Map());
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [clinicId, setClinicId] = useState("");
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [locale] = useLocale();
  const [activeTab, setActiveTab] = useState("today");
  const [recallsDue, setRecallsDue] = useState(0);

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
          sinceDate: getLocalDateStr(lookback),
        }),
        fetchInvoices(user.clinic_id, { sinceDate: lookback.toISOString() }),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setTodayAppts(appts);
      setPatientMap(new Map(patients.map((p) => [p.id, p])));
      const monthPrefix = getLocalDateStr().slice(0, 7);
      const revenue = invoices
        .filter((inv) => inv.status === "paid" && inv.date.startsWith(monthPrefix))
        .reduce((sum, inv) => sum + inv.amount, 0);
      setMonthRevenue(revenue);
      // Due-recall count (aggregate only — no patient data leaves the API).
      try {
        const res = await fetch("/api/receptionist/recalls-due");
        if (res.ok) {
          const json = await res.json();
          if (!controller.signal.aborted && json?.ok) {
            setRecallsDue(json.data?.count ?? 0);
          }
        }
      } catch {
        // Non-fatal: the recall count is supplementary to the schedule.
      }
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
  }, [refreshKey]);

  const todayDateStr = getLocalDateStr();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDateStr = getLocalDateStr(tomorrowDate);

  const todayApptsFiltered = todayAppts.filter((a) => a.date === todayDateStr);
  const tomorrowAppts = todayAppts.filter((a) => a.date === tomorrowDateStr);
  const checkedInAppts = todayApptsFiltered.filter(
    (a) => checkedInIds.has(a.id) || a.status === "in-progress",
  );
  const waitingAppts = todayApptsFiltered.filter(
    (a) => checkedInIds.has(a.id) && a.status !== "completed",
  );
  const completedAppts = todayAppts.filter((a) => a.status === "completed");
  const cancelledAppts = todayAppts.filter((a) => a.status === "cancelled");
  const noShowAppts = todayAppts.filter((a) => a.status === "no-show");
  const toConfirmAppts = tomorrowAppts.filter((a) => a.status === "scheduled");
  const walkInsToday = todayApptsFiltered.filter((a) => a.isWalkIn).length;

  const stats = [
    {
      icon: Calendar,
      label: t(locale, "receptionist.dash.stat.todayBookings"),
      value: todayApptsFiltered.length.toString(),
      color: "text-blue-600",
    },
    {
      icon: Users,
      label: t(locale, "receptionist.dash.stat.checkedIn"),
      value: checkedInAppts.length.toString(),
      color: "text-green-600",
    },
    {
      icon: UserPlus,
      label: t(locale, "receptionist.dash.stat.walkIns"),
      value: walkInsToday.toString(),
      color: "text-purple-600",
    },
    {
      icon: CreditCard,
      label: t(locale, "receptionist.dash.stat.revenueMonth"),
      value: `${formatCurrency(monthRevenue)}`,
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

  const handleReschedule = (id: string) => {
    setRescheduleApptId(id);
  };

  const renderApptList = (appointments: AppointmentView[], emptyMessage: string) => {
    if (appointments.length === 0) {
      return (
        <EmptyState
          icon={Calendar}
          title={emptyMessage}
          description={t(locale, "receptionist.dash.empty.hint")}
        />
      );
    }
    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto pe-1">
        {appointments.map((apt) => (
          <AppointmentCard
            key={apt.id}
            appointment={apt}
            patient={patientMap.get(apt.patientId)}
            isCheckedIn={checkedInIds.has(apt.id)}
            locale={locale}
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
    return <PageLoader message={t(locale, "receptionist.dash.loadingDashboard")} />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{t(locale, "receptionist.dash.loadError")}</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const apptToReschedule = rescheduleApptId
    ? todayAppts.find((a) => a.id === rescheduleApptId)
    : null;

  if (apptToReschedule) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          {t(locale, "receptionist.dash.rescheduleTitle")}
        </h1>
        <RescheduleDialog
          appointment={apptToReschedule}
          onClose={() => setRescheduleApptId(null)}
          onReschedule={() => {
            setRescheduleApptId(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t(locale, "receptionist.dash.title")}</h1>
        <div className="flex gap-2">
          <ManualBookingDialog
            trigger={
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 me-1" />
                {t(locale, "receptionist.dash.manualBooking")}
              </Button>
            }
          />
          <EndOfDayReportButton />
        </div>
      </div>

      {/* À faire aujourd'hui — actionable strip */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t(locale, "receptionist.dash.todo.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {toConfirmAppts.length === 0 && noShowAppts.length === 0 && recallsDue === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t(locale, "receptionist.dash.todo.allClear")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setActiveTab("tomorrow")}
                disabled={toConfirmAppts.length === 0}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 text-start transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <CalendarCheck className="h-5 w-5 shrink-0 text-blue-600" />
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-none">
                    {toConfirmAppts.length}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(locale, "receptionist.dash.todo.toConfirm")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("no-show")}
                disabled={noShowAppts.length === 0}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 text-start transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <UserX className="h-5 w-5 shrink-0 text-red-600" />
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-none">{noShowAppts.length}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(locale, "receptionist.dash.todo.noShowsToRebook")}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <Bell className="h-5 w-5 shrink-0 text-purple-600" />
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-none">{recallsDue}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(locale, "receptionist.dash.todo.recallsDue")}
                  </span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              {t(locale, "receptionist.dash.board.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap mb-4 bg-transparent p-0 gap-1">
                <TabsTrigger
                  value="today"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.today")}
                </TabsTrigger>
                <TabsTrigger
                  value="tomorrow"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.tomorrow")}
                </TabsTrigger>
                <TabsTrigger
                  value="checked-in"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.checkedIn")}
                </TabsTrigger>
                <TabsTrigger
                  value="waiting"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.waiting")}
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.completed")}
                </TabsTrigger>
                <TabsTrigger
                  value="cancelled"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.cancelled")}
                </TabsTrigger>
                <TabsTrigger
                  value="no-show"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                >
                  {t(locale, "receptionist.dash.tab.noShow")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="m-0">
                {renderApptList(todayApptsFiltered, t(locale, "receptionist.dash.empty.today"))}
              </TabsContent>
              <TabsContent value="tomorrow" className="m-0">
                {renderApptList(tomorrowAppts, t(locale, "receptionist.dash.empty.tomorrow"))}
              </TabsContent>
              <TabsContent value="checked-in" className="m-0">
                {renderApptList(checkedInAppts, t(locale, "receptionist.dash.empty.checkedIn"))}
              </TabsContent>
              <TabsContent value="waiting" className="m-0">
                {renderApptList(waitingAppts, t(locale, "receptionist.dash.empty.waiting"))}
              </TabsContent>
              <TabsContent value="completed" className="m-0">
                {renderApptList(completedAppts, t(locale, "receptionist.dash.empty.completed"))}
              </TabsContent>
              <TabsContent value="cancelled" className="m-0">
                {renderApptList(cancelledAppts, t(locale, "receptionist.dash.empty.cancelled"))}
              </TabsContent>
              <TabsContent value="no-show" className="m-0">
                {renderApptList(noShowAppts, t(locale, "receptionist.dash.empty.noShow"))}
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
                {t(locale, "receptionist.dash.waitingRoom.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t(locale, "receptionist.dash.loading")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Column 3: Quick Actions */}
        <div className="space-y-4">
          {/* Walk-in Registration */}
          <WalkInDialog
            trigger={
              <Button className="w-full">
                <UserPlus className="h-4 w-4 me-1" />
                {t(locale, "receptionist.dash.walkIn")}
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
                {t(locale, "receptionist.dash.quickLinks")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href="/receptionist/daily-report" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="h-3.5 w-3.5 me-2" />
                  {t(locale, "receptionist.dash.fullDailyReport")}
                </Button>
              </a>
              <PaymentDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <CreditCard className="h-3.5 w-3.5 me-2" />
                    {t(locale, "receptionist.dash.advancedPayment")}
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
