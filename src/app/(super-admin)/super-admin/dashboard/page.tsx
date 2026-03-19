import { Building2, Users, TrendingUp, AlertCircle, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinics } from "@/lib/demo-data";

const activeClinics = clinics.filter((c) => c.status === "active").length;
const totalPatients = clinics.reduce((sum, c) => sum + c.patientsCount, 0);
const totalRevenue = clinics.reduce((sum, c) => sum + c.monthlyRevenue, 0);

const stats = [
  { icon: Building2, label: "Total Clinics", value: clinics.length.toString(), color: "text-blue-600" },
  { icon: Building2, label: "Active Clinics", value: activeClinics.toString(), color: "text-green-600" },
  { icon: Users, label: "Total Patients", value: totalPatients.toLocaleString(), color: "text-purple-600" },
  { icon: TrendingUp, label: "Total Revenue", value: `${totalRevenue.toLocaleString()} MAD`, color: "text-orange-600" },
];

const announcements = [
  { id: "ann1", title: "System Maintenance", message: "Scheduled maintenance on March 25th, 2:00 AM - 4:00 AM.", date: "2026-03-19", type: "warning" },
  { id: "ann2", title: "New Feature: SMS Reminders", message: "SMS appointment reminders are now available for all clinics.", date: "2026-03-15", type: "info" },
  { id: "ann3", title: "Billing Update", message: "New pricing plans effective April 1st. Contact support for details.", date: "2026-03-10", type: "info" },
];

const announcementVariant: Record<string, "warning" | "default"> = {
  warning: "warning",
  info: "default",
};

export default function SuperAdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Super Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Clinics Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clinics.slice(0, 5).map((clinic) => (
                <div key={clinic.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">{clinic.type} &middot; {clinic.city}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{clinic.patientsCount} patients</span>
                    <Badge variant={clinic.status === "active" ? "success" : clinic.status === "suspended" ? "destructive" : "secondary"}>
                      {clinic.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              System Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{ann.title}</p>
                    <Badge variant={announcementVariant[ann.type]}>{ann.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ann.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{ann.date}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full">
              <Megaphone className="h-3.5 w-3.5 mr-1" />
              New Announcement
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
