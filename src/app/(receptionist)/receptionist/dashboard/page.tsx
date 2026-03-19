import { Calendar, Users, UserPlus, Clock, CreditCard, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getTodayAppointments, getTotalRevenue } from "@/lib/demo-data";

const todayAppts = getTodayAppointments("d1");
const checkedIn = todayAppts.filter((a) => a.status === "confirmed" || a.status === "in-progress").length;
const totalRevenue = getTotalRevenue();

const stats = [
  { icon: Calendar, label: "Today's Bookings", value: todayAppts.length.toString(), color: "text-blue-600" },
  { icon: Users, label: "Checked In", value: checkedIn.toString(), color: "text-green-600" },
  { icon: UserPlus, label: "Walk-ins Today", value: "2", color: "text-purple-600" },
  { icon: CreditCard, label: "Revenue (Month)", value: `${totalRevenue} MAD`, color: "text-orange-600" },
];

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function ReceptionistDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reception Dashboard</h1>

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

      <div className="flex gap-3 mb-6">
        <Button>
          <UserPlus className="h-4 w-4 mr-1" />
          Walk-in Registration
        </Button>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-1" />
          Manual Booking
        </Button>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-1" />
          Daily Report
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar>
                      <AvatarFallback className="text-xs">
                        {apt.patientName.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.serviceName}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">{apt.time}</p>
                      </div>
                      <Badge variant={statusVariant[apt.status]}>{apt.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waiting Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkedIn === 0 ? (
              <p className="text-sm text-muted-foreground">No patients in waiting room.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.filter((a) => a.status === "confirmed").map((apt, i) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">Arrived at {apt.time}</p>
                    </div>
                    <Button size="sm" variant="outline">Check In</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
