/* eslint-disable i18next/no-literal-string */
"use client";

import { Gift, Check, Clock, Users, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";

// ── Types ──

type ReferralStatus = "pending" | "accepted" | "declined" | "completed";

interface Referral {
  id: string;
  clinic_id: string;
  referring_doctor_id: string;
  referred_to_doctor_id: string;
  patient_id: string;
  reason: string | null;
  status: ReferralStatus;
  created_at: string;
  clinics: { name: string } | null;
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};

const STATUS_VARIANTS: Record<ReferralStatus, "default" | "secondary" | "destructive" | "warning"> =
  {
    pending: "warning",
    accepted: "default",
    declined: "destructive",
    completed: "secondary",
  };

type StatusFilter = "all" | ReferralStatus;

// ── Component ──

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadReferrals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/referrals");
      const json = await res.json();
      if (json.ok) {
        setReferrals(json.data.referrals);
      } else {
        logger.warn("Failed to load referrals", { context: "referrals-page", error: json.error });
      }
    } catch (err) {
      logger.warn("Failed to load referrals", { context: "referrals-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const filtered =
    statusFilter === "all" ? referrals : referrals.filter((r) => r.status === statusFilter);

  const totalReferrals = referrals.length;
  const completed = referrals.filter((r) => r.status === "completed").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const accepted = referrals.filter((r) => r.status === "accepted").length;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Referrals" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Patient Referrals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track patient referrals between doctors across all clinics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
            <Gift className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "—" : accepted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral Records</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Clinic</th>
                <th className="text-left p-3 font-medium">Reason</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading referrals...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No referrals found.
                  </td>
                </tr>
              )}
              {filtered.map((referral) => (
                <tr key={referral.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{referral.clinics?.name ?? "Unknown Clinic"}</td>
                  <td className="p-3 text-muted-foreground">{referral.reason ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANTS[referral.status]} className="text-xs">
                      {STATUS_LABELS[referral.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
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
