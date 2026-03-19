import { TrendingUp, Users, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appointments, patients, getTotalRevenue } from "@/lib/demo-data";

const totalRevenue = getTotalRevenue();
const totalAppts = appointments.length;
const completedAppts = appointments.filter((a) => a.status === "completed").length;
const noShowAppts = appointments.filter((a) => a.status === "no-show").length;
const noShowRate = totalAppts > 0 ? Math.round((noShowAppts / totalAppts) * 100) : 0;
const cancelledAppts = appointments.filter((a) => a.status === "cancelled").length;

const monthlyData = [
  { month: "Jan", revenue: 12500, patients: 42, appointments: 68 },
  { month: "Feb", revenue: 14200, patients: 48, appointments: 75 },
  { month: "Mar", revenue: 13800, patients: 45, appointments: 72 },
  { month: "Apr", revenue: 15600, patients: 52, appointments: 80 },
  { month: "May", revenue: 16200, patients: 55, appointments: 85 },
  { month: "Jun", revenue: 14800, patients: 50, appointments: 78 },
];

const busiestHours = [
  { hour: "09:00", count: 12 },
  { hour: "10:00", count: 15 },
  { hour: "11:00", count: 18 },
  { hour: "12:00", count: 8 },
  { hour: "14:00", count: 14 },
  { hour: "15:00", count: 16 },
  { hour: "16:00", count: 10 },
];

const maxCount = Math.max(...busiestHours.map((h) => h.count));

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports &amp; Analytics</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold">{totalRevenue} MAD</p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Users className="h-5 w-5 text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{patients.length}</p>
            <p className="text-xs text-muted-foreground">Total Patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Clock className="h-5 w-5 text-purple-600 mb-2" />
            <p className="text-2xl font-bold">{completedAppts}</p>
            <p className="text-xs text-muted-foreground">Completed Appointments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <XCircle className="h-5 w-5 text-red-500 mb-2" />
            <p className="text-2xl font-bold">{noShowRate}%</p>
            <p className="text-xs text-muted-foreground">No-show Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthlyData.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-muted-foreground">{m.month}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(m.revenue / 20000) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-20 text-right">{m.revenue.toLocaleString()} MAD</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Busiest Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {busiestHours.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-medium mb-1">{h.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t"
                    style={{ height: `${(h.count / maxCount) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">{h.hour}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
