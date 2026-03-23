"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Receipt, DollarSign, CreditCard, Banknote,
  Shield, Gift,
} from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchDailySales } from "@/lib/data/client";
import type { DailySaleView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function SalesPage() {
  const [allSales, setAllSales] = useState<DailySaleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const today = new Date().toISOString().split("T")[0] ?? "";
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0] ?? ""; })();
  const [dateFilter, setDateFilter] = useState(today);

  useEffect(() => {
    const controller = new AbortController();
    fetchDailySales(clinicConfig.clinicId)
      .then((d) => { if (!controller.signal.aborted) setAllSales(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const filteredSales = useMemo(() => {
    return allSales.filter((s) => s.date === dateFilter);
  }, [allSales, dateFilter]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const cashSales = filteredSales.filter((s) => s.paymentMethod === "cash");
  const cardSales = filteredSales.filter((s) => s.paymentMethod === "card");
  const totalPoints = filteredSales.reduce((sum, s) => sum + s.loyaltyPointsEarned, 0);

  const paymentIcon = {
    cash: <Banknote className="h-3 w-3" />,
    card: <CreditCard className="h-3 w-3" />,
    insurance: <Shield className="h-3 w-3" />,
  };

  if (loading) {
    return <PageLoader message="Loading sales data..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Daily Sales Log</h1>
          <p className="text-muted-foreground text-sm">Track daily transactions and revenue</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* Date selector */}
      <div className="flex gap-2 mb-6">
        {[today, yesterday].map((d) => (
          <button
            key={d}
            onClick={() => setDateFilter(d)}
            className={`px-4 py-2 rounded-lg text-sm ${dateFilter === d ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
          >
            {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totalRevenue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Receipt className="h-4 w-4" />
              <p className="text-sm">Transactions</p>
            </div>
            <p className="text-2xl font-bold">{filteredSales.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Banknote className="h-4 w-4" />
              <p className="text-sm">Cash</p>
            </div>
            <p className="text-2xl font-bold">{cashSales.reduce((s, sale) => s + sale.total, 0).toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <p className="text-sm">Card</p>
            </div>
            <p className="text-2xl font-bold">{cardSales.reduce((s, sale) => s + sale.total, 0).toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gift className="h-4 w-4" />
              <p className="text-sm">Points Earned</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="py-3 px-2 font-medium">Time</th>
                  <th className="py-3 px-2 font-medium">Patient</th>
                  <th className="py-3 px-2 font-medium">Items</th>
                  <th className="py-3 px-2 font-medium">Total</th>
                  <th className="py-3 px-2 font-medium">Payment</th>
                  <th className="py-3 px-2 font-medium">Rx</th>
                  <th className="py-3 px-2 font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-b hover:bg-muted/50 text-sm">
                    <td className="py-3 px-2 font-medium">{sale.time}</td>
                    <td className="py-3 px-2">{sale.patientName}</td>
                    <td className="py-3 px-2">
                      <div className="space-y-0.5">
                        {sale.items.map((item, idx) => (
                          <p key={idx} className="text-xs">
                            {item.productName} x{item.quantity} = {item.price} MAD
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 font-bold text-emerald-600">{sale.total} MAD</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="text-xs capitalize gap-1">
                        {paymentIcon[sale.paymentMethod]}
                        {sale.paymentMethod}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      {sale.hasPrescription && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Rx</Badge>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-purple-600 font-medium">+{sale.loyaltyPointsEarned}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredSales.length === 0 && (
        <div className="text-center py-16">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No sales for this date</h3>
          <p className="text-muted-foreground">Select a different date or add a new sale</p>
        </div>
      )}
    </div>
  );
}
