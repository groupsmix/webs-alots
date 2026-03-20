"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Receipt, DollarSign } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchDailySales } from "@/lib/data/client";
import type { DailySaleView } from "@/lib/data/client";

export default function ParapharmacySalesPage() {
  const [sales, setSales] = useState<DailySaleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchDailySales(clinicConfig.clinicId)
      .then(setSales)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading sales...</div>
      </div>
    );
  }

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.patientName.toLowerCase().includes(q) || s.items.some((i) => i.productName.toLowerCase().includes(q));
  });

  const today = new Date().toISOString().split("T")[0];
  const todaySales = filtered.filter((s) => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm">Parapharmacy sales records</p>
        </div>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
              <p className="font-semibold">{todayRevenue.toLocaleString()} MAD</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filtered.map((sale) => (
          <Card key={sale.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">{sale.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.date} {sale.time} &middot; {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{sale.total} MAD</p>
                  <Badge variant="outline" className="text-xs capitalize">{sale.paymentMethod}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sale.items.map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {item.productName} x{item.quantity}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No sales found</p>
          </div>
        )}
      </div>
    </div>
  );
}
