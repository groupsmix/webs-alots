import { FileEdit, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { appointments } from "@/lib/demo-data";

const doctorId = "d1";
const recentAppts = appointments
  .filter((a) => a.doctorId === doctorId && (a.status === "completed" || a.status === "in-progress" || a.status === "confirmed"))
  .slice(0, 6);

const mockNotes: Record<string, string> = {
  a1: "Patient presents with sore throat and mild fever. Prescribed antibiotics and rest.",
  a2: "Follow-up on blood pressure. Readings are improving. Continue current medication.",
  a5: "Routine check-up. All vitals normal.",
};

export default function ConsultationNotesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Consultation Notes</h1>

      <div className="space-y-4">
        {recentAppts.map((apt) => (
          <Card key={apt.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="text-xs">
                      {apt.patientName.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{apt.patientName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{apt.serviceName} &middot; {apt.date} at {apt.time}</p>
                  </div>
                </div>
                <Badge variant={apt.status === "completed" ? "success" : apt.status === "in-progress" ? "warning" : "default"}>
                  {apt.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {mockNotes[apt.id] ? (
                <div className="rounded-lg bg-muted/50 p-3 text-sm mb-3">
                  {mockNotes[apt.id]}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic mb-3">No consultation notes yet.</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <FileEdit className="h-3.5 w-3.5 mr-1" />
                  {mockNotes[apt.id] ? "Edit Notes" : "Add Notes"}
                </Button>
                {apt.status !== "completed" && (
                  <>
                    <Button variant="outline" size="sm" className="text-green-600">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Done
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500">
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      No Show
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
