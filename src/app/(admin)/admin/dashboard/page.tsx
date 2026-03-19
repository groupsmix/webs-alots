import { Users, Calendar, CreditCard, Star, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appointments, patients, doctors, getTotalRevenue, getAverageRating } from "@/lib/demo-data";

const totalRevenue = getTotalRevenue();
const avgRating = getAverageRating();
const totalAppts = appointments.length;
const completedAppts = appointments.filter((a) => a.status === "completed").length;
const noShowRate = Math.round((appointments.filter((a) => a.status === "no-show").length / totalAppts) * 100);

const stats = [
  { icon: Users, label: "Total Patients", value: patients.length.toString(), color: "text-blue-600", change: "+12%" },
  { icon: Calendar, label: "Total Appointments", value: totalAppts.toString(), color: "text-green-600", change: "+8%" },
  { icon: CreditCard, label: "Monthly Revenue", value: `${totalRevenue} MAD`, color: "text-purple-600", change: "+15%" },
  { icon: Star, label: "Average Rating", value: avgRating.toFixed(1), color: "text-yellow-600", change: "+0.2" },
];

const recentActivity = [
  { type: "booking", message: "New booking: Fatima Zahra — General Consultation", time: "5 min ago" },
  { type: "payment", message: "Payment received: 300 MAD — Hassan Bourkia", time: "15 min ago" },
  { type: "review", message: "New review: 5 stars from Khadija Alaoui", time: "1 hour ago" },
  { type: "cancel", message: "Cancelled: Omar El Fassi — Follow-up", time: "2 hours ago" },
  { type: "booking", message: "New booking: Youssef Tazi — ECG Checkup", time: "3 hours ago" },
];

const activityVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  booking: "default",
  payment: "success",
  review: "warning",
  cancel: "destructive",
};

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clinic Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <Badge variant="outline" className="text-xs text-green-600">{stat.change}</Badge>
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
                <span className="font-medium">{doctors.length}</span>
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
                <span className="font-medium">{patients.filter((p) => p.insurance).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
