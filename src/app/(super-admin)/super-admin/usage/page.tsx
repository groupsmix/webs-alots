/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  CalendarCheck,
  Users,
  Building2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

// ── Types ──

interface ClinicUsage {
  id: string;
  name: string;
  type: string;
  status: string;
  appointments: number;
  users: number;
  created_at: string;
}

type SortKey = "appointments" | "users" | "name";
type SortDir = "asc" | "desc";

// ── Component ──

export default function UsagePage() {
  const [clinics, setClinics] = useState<ClinicUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("appointments");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usage");
      const json = await res.json();
      if (json.ok) {
        setClinics(json.data.clinics);
      } else {
        logger.warn("Failed to load usage data", { context: "usage-page", error: json.error });
      }
    } catch (err) {
      logger.warn("Failed to load usage data", { context: "usage-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const totals = useMemo(() => {
    return clinics.reduce(
      (acc, c) => ({
        appointments: acc.appointments + c.appointments,
        users: acc.users + c.users,
        clinics: acc.clinics + 1,
        active: acc.active + (c.status === "active" ? 1 : 0),
      }),
      { appointments: 0, users: 0, clinics: 0, active: 0 },
    );
  }, [clinics]);

  const sortedClinics = useMemo(() => {
    return [...clinics].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        return sortDir === "asc"
          ? (va as string).localeCompare(vb as string)
          : (vb as string).localeCompare(va as string);
      }
      va = a[sortKey];
      vb = b[sortKey];
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [clinics, sortKey, sortDir]);

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
        <h1 className="text-2xl font-bold">Usage Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-clinic usage tracking: appointments, users, and activity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clinics
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.clinics}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "" : `${totals.active} active`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Appointments
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.appointments}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totals.users}</div>
            <p className="text-xs text-muted-foreground">across all clinics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. per Clinic
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading || totals.clinics === 0
                ? "—"
                : Math.round(totals.appointments / totals.clinics)}
            </div>
            <p className="text-xs text-muted-foreground">appointments</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Clinic Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Clinic Usage</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Clinic
                    <SortIcon columnKey="name" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("appointments")}
                  >
                    Appointments
                    <SortIcon columnKey="appointments" />
                  </button>
                </th>
                <th className="text-right p-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center hover:text-foreground"
                    onClick={() => handleSort("users")}
                  >
                    Users
                    <SortIcon columnKey="users" />
                  </button>
                </th>
                <th className="p-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading usage data...
                  </td>
                </tr>
              )}
              {!loading && sortedClinics.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No clinic data found.
                  </td>
                </tr>
              )}
              {sortedClinics.map((clinic) => (
                <tr key={clinic.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{clinic.name}</td>
                  <td className="p-3 text-muted-foreground capitalize">{clinic.type}</td>
                  <td className="p-3">
                    <Badge
                      variant={clinic.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {clinic.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">{clinic.appointments}</td>
                  <td className="p-3 text-right">{clinic.users}</td>
                  <td className="p-3">
                    <Link
                      href={`/super-admin/usage/clinic?id=${clinic.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
