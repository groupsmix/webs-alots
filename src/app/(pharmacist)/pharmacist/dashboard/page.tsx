"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList, AlertTriangle,
  Clock, DollarSign, ArrowRight,
  Check, Eye, AlertCircle, TrendingUp,
  Package, Pill, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { useTenant } from "@/lib/hooks/use-tenant";
import {
  fetchProducts,
  fetchPrescriptionRequests,
  fetchDailySales,
  fetchPurchaseOrders,
  fetchLoyaltyMembers,
  getLowStockProducts,
  getExpiringProducts,
  getOutOfStockProducts,
} from "@/lib/data/client";
import type {
  ProductView,
  PharmacyPrescriptionView,
  DailySaleView,
  PurchaseOrderView,
  LoyaltyMemberView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

// ── Date helpers ──

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function PharmacistDashboardPage() {
  const { clinicId } = useTenant();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescriptionView[]>([]);
  const [sales, setSales] = useState<DailySaleView[]>([]);
  const [allOrders, setAllOrders] = useState<PurchaseOrderView[]>([]);
  const [members, setMembers] = useState<LoyaltyMemberView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Date boundaries ──
  const now = useMemo(() => new Date(), []);
  const todayStr = toDateStr(now);
  const weekStart = toDateStr(startOfWeek(now));
  const monthStart = toDateStr(startOfMonth(now));

  useEffect(() => {
    const controller = new AbortController();
    const cId = clinicId;
    Promise.all([
      fetchProducts(cId),
      fetchPrescriptionRequests(cId),
      fetchDailySales(cId),
      fetchPurchaseOrders(cId),
      fetchLoyaltyMembers(cId),
    ])
      .then(([p, rx, s, o, l]) => {
      if (controller.signal.aborted) return;
        setProducts(p);
        setPrescriptions(rx);
        setSales(s);
        setAllOrders(o);
        setMembers(l);
      })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const pendingRx = prescriptions.filter((p) => p.status === "pending" || p.status === "reviewing");
  const lowStock = getLowStockProducts(products);
  const outOfStock = getOutOfStockProducts(products);
  const expiring = getExpiringProducts(products, 90);

  // ── Sales KPIs (daily / weekly / monthly) ──
  const todaySales = sales.filter((s) => s.date === todayStr);
  const weekSales = sales.filter((s) => s.date >= weekStart && s.date <= todayStr);
  const monthSales = useMemo(
    () => sales.filter((s) => s.date >= monthStart && s.date <= todayStr),
    [sales, monthStart, todayStr],
  );

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const weekRevenue = weekSales.reduce((sum, s) => sum + s.total, 0);
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);

  // ── Top-selling products (by quantity sold this month) ──
  const productSalesMap = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of monthSales) {
      for (const item of sale.items) {
        const existing = map.get(item.productName) ?? { name: item.productName, qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.price * item.quantity;
        map.set(item.productName, existing);
      }
    }
    return map;
  }, [monthSales]);

  const topSellingProducts = useMemo(
    () => Array.from(productSalesMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5),
    [productSalesMap],
  );

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  // ── Prescription fill rate ──
  const totalRx = prescriptions.length;
  const filledRx = prescriptions.filter(
    (p) => p.status === "ready" || p.status === "picked-up" || p.status === "delivered"
  ).length;
  const fillRate = totalRx > 0 ? Math.round((filledRx / totalRx) * 100) : 0;

  const pendingOrders = allOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pharmacist Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your pharmacy operations</p>
        </div>
        <Badge variant="outline" className="text-emerald-600 border-emerald-600">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Sales</p>
                <p className="text-3xl font-bold">{todayRevenue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
                <p className="text-xs text-muted-foreground mt-1">{todaySales.length} transaction{todaySales.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
            <Link href="/pharmacist/sales" className="text-sm text-emerald-600 hover:underline mt-2 inline-flex items-center">
              View Sales <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Alerts</p>
                <p className="text-3xl font-bold text-orange-500">{lowStock.length + outOfStock.length + expiring.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {outOfStock.length} out &middot; {lowStock.filter(p => p.stockQuantity > 0).length} low &middot; {expiring.length} expiring
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <Link href="/pharmacist/stock" className="text-sm text-emerald-600 hover:underline mt-2 inline-flex items-center">
              Manage Stock <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prescription Fill Rate</p>
                <p className="text-3xl font-bold">{fillRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">{filledRx}/{totalRx} filled</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                <Pill className="h-6 w-6" />
              </div>
            </div>
            <Link href="/pharmacist/prescriptions" className="text-sm text-emerald-600 hover:underline mt-2 inline-flex items-center">
              View Prescriptions <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Prescriptions</p>
                <p className="text-3xl font-bold">{pendingRx.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{members.length} loyalty members</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
            <Link href="/pharmacist/prescriptions" className="text-sm text-emerald-600 hover:underline mt-2 inline-flex items-center">
              View Queue <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Sales Period Tabs */}
      <Tabs defaultValue="daily" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sales Overview
          </h2>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold">{todayRevenue.toLocaleString()} MAD</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{todaySales.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">With Prescription</p><p className="text-2xl font-bold text-blue-600">{todaySales.filter(s => s.hasPrescription).length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg. Basket</p><p className="text-2xl font-bold">{todaySales.length > 0 ? Math.round(todayRevenue / todaySales.length).toLocaleString() : 0} MAD</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="weekly">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold">{weekRevenue.toLocaleString()} MAD</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{weekSales.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">With Prescription</p><p className="text-2xl font-bold text-blue-600">{weekSales.filter(s => s.hasPrescription).length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg. Basket</p><p className="text-2xl font-bold">{weekSales.length > 0 ? Math.round(weekRevenue / weekSales.length).toLocaleString() : 0} MAD</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold">{monthRevenue.toLocaleString()} MAD</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{monthSales.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">With Prescription</p><p className="text-2xl font-bold text-blue-600">{monthSales.filter(s => s.hasPrescription).length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg. Basket</p><p className="text-2xl font-bold">{monthSales.length > 0 ? Math.round(monthRevenue / monthSales.length).toLocaleString() : 0} MAD</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top-Selling Products */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top-Selling Products
              </h2>
              <Badge variant="outline" className="text-xs">This Month</Badge>
            </div>
            <div className="space-y-3">
              {topSellingProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sales data this month</p>
              ) : (
                topSellingProducts.map((product, idx) => (
                  <div key={product.name} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.qty} units sold</p>
                    </div>
                    <p className="font-semibold text-sm">{product.revenue.toLocaleString()} MAD</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts (enhanced) */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Package className="h-4 w-4" />
                Stock Alerts
              </h2>
              <Link href="/pharmacist/stock" className="text-sm text-emerald-600 hover:underline">
                View All
              </Link>
            </div>
            <Tabs defaultValue="out-of-stock">
              <TabsList className="w-full">
                <TabsTrigger value="out-of-stock" className="flex-1">
                  Out of Stock ({outOfStock.length})
                </TabsTrigger>
                <TabsTrigger value="low-stock" className="flex-1">
                  Low Stock ({lowStock.filter(p => p.stockQuantity > 0).length})
                </TabsTrigger>
                <TabsTrigger value="expiring" className="flex-1">
                  Expiring ({expiring.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="out-of-stock">
                <div className="space-y-2">
                  {outOfStock.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No out-of-stock items</p>
                  ) : (
                    outOfStock.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/10 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.manufacturer ?? p.category}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="low-stock">
                <div className="space-y-2">
                  {lowStock.filter(p => p.stockQuantity > 0).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No low-stock items</p>
                  ) : (
                    lowStock.filter(p => p.stockQuantity > 0).slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/10 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Stock: {p.stockQuantity} / Min: {p.minimumStock}</p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Low Stock</Badge>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="expiring">
                <div className="space-y-2">
                  {expiring.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No items expiring soon</p>
                  ) : (
                    expiring.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/10 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Expires: {p.expiryDate}</p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Expiring Soon</Badge>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Prescription Queue */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Prescription Queue</h2>
              <Link href="/pharmacist/prescriptions" className="text-sm text-emerald-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {prescriptions.filter((rx) => rx.status !== "picked-up" && rx.status !== "delivered").slice(0, 4).map((rx) => (
                <div key={rx.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{rx.patientName}</p>
                    <p className="text-xs text-muted-foreground">{rx.items.length} item{rx.items.length > 1 ? "s" : ""} - {rx.uploadedAt ? new Date(rx.uploadedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                  </div>
                  <Badge className={
                    rx.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    rx.status === "reviewing" ? "bg-blue-100 text-blue-700 border-0" :
                    rx.status === "partially-ready" ? "bg-orange-100 text-orange-700 border-0" :
                    "bg-emerald-100 text-emerald-700 border-0"
                  }>
                    {rx.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {rx.status === "reviewing" && <Eye className="h-3 w-3 mr-1" />}
                    {rx.status === "partially-ready" && <AlertCircle className="h-3 w-3 mr-1" />}
                    {rx.status === "ready" && <Check className="h-3 w-3 mr-1" />}
                    {rx.status.replace("-", " ")}
                  </Badge>
                </div>
              ))}
              {prescriptions.filter((rx) => rx.status !== "picked-up" && rx.status !== "delivered").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No active prescriptions</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Today&apos;s Sales</h2>
              <Link href="/pharmacist/sales" className="text-sm text-emerald-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {todaySales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{sale.patientName}</p>
                    <p className="text-xs text-muted-foreground">{sale.time} - {sale.items.map((i) => i.productName).join(", ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{sale.total} MAD</p>
                    <Badge variant="outline" className="text-xs capitalize">{sale.paymentMethod}</Badge>
                  </div>
                </div>
              ))}
              {todaySales.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sales recorded today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Pending Orders</h2>
              <Link href="/pharmacist/orders" className="text-sm text-emerald-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{order.supplierName}</p>
                    <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? "s" : ""} - Expected: {order.expectedDelivery}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{order.totalAmount.toLocaleString()} MAD</p>
                    <Badge className={
                      order.status === "shipped" ? "bg-blue-100 text-blue-700 border-0 text-xs" :
                      order.status === "confirmed" ? "bg-emerald-100 text-emerald-700 border-0 text-xs" :
                      "bg-gray-100 text-gray-700 border-0 text-xs"
                    } >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {pendingOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No pending orders</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
