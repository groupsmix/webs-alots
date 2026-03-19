import { Calendar, FileText, Clock, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appointments, prescriptions } from "@/lib/demo-data";

const patientId = "p1";
const patientAppointments = appointments.filter((a) => a.patientId === patientId);
const upcoming = patientAppointments.filter((a) => a.status === "scheduled" || a.status === "confirmed");
const patientPrescriptions = prescriptions.filter((p) => p.patientId === patientId);

const statCards = [
  { icon: Calendar, label: "Upcoming Appointments", value: upcoming.length.toString(), color: "text-blue-600" },
  { icon: FileText, label: "Prescriptions", value: patientPrescriptions.length.toString(), color: "text-green-600" },
  { icon: Clock, label: "Total Visits", value: patientAppointments.length.toString(), color: "text-purple-600" },
  { icon: Bell, label: "Notifications", value: "2", color: "text-orange-600" },
];

export default function PatientDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
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
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{apt.serviceName}</p>
                      <p className="text-xs text-muted-foreground">{apt.doctorName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.date}</p>
                      <p className="text-xs text-muted-foreground">{apt.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Prescriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {patientPrescriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prescriptions yet.</p>
            ) : (
              <div className="space-y-3">
                {patientPrescriptions.map((rx) => (
                  <div key={rx.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{rx.doctorName}</p>
                      <Badge variant="outline">{rx.date}</Badge>
                    </div>
                    <div className="space-y-1">
                      {rx.medications.map((med, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {med.name} — {med.dosage}
                        </p>
                      ))}
                    </div>
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
