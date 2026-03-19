import { Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { doctors } from "@/lib/demo-data";
import { clinicConfig } from "@/config/clinic.config";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ManageDoctorsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Doctors</h1>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Doctor
        </Button>
      </div>

      <div className="space-y-4">
        {doctors.map((doctor) => (
          <Card key={doctor.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {doctor.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{doctor.name}</p>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                <div className="flex gap-1 mt-1">
                  {clinicConfig.workingHours.map((wh, i) => (
                    <Badge
                      key={i}
                      variant={wh.enabled ? "default" : "secondary"}
                      className="text-[10px] px-1.5"
                    >
                      {dayNames[i]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Consultation: {doctor.consultationFee} MAD</p>
                <p>{doctor.languages.join(", ")}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
