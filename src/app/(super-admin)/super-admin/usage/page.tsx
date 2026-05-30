"use client";

import {
  CalendarCheck,
  MessageSquare,
  Phone,
  HardDrive,
  Zap,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──

interface ClinicUsage {
  id: string;
  name: string;
  appointments: number;
  sms: number;
  whatsapp: number;
  storageMb: number;
  apiCalls: number;
  estimatedCost: number;
}

interface MonthlyUsage {
  month: string;
  appointments: number;
  sms: number;
  whatsapp: number;
  storageMb: number;
  apiCalls: number;
}

type SortKey = keyof Omit<ClinicUsage, "id" | "name">;
type SortDir = "asc" | "desc";

// ── Mock data ──

const MOCK_CLINICS: ClinicUsage[] = [
  {
    id: "c-1",
    name: "Cabinet Dr. Bennani",
    appointments: 142,
    sms: 89,
    whatsapp: 234,
    storageMb: 45,
    apiCalls: 1200,
    estimatedCost: 890,
  },
  {
    id: "c-2",
    name: "Centre Dentaire Fès",
    appointments: 98,
    sms: 56,
    whatsapp: 178,
    storageMb: 32,
    apiCalls: 870,
    estimatedCost: 650,
  },
  {
    id: "c-3",
    name: "Polyclinique Marrakech",
    appointments: 210,
    sms: 134,
    whatsapp: 345,
    storageMb: 78,
    apiCalls: 2100,
    estimatedCost: 1450,
  },
  {
    id: "c-4",
    name: "Clinique Al Amal",
    appointments: 75,
    sms: 42,
    whatsapp: 120,
    storageMb: 22,
    apiCalls: 560,
    estimatedCost: 420,
  },
  {
    id: "c-5",
    name: "Cabinet Dr. El Fassi",
    appointments: 163,
    sms: 95,
    whatsapp: 267,
    storageMb: 51,
    apiCalls: 1450,
    estimatedCost: 980,
  },
  {
    id: "c-6",
    name: "Pharmacie El Mokhtar",
    appointments: 45,
    sms: 28,
    whatsapp: 89,
    storageMb: 15,
    apiCalls: 320,
    estimatedCost: 280,
  },
  {
    id: "c-7",
    name: "Cabinet Dr. Tazi",
    appointments: 118,
    sms: 72,
    whatsapp: 198,
    storageMb: 38,
    apiCalls: 980,
    estimatedCost: 720,
  },
  {
    id: "c-8",
    name: "Clinique Nour",
    appointments: 88,
    sms: 48,
    whatsapp: 156,
    storageMb: 29,
    apiCalls: 670,
    estimatedCost: 510,
  },
];

const MOCK_MONTHLY_USAGE: MonthlyUsage[] = [
  {
    month: "Dec 2024",
    appointments: 680,
    sms: 420,
    whatsapp: 1100,
    storageMb: 240,
    apiCalls: 5800,
  },
  {
    month: "Jan 2025",
    appointments: 720,
    sms: 450,
    whatsapp: 1200,
    storageMb: 255,
    apiCalls: 6200,
  },
  {
    month: "Feb 2025",
    appointments: 695,
    sms: 430,
    whatsapp: 1150,
    storageMb: 260,
    apiCalls: 6000,
  },
  {
    month: "Mar 2025",
    appointments: 810,
    sms: 510,
    whatsapp: 1380,
    storageMb: 280,
    apiCalls: 7100,
  },
  {
    month: "Apr 2025",
    appointments: 860,
    sms: 530,
    whatsapp: 1420,
    storageMb: 295,
    apiCalls: 7500,
  },
  {
    month: "May 2025",
    appointments: 939,
    sms: 564,
    whatsapp: 1587,
    storageMb: 310,
    apiCalls: 8150,
  },
];

const METRIC_COLORS: Record<string, string> = {
  appointments: "bg-blue-500",
  sms: "bg-emerald-500",
  whatsapp: "bg-green-500",
  storageMb: "bg-purple-500",
  apiCalls: "bg-orange-500",
};

const METRIC_LABELS: Record<string, string> = {
  appointments: "Appointments",
  sms: "SMS",
  whatsapp: "WhatsApp",
  storageMb: "Storage (MB)",
  apiCalls: "API Calls",
};

// ── Component ──

export default function UsagePage() {
  const [selectedClinicId, setSelectedClinicId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("appointments");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selectedClinic =
    selectedClinicId === "all"
      ? null
      : (MOCK_CLINICS.find((c) => c.id === selectedClinicId) ?? null);

  const aggregated = useMemo(() => {
    if (selectedClinic) {
      return {
        appointments: selectedClinic.appointments,
        sms: selectedClinic.sms,
        whatsapp: selectedClinic.whatsapp,
        storageMb: selectedClinic.storageMb,
        apiCalls: selectedClinic.apiCalls,
      };
    }
    return MOCK_CLINICS.reduce(
      (acc, c) => ({
        appointments: acc.appointments + c.appointments,
        sms: acc.sms + c.sms,
        whatsapp: acc.whatsapp + c.whatsapp,
        storageMb: acc.storageMb + c.storageMb,
        apiCalls: acc.apiCalls + c.apiCalls,
      }),
      { appointments: 0, sms: 0, whatsapp: 0, storageMb: 0, apiCalls: 0 },
    );
  }, [selectedClinic]);

  const sortedClinics = useMemo(() => {
    return [...MOCK_CLINICS].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Usage Metrics" },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Métriques d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi de l&apos;utilisation par clinique : rendez-vous, messages, stockage et appels API
        </p>
      </div>

      {/* Clinic Selector */}
      <div className="mb-6 max-w-sm">
        <Label className="text-sm mb-1.5 block">Clinic</Label>
        <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
          <SelectTrigger>
            <SelectValue
              placeholder="All Clinics"
              value={selectedClinic ? selectedClinic.name : "All Clinics"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clinics</SelectItem>
            {MOCK_CLINICS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Usage Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Appointments Booked
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.appointments}</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SMS Sent</CardTitle>
            <Phone className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.sms}</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WhatsApp Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.whatsapp}</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Storage Used
            </CardTitle>
            <HardDrive className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.storageMb} MB</div>
            <p className="text-xs text-muted-foreground">total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Calls</CardTitle>
            <Zap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.apiCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Per-Clinic Usage</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Clinic</th>
                {(
                  [
                    ["appointments", "Appointments"],
                    ["sms", "SMS"],
                    ["whatsapp", "WhatsApp"],
                    ["storageMb", "Storage (MB)"],
                    ["apiCalls", "API Calls"],
                    ["estimatedCost", "Est. Cost (MAD)"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="text-right p-3 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-foreground"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <SortIcon columnKey={key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedClinics.map((clinic) => (
                <tr key={clinic.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{clinic.name}</td>
                  <td className="p-3 text-right">{clinic.appointments}</td>
                  <td className="p-3 text-right">{clinic.sms}</td>
                  <td className="p-3 text-right">{clinic.whatsapp}</td>
                  <td className="p-3 text-right">{clinic.storageMb}</td>
                  <td className="p-3 text-right">{clinic.apiCalls.toLocaleString()}</td>
                  <td className="p-3 text-right font-medium">
                    {clinic.estimatedCost.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Usage Trends (bar chart with colored divs) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Trends — Last 6 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {(["appointments", "sms", "whatsapp", "storageMb", "apiCalls"] as const).map(
              (metric) => {
                const values = MOCK_MONTHLY_USAGE.map((m) => m[metric]);
                const max = Math.max(...values, 1);
                return (
                  <div key={metric}>
                    <h4 className="text-sm font-medium mb-3">{METRIC_LABELS[metric]}</h4>
                    <div className="flex items-end gap-2 h-24">
                      {MOCK_MONTHLY_USAGE.map((m) => {
                        const pct = (m[metric] / max) * 100;
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">{m[metric]}</span>
                            <div
                              className={`w-full rounded-t ${METRIC_COLORS[metric]}`}
                              style={{ height: `${pct}%`, minHeight: "4px" }}
                            />
                            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                              {m.month.split(" ")[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
