"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Calendar, Clock, CheckCircle, XCircle, Activity,
  TrendingUp, BarChart3, Search, ArrowRight,
  DollarSign, CalendarClock, Stethoscope,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchDoctorAppointments,
  fetchPatients,
  fetchWaitingRoom,
  fetchInvoices,
  updateAppointmentStatus,
  type AppointmentView,
  type PatientView,
  type WaitingRoomEntry,
  type InvoiceView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

// ── Date helpers ──

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function DoctorDashboardPage() {
  const [appointmentList, setAppointmentList] = useState<AppointmentView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [waitingRoomEntries, setWaitingRoomEntries] = useState<WaitingRoomEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [appts, pts, wr, inv] = await Promise.all([
      fetchDoctorAppointments(user.clinic_id, user.id),
      fetchPatients(user.clinic_id),
      fetchWaitingRoom(user.clinic_id),
      fetchInvoices(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setAppointmentList(appts);
    setPatients(pts);
    setWaitingRoomEntries(wr);
    setInvoices(inv);
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

  // ── Derived KPIs ──

  const now = useMemo(() => new Date(), []);
  const todayStr = toDateStr(now);
  const weekStart = toDateStr(startOfWeek(now));
  const monthStart = toDateStr(startOfMonth(now));

  const todayAppts = appointmentList.filter((a) => a.date === todayStr);
  const completedToday = todayAppts.filter((a) => a.status === "completed").length;

  // Consultations this week/month (completed or in-progress)
  const consultationStatuses = useMemo(() => new Set(["completed", "in-progress"]), []);
  const weekConsultations = appointmentList.filter(
    (a) => a.date >= weekStart && a.date <= todayStr && consultationStatuses.has(a.status)
  );
  const monthConsultations = appointmentList.filter(
    (a) => a.date >= monthStart && a.date <= todayStr && consultationStatuses.has(a.status)
  );

  // Revenue from consultations (paid invoices linked to this doctor's appointments)
  const appointmentIds = useMemo(() => new Set(appointmentList.map((a) => a.id)), [appointmentList]);
  const consultationInvoices = invoices.filter(
    (inv) => inv.appointmentId && appointmentIds.has(inv.appointmentId) && inv.status === "paid"
  );
  const weekRevenue = consultationInvoices
    .filter((inv) => inv.date >= weekStart && inv.date <= todayStr)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const monthRevenue = consultationInvoices
    .filter((inv) => inv.date >= monthStart && inv.date <= todayStr)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Upcoming follow-ups — future appointments for patients who already had a completed visit
  const completedPatientIds = useMemo(
    () => new Set(appointmentList.filter((a) => a.status === "completed").map((a) => a.patientId)),
    [appointmentList],
  );
  const upcomingFollowUps = appointmentList.filter(
    (a) =>
      a.date > todayStr &&
      (a.status === "scheduled" || a.status === "confirmed") &&
      completedPatientIds.has(a.patientId)
  );

  // Week/month aggregate stats
  const weekAppts = appointmentList.filter((a) => a.date >= weekStart && a.date <= todayStr);
  const monthAppts = appointmentList.filter((a) => a.date >= monthStart && a.date <= todayStr);
  const weekStats = {
    totalAppointments: weekAppts.length,
    uniquePatients: new Set(weekAppts.map((a) => a.patientId)).size,
    completed: weekAppts.filter((a) => a.status === "completed").length,
    noShows: weekAppts.filter((a) => a.status === "no-show" || a.status === "no_show").length,
    consultations: weekConsultations.length,
    revenue: weekRevenue,
  };
  const monthStats = {
    totalAppointments: monthAppts.length,
    uniquePatients: new Set(monthAppts.map((a) => a.patientId)).size,
    completed: monthAppts.filter((a) => a.status === "completed").length,
    noShows: monthAppts.filter((a) => a.status === "no-show" || a.status === "no_show").length,
    consultations: monthConsultations.length,
    revenue: monthRevenue,
  };

  const stats = [
    { icon: Calendar, label: "Today's Appointments", value: todayAppts.length.toString(), color: "text-blue-600" },
    { icon: Stethoscope, label: "Consultations (Week)", value: weekConsultations.length.toString(), color: "text-indigo-600" },
    { icon: DollarSign, label: "Revenue (Month)", value: `${monthRevenue.toLocaleString()} MAD`, color: "text-emerald-600" },
    { icon: CalendarClock, label: "Upcoming Follow-ups", value: upcomingFollowUps.length.toString(), color: "text-purple-600" },
  ];

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const handleMarkDone = async (appointmentId: string) => {
    await updateAppointmentStatus(appointmentId, "completed");
    setAppointmentList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "completed" } : a))
    );
  };

  const handleNoShow = async (appointmentId: string) => {
    await updateAppointmentStatus(appointmentId, "no-show");
    setAppointmentList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "no-show" } : a))
    );
  };

  const handleStartConsultation = async (appointmentId: string) => {
    await updateAppointmentStatus(appointmentId, "in-progress");
    setAppointmentList((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "in-progress" } : a))
    );
  };

  const filteredPatients = searchQuery.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.phone.includes(searchQuery)
      )
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Doctor Dashboard</h1>

      {/* Stats Cards */}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Today&apos;s Schedule
              <Badge variant="outline" className="ml-auto text-xs">
                {completedToday}/{todayAppts.length} completed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((apt) => (
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
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.time}</p>
                      <Badge variant={statusVariant[apt.status]} className="text-xs">
                        {apt.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {(apt.status === "scheduled" || apt.status === "confirmed") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Start consultation"
                          onClick={() => handleStartConsultation(apt.id)}
                        >
                          <ArrowRight className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {apt.status === "in-progress" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Mark as done"
                          onClick={() => handleMarkDone(apt.id)}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {apt.status !== "completed" && apt.status !== "no-show" && apt.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="No show"
                          onClick={() => handleNoShow(apt.id)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Waiting Room */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Waiting Room
                {waitingRoomEntries.length > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs">
                    {waitingRoomEntries.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {waitingRoomEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No patients waiting.</p>
              ) : (
                <div className="space-y-3">
                  {waitingRoomEntries.map((wr) => (
                    <div key={wr.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Avatar>
                        <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                          {wr.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{wr.patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {wr.scheduledTime} &middot; {wr.serviceName}
                        </p>
                      </div>
                      {wr.priority === "urgent" && (
                        <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Upcoming Follow-ups
                {upcomingFollowUps.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {upcomingFollowUps.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming follow-ups.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingFollowUps.slice(0, 5).map((apt) => (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-purple-100 text-purple-700">
                          {apt.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{apt.serviceName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{apt.date}</p>
                        <p className="text-xs text-muted-foreground">{apt.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Patient Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Quick Patient Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name or phone..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {searchQuery.trim() && (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {filteredPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No patients found.</p>
                  ) : (
                    filteredPatients.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {p.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.phone}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weekly/Monthly Stats */}
      <div className="mt-8">
        <Tabs defaultValue="week">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistics
            </h2>
            <TabsList>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="week">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Appointments</p>
                  <p className="text-2xl font-bold">{weekStats.totalAppointments}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Consultations</p>
                  <p className="text-2xl font-bold text-indigo-600">{weekStats.consultations}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Unique Patients</p>
                  <p className="text-2xl font-bold">{weekStats.uniquePatients}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{weekStats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">No Shows</p>
                  <p className="text-2xl font-bold text-red-500">{weekStats.noShows}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">{weekStats.revenue.toLocaleString()} MAD</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="month">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Appointments</p>
                  <p className="text-2xl font-bold">{monthStats.totalAppointments}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Consultations</p>
                  <p className="text-2xl font-bold text-indigo-600">{monthStats.consultations}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Unique Patients</p>
                  <p className="text-2xl font-bold">{monthStats.uniquePatients}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{monthStats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">No Shows</p>
                  <p className="text-2xl font-bold text-red-500">{monthStats.noShows}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">{monthStats.revenue.toLocaleString()} MAD</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
