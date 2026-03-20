"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Calendar, CreditCard, Star, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentUser,
  fetchDashboardStats,
  type DashboardStats,
} from "@/lib/data/client";

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const s = await fetchDashboardStats(user.clinic_id);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const totalPatients = stats?.totalPatients ?? 0;
  const totalAppts = stats?.totalAppointments ?? 0;
  const completedAppts = stats?.completedAppointments ?? 0;
  const noShowRate = totalAppts > 0 ? Math.round((stats?.noShowCount ?? 0) / totalAppts * 100) : 0;
  const totalRevenue = stats?.totalRevenue ?? 0;
  const avgRating = stats?.averageRating ?? 0;
  const doctorCount = stats?.doctorCount ?? 0;
  const insurancePatients = stats?.insurancePatients ?? 0;

  const statCards = [
    { icon: Users, label: "Total Patients", value: totalPatients.toString(), color: "text-blue-600" },
    { icon: Calendar, label: "Total Appointments", value: totalAppts.toString(), color: "text-green-600" },
    { icon: CreditCard, label: "Monthly Revenue", value: `${totalRevenue} MAD`, color: "text-purple-600" },
    { icon: Star, label: "Average Rating", value: avgRating.toFixed(1), color: "text-yellow-600" },
  ];

  const recentActivity: { type: string; message: string; time: string }[] = [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clinic Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Badge variant={activityVariant[activity.type]} className="text-[10px] w-16 justify-center">
                      {activity.type}
                    </Badge>
                    <p className="flex-1 text-sm">{activity.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Doctors</span>
                <span className="font-medium">{doctorCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed Appts</span>
                <span className="font-medium">{completedAppts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">No-show Rate</span>
                <span className="font-medium">{noShowRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Rating</span>
                <span className="font-medium">{avgRating.toFixed(1)} / 5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Insurance Patients</span>
                <span className="font-medium">{insurancePatients}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
