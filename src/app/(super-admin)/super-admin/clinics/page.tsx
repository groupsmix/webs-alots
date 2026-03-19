"use client";

import { useState } from "react";
import {
  Plus, LogIn, Search, Ban, CheckCircle, Eye, Filter,
  Building2, Mail, Phone, MapPin, Calendar, Users, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { clinicDetails, type ClinicDetail } from "@/lib/super-admin-data";

type FilterType = "all" | "doctor" | "dentist" | "pharmacy";
type FilterStatus = "all" | "active" | "suspended" | "trial";

export default function AllClinicsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginClinic, setLoginClinic] = useState<ClinicDetail | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendClinic, setSuspendClinic] = useState<ClinicDetail | null>(null);
  const [list, setList] = useState(clinicDetails);

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q);
    return matchSearch && (typeFilter === "all" || c.type === typeFilter) && (statusFilter === "all" || c.status === statusFilter);
  });

  function toggleStatus(clinic: ClinicDetail) {
    setList((prev) => prev.map((c) => c.id === clinic.id ? { ...c, status: c.status === "suspended" ? "active" as const : "suspended" as const } : c));
    setSuspendOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">All Clinics</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all {list.length} registered clinics</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Client Setup
        </Button>
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
                {filtered.map((clinic) => (
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

      {/* Create Clinic Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Client Setup</DialogTitle>
            <DialogDescription>Create a new clinic account. The owner will receive login credentials via email.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Clinic Name</Label><Input placeholder="e.g. Cabinet Dr. Ahmed" /></div>
              <div className="space-y-2">
                <Label>Clinic Type</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="doctor">Doctor</option><option value="dentist">Dentist</option><option value="pharmacy">Pharmacy</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Owner Name</Label><Input placeholder="Full name" /></div>
              <div className="space-y-2"><Label>Owner Email</Label><Input type="email" placeholder="owner@clinic.ma" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone Number</Label><Input placeholder="+212 6 XX XX XX XX" /></div>
              <div className="space-y-2"><Label>City</Label><Input placeholder="e.g. Casablanca" /></div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="basic">Basic - 150 MAD/mo</option><option value="standard">Standard - 300 MAD/mo</option><option value="premium">Premium - 500 MAD/mo</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Custom Domain (optional)</Label><Input placeholder="clinic.ma" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input placeholder="Full clinic address" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => setCreateOpen(false)}><Plus className="h-4 w-4 mr-1" />Create Clinic</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Button onClick={() => setLoginOpen(false)}><LogIn className="h-4 w-4 mr-1" />Continue as {loginClinic.ownerName.split(" ")[0]}</Button>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
              <Button variant={suspendClinic.status === "suspended" ? "default" : "destructive"} onClick={() => toggleStatus(suspendClinic)}>
                {suspendClinic.status === "suspended" ? <><CheckCircle className="h-4 w-4 mr-1" />Activate</> : <><Ban className="h-4 w-4 mr-1" />Suspend</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
