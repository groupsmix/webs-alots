"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, AlertTriangle,
  Clock, Users, DollarSign, ArrowRight,
  Check, Eye, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
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

export default function PharmacistDashboardPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescriptionView[]>([]);
  const [sales, setSales] = useState<DailySaleView[]>([]);
  const [allOrders, setAllOrders] = useState<PurchaseOrderView[]>([]);
  const [members, setMembers] = useState<LoyaltyMemberView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cId = clinicConfig.clinicId;
    Promise.all([
      fetchProducts(cId),
      fetchPrescriptionRequests(cId),
      fetchDailySales(cId),
      fetchPurchaseOrders(cId),
      fetchLoyaltyMembers(cId),
    ])
      .then(([p, rx, s, o, l]) => {
        setProducts(p);
        setPrescriptions(rx);
        setSales(s);
        setAllOrders(o);
        setMembers(l);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const pendingRx = prescriptions.filter((p) => p.status === "pending" || p.status === "reviewing");
  const lowStock = getLowStockProducts(products);
  const outOfStock = getOutOfStockProducts(products);
  const expiring = getExpiringProducts(products, 90);
  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter((s) => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Prescriptions</p>
                <p className="text-3xl font-bold">{pendingRx.length}</p>
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
                <p className="text-3xl font-bold">{todayRevenue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
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
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                <p className="text-3xl font-bold text-orange-500">{lowStock.length}</p>
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
                <p className="text-sm text-muted-foreground">Loyalty Members</p>
                <p className="text-3xl font-bold">{members.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <Link href="/pharmacist/loyalty" className="text-sm text-emerald-600 hover:underline mt-2 inline-flex items-center">
              View Members <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        {/* Stock Alerts */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Stock Alerts</h2>
              <Link href="/pharmacist/stock" className="text-sm text-emerald-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {outOfStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.manufacturer ?? p.category}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                </div>
              ))}
              {lowStock.filter((p) => p.stockQuantity > 0).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {p.stockQuantity} / Min: {p.minimumStock}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Low Stock</Badge>
                </div>
              ))}
              {expiring.length > 0 && expiring.slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Expires: {p.expiryDate}</p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Expiring Soon</Badge>
                </div>
              ))}
              {outOfStock.length === 0 && lowStock.length === 0 && expiring.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All stock levels healthy</p>
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
