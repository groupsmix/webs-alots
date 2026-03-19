import { Calendar, Users, Clock, CheckCircle, XCircle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { appointments, getTodayAppointments } from "@/lib/demo-data";

const doctorId = "d1";
const todayAppts = getTodayAppointments(doctorId);
const totalPatients = new Set(appointments.filter((a) => a.doctorId === doctorId).map((a) => a.patientId)).size;
const completedToday = todayAppts.filter((a) => a.status === "completed").length;
const waiting = todayAppts.filter((a) => a.status === "confirmed").length;

const stats = [
  { icon: Calendar, label: "Today's Appointments", value: todayAppts.length.toString(), color: "text-blue-600" },
  { icon: Users, label: "Total Patients", value: totalPatients.toString(), color: "text-green-600" },
  { icon: CheckCircle, label: "Completed Today", value: completedToday.toString(), color: "text-emerald-600" },
  { icon: Clock, label: "In Waiting Room", value: waiting.toString(), color: "text-orange-600" },
];

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function DoctorDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Doctor Dashboard</h1>

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Today&apos;s Schedule
            </CardTitle>
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
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.time}</p>
                      <Badge variant={statusVariant[apt.status]} className="text-xs">{apt.status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" title="Mark as done">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" title="No show">
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiting Room */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waiting Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waiting === 0 ? (
              <p className="text-sm text-muted-foreground">No patients waiting.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.filter((a) => a.status === "confirmed").map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar>
                      <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                        {apt.patientName.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.time}</p>
                    </div>
                    <Button size="sm" variant="outline">Start</Button>
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
