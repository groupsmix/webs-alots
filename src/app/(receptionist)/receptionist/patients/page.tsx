"use client";

import { useState, useEffect } from "react";
import { Search, Phone, MessageCircle, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser, fetchPatients, type PatientView } from "@/lib/data/client";
import { PatientRegistrationDialog } from "@/components/receptionist/patient-registration-dialog";

export default function ReceptionistPatientsPage() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.clinic_id) { setLoading(false); return; }
      const data = await fetchPatients(user.clinic_id);
      setPatients(data);
      setLoading(false);
    }
    load();
  }, []);

  const filteredPatients = patients.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.phone.toLowerCase().includes(query)
    );
  });

  const handleCheckIn = (id: string) => {
    setCheckedInIds((prev) => new Set(prev).add(id));
  };

  const handleCallPatient = (phone: string) => {
    window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "").replace("+", "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading patients...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Patient Registration</h1>
        <PatientRegistrationDialog />
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patients by name, phone, or CIN..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredPatients.map((patient) => {
          const isCheckedIn = checkedInIds.has(patient.id);
          return (
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
                  {isCheckedIn ? (
                    <Badge variant="success" className="text-xs">Checked In</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleCheckIn(patient.id)} title="Check In">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mr-1" />
                      Check In
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleCallPatient(patient.phone)} title="Call">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredPatients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No patients found matching &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
}
