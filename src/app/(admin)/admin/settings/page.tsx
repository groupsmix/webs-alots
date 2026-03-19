import { Clock, CreditCard, MessageCircle, Calendar, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clinicConfig } from "@/config/clinic.config";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ClinicSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clinic Settings</h1>

      <div className="space-y-6">
        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dayNames.map((day, i) => {
                const wh = clinicConfig.workingHours[i];
                return (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium">{day}</span>
                    <Badge variant={wh.enabled ? "default" : "secondary"}>
                      {wh.enabled ? "Open" : "Closed"}
                    </Badge>
                    {wh.enabled && (
                      <span className="text-sm text-muted-foreground">{wh.open} - {wh.close}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="mt-4">Edit Working Hours</Button>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input value="MAD" readOnly />
              </div>
              <div className="space-y-2">
                <Label>Payment Methods</Label>
                <div className="flex gap-2">
                  <Badge>Cash</Badge>
                  <Badge>Card</Badge>
                  <Badge variant="outline">Insurance</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Booking Confirmations</span>
                <Badge variant="success">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Appointment Reminders</span>
                <Badge variant="success">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cancellation Notices</span>
                <Badge variant="success">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Follow-up Messages</span>
                <Badge variant="secondary">Disabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Booking Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Slot Duration (minutes)</Label>
                <Input type="number" value={clinicConfig.booking.slotDuration} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Buffer Time (minutes)</Label>
                <Input type="number" value={clinicConfig.booking.bufferTime} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Max Advance Booking (days)</Label>
                <Input type="number" value={clinicConfig.booking.maxAdvanceDays} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Max Patients Per Slot</Label>
                <Input type="number" value={clinicConfig.booking.maxPerSlot} readOnly />
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4">Edit Booking Rules</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
