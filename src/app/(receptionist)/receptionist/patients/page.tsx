import { Search, UserPlus, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { patients } from "@/lib/demo-data";

export default function ReceptionistPatientsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Patient Registration</h1>
        <Button>
          <UserPlus className="h-4 w-4 mr-1" />
          Register New Patient
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search patients by name, phone, or CIN..." className="pl-10" />
      </div>

      <div className="space-y-3">
        {patients.map((patient) => (
          <Card key={patient.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {patient.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{patient.name}</p>
                <p className="text-xs text-muted-foreground">{patient.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={patient.insurance ? "success" : "secondary"}>
                  {patient.insurance || "No Insurance"}
                </Badge>
                <span className="text-xs text-muted-foreground">{patient.age}y, {patient.gender}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm">Check In</Button>
                <Button variant="ghost" size="sm" title="WhatsApp">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
