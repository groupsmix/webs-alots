import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appointments } from "@/lib/demo-data";

const patientId = "p1";
const patientAppointments = appointments.filter((a) => a.patientId === patientId);
const upcoming = patientAppointments.filter((a) => a.status === "scheduled" || a.status === "confirmed");
const past = patientAppointments.filter((a) => a.status === "completed" || a.status === "no-show" || a.status === "cancelled");

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function PatientAppointmentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Appointments</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-sm">{apt.serviceName}</p>
                    <p className="text-xs text-muted-foreground">{apt.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{apt.date} at {apt.time}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
          <CardTitle className="text-base">Past Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past appointments.</p>
          ) : (
            <div className="space-y-3">
              {past.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-sm">{apt.serviceName}</p>
                    <p className="text-xs text-muted-foreground">{apt.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{apt.date} at {apt.time}</p>
                  </div>
                  <Badge variant={statusVariant[apt.status]}>{apt.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
