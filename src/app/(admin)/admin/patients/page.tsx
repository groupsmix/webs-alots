"use client";

import { useState } from "react";
import { Search, User, Phone, Mail, Calendar, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { patients, appointments } from "@/lib/demo-data";

export default function AdminPatientDatabasePage() {
  const [search, setSearch] = useState("");

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Patient Database</h1>
        <Badge variant="outline">{patients.length} patients</Badge>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((patient) => {
          const patientAppts = appointments.filter((a) => a.patientId === patient.id);
          const lastVisit = patientAppts.find((a) => a.status === "completed");
          return (
            <Card key={patient.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{patient.name}</p>
                    <div className="space-y-1 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {patient.email}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Age: {patient.age} | {patient.gender === "M" ? "Male" : "Female"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {patient.insurance && (
                        <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                          <Shield className="h-2.5 w-2.5" />
                          {patient.insurance}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {patientAppts.length} visits
                      </Badge>
                    </div>
                    {lastVisit && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Last visit: {lastVisit.date}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs">View Profile</Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs">Book Appt</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No patients found matching &quot;{search}&quot;</p>
        </div>
      )}
    </div>
  );
}
