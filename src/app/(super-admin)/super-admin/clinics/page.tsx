"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogIn, Search, Ban, CheckCircle, Eye, Filter,
  Building2, Mail, Phone, MapPin, Calendar, Users, TrendingUp,
  Loader2, UserPlus, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { fetchClinics, updateClinicStatus, fetchClinicUsers } from "@/lib/super-admin-actions";
import { exportToCSV } from "@/lib/export-data";
import { LoadingWithTimeout } from "@/components/loading-with-timeout";
import { logger } from "@/lib/logger";

interface ClinicDetail {
  id: string;
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  plan: string;
  city: string;
  patientsCount: number;
  monthlyRevenue: number;
  status: "active" | "suspended" | "trial";
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  doctorsCount: number;
  appointmentsThisMonth: number;
  domain?: string;
  lastLoginAt: string;
  features: Record<string, boolean>;
}

type FilterType = "all" | "doctor" | "dentist" | "pharmacy";
type FilterStatus = "all" | "active" | "suspended" | "trial";

export default function AllClinicsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginClinic, setLoginClinic] = useState<ClinicDetail | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendClinic, setSuspendClinic] = useState<ClinicDetail | null>(null);
  const [list, setList] = useState<ClinicDetail[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmName, setConfirmName] = useState("");

  const loadClinics = useCallback(async () => {
    try {
      const clinics = await fetchClinics();
      const enriched: ClinicDetail[] = await Promise.all(
        clinics.map(async (c) => {
          let patientsCount = 0;
          let doctorsCount = 0;
          try {
            const users = await fetchClinicUsers(c.id);
            patientsCount = users.filter((u) => u.role === "patient").length;
            doctorsCount = users.filter((u) => u.role === "doctor" || u.role === "clinic_admin").length;
          } catch (err) {
            logger.warn("Failed to fetch clinic users", { context: "super-admin-clinics", clinicId: c.id, error: err });
          }
          const config = (c.config ?? {}) as Record<string, unknown>;
          return {
            id: c.id,
            name: c.name,
            type: c.type as "doctor" | "dentist" | "pharmacy",
            plan: c.tier ?? "pro",
            city: (config.city as string) ?? "",
            patientsCount,
            monthlyRevenue: 0,
            status: (c.status === "inactive" ? "suspended" : c.status ?? "active") as "active" | "suspended" | "trial",
            ownerName: (config.ownerName as string) ?? "",
            ownerEmail: (config.email as string) ?? "",
            ownerPhone: (config.phone as string) ?? "",
            createdAt: c.created_at ?? "",
            doctorsCount,
            appointmentsThisMonth: 0,
            domain: (config.domain as string) ?? undefined,
            lastLoginAt: "",
            features: {},
          };
        }),
      );
      setList(enriched);
    } catch (err) {
      logger.warn("Operation failed", { context: "page", error: err });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadClinics();
    return () => { controller.abort(); };
  }, [loadClinics]);

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || c.type === typeFilter) && (statusFilter === "all" || c.status === statusFilter);
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedList = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, statusFilter]);

  // Export clinics to CSV
  function handleExportCSV() {
    exportToCSV(
      filtered,
      [
        { key: "name", label: "Clinic Name" },
        { key: "type", label: "Type" },
        { key: "ownerName", label: "Owner" },
        { key: "ownerEmail", label: "Email" },
        { key: "ownerPhone", label: "Phone" },
        { key: "city", label: "City" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        { key: "patientsCount", label: "Patients" },
        { key: "doctorsCount", label: "Doctors" },
        { key: "createdAt", label: "Created" },
      ],
      `clinics-export-${new Date().toISOString().split("T")[0]}.csv`,
    );
  }

  async function toggleStatus(clinic: ClinicDetail) {
    setActionLoading(true);
    try {
      const newStatus = clinic.status === "suspended" ? "active" : "suspended";
      await updateClinicStatus(clinic.id, newStatus);
      setList((prev) =>
        prev.map((c) =>
          c.id === clinic.id ? { ...c, status: newStatus as "active" | "suspended" | "trial" } : c,
        ),
      );
    } catch (err) {
      logger.warn("Operation failed", { context: "page", error: err });
    } finally {
      setActionLoading(false);
    }
    setSuspendOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">All Clinics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all {list.length} registered clinics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Link href="/super-admin/onboarding">
            <Button>
              <UserPlus className="h-4 w-4 mr-1" />
              New Client Setup
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, city, or owner..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "doctor", "dentist", "pharmacy"] as FilterType[]).map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)} className="capitalize text-xs">
              {t === "all" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "active", "suspended", "trial"] as FilterStatus[]).map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize text-xs">
            {s === "all" ? "All" : s}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">{s === "all" ? list.length : list.filter((c) => c.status === s).length}</Badge>
          </Button>
        ))}
      </div>

      {loadingData ? (
        <LoadingWithTimeout message="Loading clinics..." onRetry={() => { setLoadingData(true); loadClinics(); }} />
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Clinic</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Owner</th>
                  <th className="text-left font-medium py-3 px-4">Type</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">City</th>
                  <th className="text-left font-medium py-3 px-4">Patients</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Revenue</th>
                  <th className="text-left font-medium py-3 px-4">Plan</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((clinic) => (
                  <tr key={clinic.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{clinic.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{clinic.ownerName}</p>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <p className="text-muted-foreground">{clinic.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{clinic.ownerEmail}</p>
                    </td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{clinic.type}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{clinic.city}</td>
                    <td className="py-3 px-4">{clinic.patientsCount}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">{clinic.monthlyRevenue.toLocaleString()} MAD</td>
                    <td className="py-3 px-4">
                      <Badge variant={clinic.plan === "premium" ? "default" : clinic.plan === "standard" ? "secondary" : "outline"}>{clinic.plan}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={clinic.status === "active" ? "success" : clinic.status === "suspended" ? "destructive" : "warning"}>{clinic.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="View details" onClick={() => setDetail(clinic)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Login as client" onClick={() => { setLoginClinic(clinic); setLoginOpen(true); }}><LogIn className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title={clinic.status === "suspended" ? "Activate" : "Suspend"} className={clinic.status === "suspended" ? "text-green-600" : "text-red-500"} onClick={() => { setSuspendClinic(clinic); setSuspendOpen(true); }}>
                          {clinic.status === "suspended" ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No clinics found matching your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Pagination Controls */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="border rounded px-2 py-1 text-sm bg-background"
            >
              {[10, 25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span>per page &middot; {filtered.length} total</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detail !== null} onOpenChange={() => setDetail(null)}>
        {detail && (
          <DialogContent onClose={() => setDetail(null)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detail.name}</DialogTitle>
              <DialogDescription>Detailed clinic information and statistics</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-3 text-center"><Users className="h-4 w-4 mx-auto mb-1 text-purple-600" /><p className="text-lg font-bold">{detail.patientsCount}</p><p className="text-[10px] text-muted-foreground">Patients</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-600" /><p className="text-lg font-bold">{detail.monthlyRevenue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue (MAD)</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><Calendar className="h-4 w-4 mx-auto mb-1 text-blue-600" /><p className="text-lg font-bold">{detail.appointmentsThisMonth}</p><p className="text-[10px] text-muted-foreground">Appts/Month</p></CardContent></Card>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Owner Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Type:</span><span className="capitalize">{detail.type}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">City:</span><span>{detail.city}</span></div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Email:</span><span className="truncate">{detail.ownerEmail}</span></div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Phone:</span><span>{detail.ownerPhone}</span></div>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Account Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Plan: </span><Badge variant={detail.plan === "premium" ? "default" : detail.plan === "standard" ? "secondary" : "outline"}>{detail.plan}</Badge></div>
                  <div><span className="text-muted-foreground">Status: </span><Badge variant={detail.status === "active" ? "success" : detail.status === "suspended" ? "destructive" : "warning"}>{detail.status}</Badge></div>
                  <div><span className="text-muted-foreground">Doctors: </span><span>{detail.doctorsCount}</span></div>
                  <div><span className="text-muted-foreground">Joined: </span><span>{detail.createdAt}</span></div>
                  {detail.domain && <div className="col-span-2"><span className="text-muted-foreground">Domain: </span><span>{detail.domain}</span></div>}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Enabled Features</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.features).map(([key, enabled]) => (
                    <Badge key={key} variant={enabled ? "success" : "secondary"} className="text-[10px] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="outline" onClick={() => { setLoginClinic(detail); setLoginOpen(true); setDetail(null); }}><LogIn className="h-4 w-4 mr-1" />Login as Client</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Login As Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        {loginClinic && (
          <DialogContent onClose={() => setLoginOpen(false)}>
            <DialogHeader>
              <DialogTitle>Login as Client</DialogTitle>
              <DialogDescription>You are about to impersonate <strong>{loginClinic.name}</strong>. This will be logged for security purposes.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{loginClinic.name}</p>
              <p className="text-xs text-muted-foreground">Owner: {loginClinic.ownerName} &middot; {loginClinic.city}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLoginOpen(false)}>Cancel</Button>
              <Button disabled={actionLoading} onClick={async () => {
                setActionLoading(true);
                try {
                  const res = await fetch("/api/impersonate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clinicId: loginClinic.id, clinicName: loginClinic.name }),
                  });
                  if (res.ok) {
                    setLoginOpen(false);
                    router.push("/admin/dashboard");
                  } else {
                    const data = await res.json();
                    void data.error;
                  }
                } catch (err) {
                  logger.warn("Operation failed", { context: "page", error: err });
                } finally {
                  setActionLoading(false);
                }
              }}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <LogIn className="h-4 w-4 mr-1" />Continue as {loginClinic.ownerName.split(" ")[0] || "Admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Suspend/Activate Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        {suspendClinic && (
          <DialogContent onClose={() => setSuspendOpen(false)}>
            <DialogHeader>
              <DialogTitle>{suspendClinic.status === "suspended" ? "Activate" : "Suspend"} Clinic</DialogTitle>
              <DialogDescription>
                {suspendClinic.status === "suspended"
                  ? "Reactivate this clinic? They will regain access to all features."
                  : "Suspend this clinic? They will lose access to all features immediately."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">{suspendClinic.name}</p>
              <p className="text-xs text-muted-foreground">{suspendClinic.patientsCount} patients &middot; {suspendClinic.monthlyRevenue.toLocaleString()} MAD/mo</p>
            </div>
            {suspendClinic.status !== "suspended" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Type the clinic name to confirm:</label>
                <Input
                  placeholder={suspendClinic.name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSuspendOpen(false); setConfirmName(""); }}>Cancel</Button>
              <Button
                variant={suspendClinic.status === "suspended" ? "default" : "destructive"}
                onClick={() => { toggleStatus(suspendClinic); setConfirmName(""); }}
                disabled={actionLoading || (suspendClinic.status !== "suspended" && confirmName !== suspendClinic.name)}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {suspendClinic.status === "suspended" ? <><CheckCircle className="h-4 w-4 mr-1" />Activate</> : <><Ban className="h-4 w-4 mr-1" />Suspend</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
