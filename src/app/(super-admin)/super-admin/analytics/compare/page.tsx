/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Building2,
  Calendar,
  DollarSign,
  Users,
  Star,
  Activity,
  Download,
  ChevronDown,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Mock clinic data ─────────────────────────────────────────────────

interface MockClinic {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  monthlyAppointments: number;
  monthlyRevenue: number;
  activePatients: number;
  noShowRate: number;
  satisfaction: number;
  staffCount: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomInRange(min: number, max: number, seed: number): number {
  return Math.round(min + seededRandom(seed) * (max - min));
}

function randomFloat(min: number, max: number, seed: number, decimals: number): number {
  const val = min + seededRandom(seed) * (max - min);
  return Number(val.toFixed(decimals));
}

const CLINIC_POOL: MockClinic[] = Array.from({ length: 12 }, (_, i) => {
  const names = [
    "Clinique Atlas",
    "Cabinet Marrakech",
    "Centre Dental Fès",
    "Pharmacie Rabat Central",
    "Clinique Casablanca Sud",
    "Cabinet Tanger Nord",
    "Centre Médical Agadir",
    "Pharmacie Meknès",
    "Clinique Oujda Est",
    "Cabinet Dental Kénitra",
    "Centre Santé Tétouan",
    "Pharmacie Salé Ville",
  ];
  const types = [
    "doctor",
    "doctor",
    "dentist",
    "pharmacy",
    "doctor",
    "doctor",
    "doctor",
    "pharmacy",
    "doctor",
    "dentist",
    "doctor",
    "pharmacy",
  ];
  const tiers = [
    "starter",
    "professional",
    "enterprise",
    "starter",
    "enterprise",
    "professional",
    "professional",
    "starter",
    "enterprise",
    "professional",
    "starter",
    "professional",
  ];
  const statuses = [
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "active",
    "trial",
    "active",
    "active",
    "active",
  ];

  return {
    id: `clinic-${i + 1}`,
    name: names[i],
    type: types[i],
    tier: tiers[i],
    status: statuses[i],
    monthlyAppointments: randomInRange(50, 200, i * 7 + 1),
    monthlyRevenue: randomInRange(5000, 25000, i * 7 + 2),
    activePatients: randomInRange(100, 500, i * 7 + 3),
    noShowRate: randomFloat(5, 20, i * 7 + 4, 1),
    satisfaction: randomFloat(3.5, 5.0, i * 7 + 5, 1),
    staffCount: randomInRange(2, 10, i * 7 + 6),
  };
});

// ── Metric definitions ───────────────────────────────────────────────

type MetricKey = "appointments" | "revenue" | "patients" | "activity" | "rating";

interface MetricDef {
  key: MetricKey;
  label: string;
  icon: typeof Calendar;
  getValue: (c: MockClinic) => number;
  format: (v: number) => string;
  unit: string;
}

const METRICS: MetricDef[] = [
  {
    key: "appointments",
    label: "Appointments",
    icon: Calendar,
    getValue: (c) => c.monthlyAppointments,
    format: (v) => v.toString(),
    unit: "/month",
  },
  {
    key: "revenue",
    label: "Revenue",
    icon: DollarSign,
    getValue: (c) => c.monthlyRevenue,
    format: (v) => `${v.toLocaleString()} MAD`,
    unit: "/month",
  },
  {
    key: "patients",
    label: "Patients",
    icon: Users,
    getValue: (c) => c.activePatients,
    format: (v) => v.toString(),
    unit: "active",
  },
  {
    key: "activity",
    label: "Activity",
    icon: Activity,
    getValue: (c) => 100 - c.noShowRate,
    format: (v) => `${v.toFixed(1)}%`,
    unit: "show rate",
  },
  {
    key: "rating",
    label: "Rating",
    icon: Star,
    getValue: (c) => c.satisfaction,
    format: (v) => v.toFixed(1),
    unit: "/ 5.0",
  },
];

const BAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
];

// ── Component ────────────────────────────────────────────────────────

