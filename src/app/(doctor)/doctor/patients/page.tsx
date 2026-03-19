import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { patients, appointments } from "@/lib/demo-data";

export default function DoctorPatientsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Patients</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search patients by name, phone, or ID..." className="pl-10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => {
          const patientAppts = appointments.filter((a) => a.patientId === patient.id);
          const lastVisit = patientAppts.filter((a) => a.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
          return (
            <Card key={patient.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {patient.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.phone}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Age</span>
                    <span className="font-medium text-foreground">{patient.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gender</span>
                    <span className="font-medium text-foreground capitalize">{patient.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Insurance</span>
                    <Badge variant={patient.insurance ? "success" : "secondary"} className="text-[10px]">
                      {patient.insurance || "None"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Visits</span>
                    <span className="font-medium text-foreground">{patientAppts.length}</span>
                  </div>
                  {lastVisit && (
                    <div className="flex justify-between">
                      <span>Last Visit</span>
                      <span className="font-medium text-foreground">{lastVisit.date}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
