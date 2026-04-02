"use client";

import {
  DollarSign, Users, Calendar, Clock, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, BarChart3, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ──────────────────────────────────────────────────────────────

interface AppointmentData {
  id: string;
  status: string;
  slot_start: string;
  doctor_id: string;
  patient_id: string;
  service_id: string | null;
  is_first_visit: boolean;
  created_at: string;
}

interface PaymentData {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  created_at: string;
  appointment_id: string | null;
}

interface ServiceData {
  id: string;
  name: string;
  price: number | null;
}

interface DoctorData {
  id: string;
  name: string;
}

interface WaitingListData {
  id: string;
  status: string;
}

export interface AnalyticsDashboardProps {
  appointments: AppointmentData[];
  payments: PaymentData[];
  services: ServiceData[];
  doctors: DoctorData[];
  waitingList: WaitingListData[];
  totalPatients: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

function formatMAD(amount: number): string {
  return `${amount.toLocaleString("fr-MA")} MAD`;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const HEATMAP_COLORS = [
  "bg-gray-100 dark:bg-gray-800",
  "bg-blue-100 dark:bg-blue-900/40",
  "bg-blue-200 dark:bg-blue-800/60",
  "bg-blue-300 dark:bg-blue-700/70",
  "bg-blue-400 dark:bg-blue-600/80",
  "bg-blue-500 dark:bg-blue-500",
];

// ── Sub-components (declared outside render to satisfy react-hooks/static-components) ──

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">0%</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}{value}%
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  change,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  change?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
            {change !== undefined && <ChangeIndicator value={change} />}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Component ──────────────────────────────────────────────────────────

export function AnalyticsDashboard({
  appointments,
  payments,
  services,
  doctors,
  waitingList,
  totalPatients,
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState("today");

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = daysAgo(1);

  // Pre-compute date-parsed data
  const parsedAppointments = useMemo(
    () => appointments.map((a) => ({ ...a, _date: new Date(a.slot_start), _created: new Date(a.created_at) })),
    [appointments],
  );
  const parsedPayments = useMemo(
    () => payments.map((p) => ({ ...p, _date: new Date(p.created_at) })),
    [payments],
  );

  // ── TODAY VIEW data ──────────────────────────────────────────────────

  const todayAppts = useMemo(
    () => parsedAppointments.filter((a) => isSameDay(a._date, today)),
    [parsedAppointments, today],
  );
  const _yesterdayAppts = useMemo(
    () => parsedAppointments.filter((a) => isSameDay(a._date, yesterday)),
    [parsedAppointments, yesterday],
  );
  void _yesterdayAppts; // retained for future comparisons

  const todayPayments = useMemo(
    () => parsedPayments.filter((p) => isSameDay(p._date, today) && p.status === "completed"),
    [parsedPayments, today],
  );
  const yesterdayPayments = useMemo(
    () => parsedPayments.filter((p) => isSameDay(p._date, yesterday) && p.status === "completed"),
    [parsedPayments, yesterday],
  );

  const todayRevenue = todayPayments.reduce((s, p) => s + p.amount, 0);
  const yesterdayRevenue = yesterdayPayments.reduce((s, p) => s + p.amount, 0);
  const revenueChange = pctChange(todayRevenue, yesterdayRevenue);

  const todayCompleted = todayAppts.filter((a) => a.status === "completed").length;
  const todayPending = todayAppts.filter((a) => a.status === "pending" || a.status === "confirmed").length;
  const todayCancelled = todayAppts.filter((a) => a.status === "cancelled").length;

  const newPatientsToday = useMemo(
    () => parsedAppointments.filter((a) => a.is_first_visit && isSameDay(a._date, today)).length,
    [parsedAppointments, today],
  );

  const currentQueue = waitingList.filter((w) => w.status === "waiting").length;

  // ── WEEKLY VIEW data ─────────────────────────────────────────────────

  const thisWeekStart = daysAgo(6);
  const lastWeekStart = daysAgo(13);
  const lastWeekEnd = daysAgo(7);

  const weeklyRevenueData = useMemo(() => {
    const data: { name: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = daysAgo(i);
      const dayPayments = parsedPayments.filter(
        (p) => isSameDay(p._date, day) && p.status === "completed",
      );
      const rev = dayPayments.reduce((s, p) => s + p.amount, 0);
      data.push({ name: DAY_NAMES[day.getDay()], revenue: rev });
    }
    return data;
  }, [parsedPayments]);

  // Busiest hours heatmap (7 days x 12 hours: 8AM-8PM)
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0));
    const weekAppts = parsedAppointments.filter((a) =>
      isWithinRange(a._date, thisWeekStart, now),
    );
    for (const a of weekAppts) {
      const dayIdx = a._date.getDay();
      const hour = a._date.getHours();
      if (hour >= 8 && hour < 20) {
        grid[dayIdx][hour - 8] += 1;
      }
    }
    return grid;
  }, [parsedAppointments, thisWeekStart, now]);

  const heatmapMax = useMemo(
    () => Math.max(1, ...heatmapData.flat()),
    [heatmapData],
  );

  // Top services by revenue (this week)
  const topServices = useMemo(() => {
    const serviceMap = new Map<string, { name: string; revenue: number; count: number }>();
    const weekPayments = parsedPayments.filter(
      (p) => isWithinRange(p._date, thisWeekStart, now) && p.status === "completed",
    );
    for (const p of weekPayments) {
      if (!p.appointment_id) continue;
      const appt = parsedAppointments.find((a) => a.id === p.appointment_id);
      if (!appt?.service_id) continue;
      const svc = services.find((s) => s.id === appt.service_id);
      if (!svc) continue;
      const existing = serviceMap.get(svc.id);
      if (existing) {
        existing.revenue += p.amount;
        existing.count += 1;
      } else {
        serviceMap.set(svc.id, { name: svc.name, revenue: p.amount, count: 1 });
      }
    }
    return Array.from(serviceMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [parsedPayments, parsedAppointments, services, thisWeekStart, now]);

  const topServicesTotal = topServices.reduce((s, t) => s + t.revenue, 0);

  // Staff utilization (this week)
  const staffUtilization = useMemo(() => {
    const weekAppts = parsedAppointments.filter((a) =>
      isWithinRange(a._date, thisWeekStart, now),
    );
    return doctors.map((doc) => {
      const docAppts = weekAppts.filter((a) => a.doctor_id === doc.id);
      const completed = docAppts.filter((a) => a.status === "completed").length;
      const total = docAppts.length;
      return { name: doc.name, total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }).sort((a, b) => b.total - a.total);
  }, [parsedAppointments, doctors, thisWeekStart, now]);

  // ── MONTHLY VIEW data ────────────────────────────────────────────────

  const thisMonthStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const lastMonthStart = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const lastMonthEnd = useMemo(() => {
    const d = new Date(thisMonthStart);
    d.setDate(d.getDate() - 1);
    return d;
  }, [thisMonthStart]);

  // Revenue trend (last 6 months)
  const monthlyRevenueData = useMemo(() => {
    const months: { name: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const rev = parsedPayments
        .filter((p) => isWithinRange(p._date, mStart, mEnd) && p.status === "completed")
        .reduce((s, p) => s + p.amount, 0);
      const monthName = mStart.toLocaleString("fr-FR", { month: "short" });
      months.push({ name: monthName, revenue: rev });
    }
    return months;
  }, [parsedPayments, now]);

  // Patient growth (new first-visit patients per month, last 6 months)
  const patientGrowthData = useMemo(() => {
    const months: { name: string; newPatients: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = parsedAppointments.filter(
        (a) => a.is_first_visit && isWithinRange(a._date, mStart, mEnd),
      ).length;
      const monthName = mStart.toLocaleString("fr-FR", { month: "short" });
      months.push({ name: monthName, newPatients: count });
    }
    return months;
  }, [parsedAppointments, now]);

  // Retention rate (returning vs new) — this month
  const thisMonthAppts = useMemo(
    () => parsedAppointments.filter((a) => isWithinRange(a._date, thisMonthStart, now)),
    [parsedAppointments, thisMonthStart, now],
  );
  const newThisMonth = thisMonthAppts.filter((a) => a.is_first_visit).length;
  const returningThisMonth = thisMonthAppts.length - newThisMonth;
  const retentionRate = thisMonthAppts.length > 0
    ? Math.round((returningThisMonth / thisMonthAppts.length) * 100)
    : 0;

  // Avg revenue per appointment — this month
  const thisMonthRevenue = useMemo(
    () => parsedPayments
      .filter((p) => isWithinRange(p._date, thisMonthStart, now) && p.status === "completed")
      .reduce((s, p) => s + p.amount, 0),
    [parsedPayments, thisMonthStart, now],
  );
  const thisMonthCompletedAppts = thisMonthAppts.filter((a) => a.status === "completed").length;
  const avgRevenuePerAppt = thisMonthCompletedAppts > 0
    ? Math.round(thisMonthRevenue / thisMonthCompletedAppts)
    : 0;

  // ── COMPARISON VIEW data ─────────────────────────────────────────────

  const lastMonthAppts = useMemo(
    () => parsedAppointments.filter((a) => isWithinRange(a._date, lastMonthStart, lastMonthEnd)),
    [parsedAppointments, lastMonthStart, lastMonthEnd],
  );
  const lastMonthRevenue = useMemo(
    () => parsedPayments
      .filter((p) => isWithinRange(p._date, lastMonthStart, lastMonthEnd) && p.status === "completed")
      .reduce((s, p) => s + p.amount, 0),
    [parsedPayments, lastMonthStart, lastMonthEnd],
  );

  const thisWeekAppts = useMemo(
    () => parsedAppointments.filter((a) => isWithinRange(a._date, thisWeekStart, now)),
    [parsedAppointments, thisWeekStart, now],
  );
  const lastWeekAppts = useMemo(
    () => parsedAppointments.filter((a) => isWithinRange(a._date, lastWeekStart, lastWeekEnd)),
    [parsedAppointments, lastWeekStart, lastWeekEnd],
  );
  const thisWeekRevenue = useMemo(
    () => parsedPayments
      .filter((p) => isWithinRange(p._date, thisWeekStart, now) && p.status === "completed")
      .reduce((s, p) => s + p.amount, 0),
    [parsedPayments, thisWeekStart, now],
  );
  const lastWeekRevenue = useMemo(
    () => parsedPayments
      .filter((p) => isWithinRange(p._date, lastWeekStart, lastWeekEnd) && p.status === "completed")
      .reduce((s, p) => s + p.amount, 0),
    [parsedPayments, lastWeekStart, lastWeekEnd],
  );

  const monthRevenueChange = pctChange(thisMonthRevenue, lastMonthRevenue);
  const weekRevenueChange = pctChange(thisWeekRevenue, lastWeekRevenue);
  const monthApptsChange = pctChange(thisMonthAppts.length, lastMonthAppts.length);
  const weekApptsChange = pctChange(thisWeekAppts.length, lastWeekAppts.length);

  const lastMonthNewPatients = lastMonthAppts.filter((a) => a.is_first_visit).length;
  const thisMonthNewPatients = newThisMonth;
  const patientGrowthChange = pctChange(thisMonthNewPatients, lastMonthNewPatients);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="today" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
          <TabsTrigger value="weekly">Semaine</TabsTrigger>
          <TabsTrigger value="monthly">Mois</TabsTrigger>
          <TabsTrigger value="comparison">Comparaison</TabsTrigger>
        </TabsList>

        {/* ── TODAY ─────────────────────────────────────────────── */}
        <TabsContent value="today">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Chiffre d'affaires"
                value={formatMAD(todayRevenue)}
                subtext={`Hier: ${formatMAD(yesterdayRevenue)}`}
                change={revenueChange}
              />
              <StatCard
                icon={Calendar}
                label="Rendez-vous"
                value={todayAppts.length.toString()}
                subtext={`${todayCompleted} terminés / ${todayPending} en attente / ${todayCancelled} annulés`}
              />
              <StatCard
                icon={Users}
                label="Nouveaux patients"
                value={newPatientsToday.toString()}
                subtext="Première visite aujourd'hui"
              />
              <StatCard
                icon={Clock}
                label="File d'attente"
                value={currentQueue.toString()}
                subtext="Patients en attente"
              />
            </div>

            {/* Today's appointments by status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Rendez-vous du jour par statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "En attente", count: todayAppts.filter((a) => a.status === "pending").length, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
                    { label: "Confirmés", count: todayAppts.filter((a) => a.status === "confirmed").length, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
                    { label: "Terminés", count: todayCompleted, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
                    { label: "Annulés", count: todayCancelled, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
                      <p className="text-2xl font-bold">{s.count}</p>
                      <p className="text-xs font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── WEEKLY ────────────────────────────────────────────── */}
        <TabsContent value="weekly">
          <div className="space-y-6">
            {/* Revenue bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chiffre d&apos;affaires (7 derniers jours)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value) => [formatMAD(Number(value)), "Revenu"]}
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {weeklyRevenueData.map((_, i) => (
                          <Cell key={i} className="fill-primary/80 hover:fill-primary" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Busiest hours heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Heures les plus chargées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left pb-2 text-muted-foreground" />
                          {Array.from({ length: 12 }, (_, i) => (
                            <th key={i} className="text-center pb-2 text-muted-foreground px-0.5">
                              {i + 8}h
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAY_NAMES.map((dayName, dayIdx) => (
                          <tr key={dayIdx}>
                            <td className="pr-2 text-muted-foreground font-medium">{dayName}</td>
                            {heatmapData[dayIdx].map((count, hourIdx) => {
                              const intensity = Math.min(5, Math.round((count / heatmapMax) * 5));
                              return (
                                <td key={hourIdx} className="p-0.5">
                                  <div
                                    className={`w-6 h-6 rounded-sm ${HEATMAP_COLORS[intensity]} flex items-center justify-center`}
                                    title={`${dayName} ${hourIdx + 8}h: ${count} RDV`}
                                  >
                                    {count > 0 && (
                                      <span className="text-[9px] font-medium">{count}</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Top services */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top services par revenu</CardTitle>
                </CardHeader>
                <CardContent>
                  {topServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée cette semaine</p>
                  ) : (
                    <div className="space-y-3">
                      {topServices.map((svc) => (
                        <div key={svc.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="truncate">{svc.name}</span>
                            <span className="font-medium ml-2 whitespace-nowrap">{formatMAD(svc.revenue)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${topServicesTotal > 0 ? (svc.revenue / topServicesTotal) * 100 : 0}%` }}
                              />
                            </div>
                            <Badge variant="outline" className="text-[10px]">{svc.count} RDV</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Staff utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Utilisation du personnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {staffUtilization.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun praticien</p>
                ) : (
                  <div className="space-y-3">
                    {staffUtilization.map((doc) => (
                      <div key={doc.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{doc.name}</span>
                          <span className="text-muted-foreground">
                            {doc.completed}/{doc.total} RDV ({doc.rate}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all"
                            style={{ width: `${doc.rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── MONTHLY ───────────────────────────────────────────── */}
        <TabsContent value="monthly">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Revenu du mois"
                value={formatMAD(thisMonthRevenue)}
                change={monthRevenueChange}
              />
              <StatCard
                icon={Users}
                label="Total patients"
                value={totalPatients.toString()}
                subtext={`${thisMonthNewPatients} nouveaux ce mois`}
              />
              <StatCard
                icon={TrendingUp}
                label="Taux de rétention"
                value={`${retentionRate}%`}
                subtext={`${returningThisMonth} récurrents / ${newThisMonth} nouveaux`}
              />
              <StatCard
                icon={DollarSign}
                label="Revenu moy. / RDV"
                value={formatMAD(avgRevenuePerAppt)}
                subtext={`${thisMonthCompletedAppts} RDV complétés`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue trend line chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Tendance du chiffre d&apos;affaires
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyRevenueData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value) => [formatMAD(Number(value)), "Revenu"]}
                          contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          className="stroke-primary"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Patient growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Croissance des patients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={patientGrowthData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(value) => [Number(value), "Nouveaux patients"]}
                          contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                        />
                        <Bar dataKey="newPatients" radius={[4, 4, 0, 0]}>
                          {patientGrowthData.map((_, i) => (
                            <Cell key={i} className="fill-primary/70" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── COMPARISON ────────────────────────────────────────── */}
        <TabsContent value="comparison">
          <div className="space-y-6">
            {/* Month vs month */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ce mois vs mois dernier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <ComparisonItem
                    label="Chiffre d'affaires"
                    current={formatMAD(thisMonthRevenue)}
                    previous={formatMAD(lastMonthRevenue)}
                    change={monthRevenueChange}
                  />
                  <ComparisonItem
                    label="Rendez-vous"
                    current={thisMonthAppts.length.toString()}
                    previous={lastMonthAppts.length.toString()}
                    change={monthApptsChange}
                  />
                  <ComparisonItem
                    label="Nouveaux patients"
                    current={thisMonthNewPatients.toString()}
                    previous={lastMonthNewPatients.toString()}
                    change={patientGrowthChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Week vs week */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cette semaine vs semaine dernière</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <ComparisonItem
                    label="Chiffre d'affaires"
                    current={formatMAD(thisWeekRevenue)}
                    previous={formatMAD(lastWeekRevenue)}
                    change={weekRevenueChange}
                  />
                  <ComparisonItem
                    label="Rendez-vous"
                    current={thisWeekAppts.length.toString()}
                    previous={lastWeekAppts.length.toString()}
                    change={weekApptsChange}
                  />
                  <ComparisonItem
                    label="RDV complétés"
                    current={thisWeekAppts.filter((a) => a.status === "completed").length.toString()}
                    previous={lastWeekAppts.filter((a) => a.status === "completed").length.toString()}
                    change={pctChange(
                      thisWeekAppts.filter((a) => a.status === "completed").length,
                      lastWeekAppts.filter((a) => a.status === "completed").length,
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Growth summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Résumé de croissance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Croissance CA (mois)", value: monthRevenueChange },
                    { label: "Croissance CA (semaine)", value: weekRevenueChange },
                    { label: "Croissance RDV (mois)", value: monthApptsChange },
                    { label: "Croissance patients", value: patientGrowthChange },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <div className="flex items-center justify-center gap-1">
                        {item.value > 0 ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : item.value < 0 ? (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        ) : null}
                        <span className={`text-2xl font-bold ${
                          item.value > 0 ? "text-green-600" : item.value < 0 ? "text-red-600" : ""
                        }`}>
                          {item.value > 0 ? "+" : ""}{item.value}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function ComparisonItem({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: string;
  previous: string;
  change: number;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold">{current}</p>
          <p className="text-xs text-muted-foreground">vs {previous}</p>
        </div>
        <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${
          change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-muted-foreground"
        }`}>
          {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
          {change > 0 ? "+" : ""}{change}%
        </span>
      </div>
    </div>
  );
}
