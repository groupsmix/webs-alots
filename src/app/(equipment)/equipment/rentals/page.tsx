"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, HandCoins, ChevronDown, AlertTriangle } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchEquipmentRentals } from "@/lib/data/client";
import type { EquipmentRentalView } from "@/lib/data/client";

const statusOptions = ["all", "reserved", "active", "returned", "overdue", "cancelled"] as const;

const statusColors: Record<string, string> = {
  reserved: "bg-cyan-100 text-cyan-700 border-0",
  active: "bg-blue-100 text-blue-700 border-0",
  returned: "bg-emerald-100 text-emerald-700 border-0",
  overdue: "bg-red-100 text-red-700 border-0",
  cancelled: "bg-gray-100 text-gray-700 border-0",
};

export default function EquipmentRentalsPage() {
  const [rentals, setRentals] = useState<EquipmentRentalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipmentRentals(clinicConfig.clinicId)
      .then(setRentals)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading rentals...</div>
      </div>
    );
  }

  const filtered = rentals.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.equipmentName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipment Rentals</h1>
          <p className="text-muted-foreground text-sm">{rentals.length} rental records</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by equipment, client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((rental) => (
          <Card key={rental.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === rental.id ? null : rental.id)}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    rental.status === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    {rental.status === "overdue" ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <HandCoins className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{rental.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rental.clientName} &middot; {new Date(rental.rentalStart).toLocaleDateString()}
                      {rental.rentalEnd ? ` — ${new Date(rental.rentalEnd).toLocaleDateString()}` : " — ongoing"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[rental.status] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {rental.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">{rental.paymentStatus}</Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === rental.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === rental.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Client Phone</p>
                      <p className="font-medium">{rental.clientPhone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Client ID</p>
                      <p className="font-medium">{rental.clientIdNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Deposit</p>
                      <p className="font-medium">{rental.depositAmount != null ? `${rental.depositAmount} ${rental.currency}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Rental Amount</p>
                      <p className="font-medium">{rental.rentalAmount != null ? `${rental.rentalAmount} ${rental.currency}` : "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-muted-foreground text-xs">Condition Out</p>
                      <p className="font-medium capitalize">{rental.conditionOut}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Condition In</p>
                      <p className="font-medium capitalize">{rental.conditionIn ?? "Not yet returned"}</p>
                    </div>
                  </div>
                  {rental.actualReturn && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">Actual Return Date</p>
                      <p className="font-medium">{new Date(rental.actualReturn).toLocaleDateString()}</p>
                    </div>
                  )}
                  {rental.notes && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">Notes</p>
                      <p>{rental.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <HandCoins className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No rentals match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
