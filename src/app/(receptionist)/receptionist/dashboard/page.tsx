"use client";

import { useState } from "react";
import { Calendar, Users, UserPlus, Clock, CreditCard, FileText, Phone, MessageCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getTodayAppointments, getTotalRevenue, patients } from "@/lib/demo-data";
import { ManualBookingDialog } from "@/components/receptionist/manual-booking-dialog";
import { WalkInDialog } from "@/components/receptionist/walk-in-dialog";
import { PaymentDialog } from "@/components/receptionist/payment-dialog";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function ReceptionistDashboardPage() {
  const todayAppts = getTodayAppointments("d1");
  const checkedIn = todayAppts.filter((a) => a.status === "confirmed" || a.status === "in-progress").length;
  const totalRevenue = getTotalRevenue();

  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());

  const stats = [
    { icon: Calendar, label: "Today's Bookings", value: todayAppts.length.toString(), color: "text-blue-600" },
    { icon: Users, label: "Checked In", value: (checkedIn + checkedInIds.size).toString(), color: "text-green-600" },
    { icon: UserPlus, label: "Walk-ins Today", value: "2", color: "text-purple-600" },
    { icon: CreditCard, label: "Revenue (Month)", value: `${totalRevenue} MAD`, color: "text-orange-600" },
  ];

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reception Dashboard</h1>

      {/* Stats Row */}
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

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <WalkInDialog
          trigger={
            <Button>
              <UserPlus className="h-4 w-4 mr-1" />
              Walk-in Registration
            </Button>
          }
        />
        <ManualBookingDialog
          trigger={
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-1" />
              Manual Booking
            </Button>
          }
        />
        <PaymentDialog
          trigger={
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-1" />
              Collect Payment
            </Button>
          }
        />
        <a href="/receptionist/daily-report">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-1" />
            Daily Report
          </Button>
        </a>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((apt) => {
                  const patient = patients.find((p) => p.id === apt.patientId);
                  const isCheckedIn = checkedInIds.has(apt.id);
                  return (
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
                      <div className="text-right flex items-center gap-2">
                        <p className="text-sm font-medium">{apt.time}</p>
                        <Badge variant={isCheckedIn ? "success" : statusVariant[apt.status]}>
                          {isCheckedIn ? "checked-in" : apt.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {!isCheckedIn && apt.status !== "completed" && apt.status !== "cancelled" && (
                          <Button variant="outline" size="sm" onClick={() => handleCheckIn(apt.id)} title="Check in">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        )}
                        {patient && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCallPatient(patient.phone)} title="Call">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiting Room Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waiting Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkedIn === 0 ? (
              <p className="text-sm text-muted-foreground">No patients in waiting room.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.filter((a) => a.status === "confirmed").map((apt, i) => {
                  const patient = patients.find((p) => p.id === apt.patientId);
                  return (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">Est. wait: ~{(i + 1) * 15}min</p>
                      </div>
                      <div className="flex gap-1">
                        {patient && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCallPatient(patient.phone)} title="Call">
                              <Phone className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(patient.phone)} title="WhatsApp">
                              <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline">Call In</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
