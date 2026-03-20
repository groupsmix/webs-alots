"use client";

import { useState } from "react";
import { Package, Plus, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PackageView {
  id: string;
  name: string;
  description: string | null;
  totalSessions: number;
  price: number;
  discountPercent: number;
  isActive: boolean;
  subscriberCount: number;
}

interface PatientPackageView {
  id: string;
  patientName: string;
  packageName: string;
  sessionsUsed: number;
  sessionsTotal: number;
  startDate: string;
  expiryDate: string | null;
  status: "active" | "completed" | "expired" | "cancelled";
}

interface TreatmentPackagesProps {
  packages: PackageView[];
  patientPackages?: PatientPackageView[];
  editable?: boolean;
  onAddPackage?: (pkg: { name: string; description: string; totalSessions: number; price: number; discountPercent: number }) => void;
  onRecordSession?: (patientPackageId: string) => void;
}

export function TreatmentPackages({ packages, patientPackages = [], editable = false, onAddPackage, onRecordSession }: TreatmentPackagesProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", totalSessions: "6", price: "", discountPercent: "0" });

  const handleAdd = () => {
    if (form.name.trim() && form.price && onAddPackage) {
      onAddPackage({
        name: form.name,
        description: form.description,
        totalSessions: parseInt(form.totalSessions) || 6,
        price: parseFloat(form.price) || 0,
        discountPercent: parseFloat(form.discountPercent) || 0,
      });
      setForm({ name: "", description: "", totalSessions: "6", price: "", discountPercent: "0" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Package Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Treatment Packages
            <Badge variant="secondary" className="ml-1">{packages.length}</Badge>
          </h2>
          {editable && (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" />
              New Package
            </Button>
          )}
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-sm">New Treatment Package</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Package Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Skin Rejuvenation Bundle" className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Total Sessions</Label>
                  <Input type="number" min="1" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} className="text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Package includes..." className="text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Price (MAD)</Label>
                  <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="5000" className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Discount %</Label>
                  <Input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd}>Create Package</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {packages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No treatment packages created yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <Card key={pkg.id} className={!pkg.isActive ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium">{pkg.name}</h3>
                    {!pkg.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>}
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-lg font-bold">{pkg.price.toLocaleString()}</span>
                      <span className="text-muted-foreground"> MAD</span>
                      {pkg.discountPercent > 0 && (
                        <Badge variant="success" className="ml-1 text-[10px]">-{pkg.discountPercent}%</Badge>
                      )}
                    </div>
                    <div className="text-right text-muted-foreground">
                      <p>{pkg.totalSessions} sessions</p>
                      <p className="flex items-center gap-1"><Users className="h-3 w-3" /> {pkg.subscriberCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Patient Packages */}
      {patientPackages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Patient Packages
          </h3>
          {patientPackages.map((pp) => {
            const remaining = pp.sessionsTotal - pp.sessionsUsed;
            const progress = pp.sessionsTotal > 0 ? (pp.sessionsUsed / pp.sessionsTotal) * 100 : 0;
            return (
              <Card key={pp.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{pp.patientName}</p>
                      <p className="text-xs text-muted-foreground">{pp.packageName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium">{pp.sessionsUsed}/{pp.sessionsTotal} sessions</p>
                        <p className="text-[10px] text-muted-foreground">{remaining} remaining</p>
                      </div>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <Badge variant={pp.status === "active" ? "default" : pp.status === "completed" ? "success" : "secondary"} className="text-xs">
                        {pp.status}
                      </Badge>
                      {editable && pp.status === "active" && remaining > 0 && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onRecordSession?.(pp.id)}>
                          +1 Session
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