export default function ClinicComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["clinic-1", "clinic-2", "clinic-3"]);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("appointments");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedClinics = useMemo(
    () => CLINIC_POOL.filter((c) => selectedIds.includes(c.id)),
    [selectedIds],
  );

  const currentMetric = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0];

  function toggleClinic(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function getBarWidth(clinic: MockClinic, metric: MetricDef): number {
    const values = selectedClinics.map((c) => metric.getValue(c));
    const max = Math.max(...values, 1);
    return (metric.getValue(clinic) / max) * 100;
  }

  function getRankings(metric: MetricDef): MockClinic[] {
    return [...selectedClinics].sort((a, b) => metric.getValue(b) - metric.getValue(a));
  }

  function handleExport() {
    const lines = [
      [
        "Clinic",
        "Type",
        "Tier",
        "Appointments",
        "Revenue (MAD)",
        "Patients",
        "No-Show %",
        "Satisfaction",
        "Staff",
      ].join(","),
      ...selectedClinics.map((c) =>
        [
          c.name,
          c.type,
          c.tier,
          c.monthlyAppointments,
          c.monthlyRevenue,
          c.activePatients,
          c.noShowRate,
          c.satisfaction,
          c.staffCount,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clinic-comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Analytics", href: "/super-admin/analytics" },
          { label: "Clinic Comparison" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clinic Comparison</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare performance across clinics side by side
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export Report
        </Button>
      </div>

      {/* ── Clinic Selector ──────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-medium whitespace-nowrap">Select clinics (2–5):</span>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center justify-between w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                <span className="truncate">{selectedClinics.map((c) => c.name).join(", ")}</span>
                <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
              </button>
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-60 overflow-auto">
                  {CLINIC_POOL.map((clinic) => {
                    const selected = selectedIds.includes(clinic.id);
                    const disabled = !selected && selectedIds.length >= 5;
                    return (
                      <button
                        key={clinic.id}
                        type="button"
                        disabled={disabled && !selected}
                        onClick={() => toggleClinic(clinic.id)}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                          selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        } ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center text-xs ${
                            selected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selected && "✓"}
                        </div>
                        <span>{clinic.name}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {clinic.type}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Metric Selector ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActiveMetric(m.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeMetric === m.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <m.icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Side-by-side Clinic Cards ────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {selectedClinics.map((clinic, idx) => (
          <Card key={clinic.id} className="relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${BAR_COLORS[idx % BAR_COLORS.length]}`}
            />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium truncate">{clinic.name}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="text-xs">
                  {clinic.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {clinic.tier}
                </Badge>
                <Badge
                  variant={clinic.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {clinic.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Appointments
                </span>
                <span className="font-medium">{clinic.monthlyAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Revenue
                </span>
                <span className="font-medium">{clinic.monthlyRevenue.toLocaleString()} MAD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Patients
                </span>
                <span className="font-medium">{clinic.activePatients}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" /> No-show
                </span>
                <span className="font-medium">{clinic.noShowRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" /> Satisfaction
                </span>
                <span className="font-medium">{clinic.satisfaction}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Staff
                </span>
                <span className="font-medium">{clinic.staffCount}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Bar Chart Comparison ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <currentMetric.icon className="h-4 w-4" />
            {currentMetric.label} Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedClinics.map((clinic, idx) => {
            const value = currentMetric.getValue(clinic);
            const width = getBarWidth(clinic, currentMetric);
            return (
              <div key={clinic.id} className="flex items-center gap-3">
                <span className="text-sm w-40 truncate">{clinic.name}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-24 text-right">
                  {currentMetric.format(value)} {currentMetric.unit}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Rankings ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Rankings by Metric
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {METRICS.map((metric) => {
              const ranked = getRankings(metric);
              return (
                <div key={metric.key} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <metric.icon className="h-3.5 w-3.5" />
                    {metric.label}
                  </div>
                  <div className="space-y-1">
                    {ranked.map((clinic, i) => (
                      <div
                        key={clinic.id}
                        className={`flex items-center justify-between text-xs rounded px-2 py-1 ${
                          i === 0
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="truncate">
                          {i + 1}. {clinic.name}
                        </span>
                        <span className="ml-2 shrink-0">
                          {metric.format(metric.getValue(clinic))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
