import { Clock, ArrowUp, ArrowDown, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const waitingPatients = [
  { id: "w1", name: "Fatima Zahra", time: "09:00", arrivedAt: "08:45", waitTime: "15 min", service: "General Consultation" },
  { id: "w2", name: "Hassan Bourkia", time: "09:30", arrivedAt: "09:15", waitTime: "30 min", service: "Follow-up" },
  { id: "w3", name: "Khadija Alaoui", time: "10:00", arrivedAt: "09:50", waitTime: "5 min", service: "Blood Test Review" },
  { id: "w4", name: "Omar El Fassi", time: "10:30", arrivedAt: "10:20", waitTime: "—", service: "ECG Checkup" },
];

export default function WaitingRoomPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Waiting Room</h1>
        <Badge variant="outline" className="text-sm px-3 py-1">
          <Clock className="h-3.5 w-3.5 mr-1" />
          {waitingPatients.length} patients waiting
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {waitingPatients.map((patient, index) => (
              <div key={patient.id} className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {index + 1}
                </div>
                <Avatar>
                  <AvatarFallback className="text-xs">
                    {patient.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">{patient.service}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Appointment: {patient.time}</p>
                  <p>Arrived: {patient.arrivedAt}</p>
                </div>
                <Badge variant={patient.waitTime === "—" ? "secondary" : "warning"}>
                  {patient.waitTime === "—" ? "Just arrived" : `Wait: ${patient.waitTime}`}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" disabled={index === waitingPatients.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-green-600">
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Call
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
