"use client";

import { useState } from "react";
import { CreditCard, MessageCircle, Calendar, Save, Edit, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { clinicConfig } from "@/config/clinic.config";

interface PaymentSettings {
  currency: string;
  methods: { name: string; enabled: boolean }[];
  cmiMerchantId: string;
  cmiSecretKey: string;
}

interface BookingRules {
  slotDuration: number;
  bufferTime: number;
  maxAdvanceDays: number;
  maxPerSlot: number;
  cancellationHours: number;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  label: string;
  enabled: boolean;
  template: string;
}

const defaultTemplates: WhatsAppTemplate[] = [
  {
    id: "t1",
    name: "booking_confirmation",
    label: "Booking Confirmation",
    enabled: true,
    template: "Hello {{patient_name}}, your appointment with {{doctor_name}} is confirmed for {{date}} at {{time}}. Reply CANCEL to cancel.",
  },
  {
    id: "t2",
    name: "appointment_reminder",
    label: "Appointment Reminder",
    enabled: true,
    template: "Reminder: You have an appointment with {{doctor_name}} tomorrow at {{time}}. {{clinic_name}} — {{clinic_address}}",
  },
  {
    id: "t3",
    name: "cancellation_notice",
    label: "Cancellation Notice",
    enabled: true,
    template: "Your appointment with {{doctor_name}} on {{date}} at {{time}} has been cancelled. Please contact us to reschedule.",
  },
  {
    id: "t4",
    name: "follow_up",
    label: "Follow-up Message",
    enabled: false,
    template: "Hello {{patient_name}}, we hope you are feeling better. It's time for your follow-up visit. Book now at {{booking_url}}.",
  },
  {
    id: "t5",
    name: "no_show",
    label: "No-show Notification",
    enabled: false,
    template: "Hello {{patient_name}}, we noticed you missed your appointment on {{date}}. Would you like to reschedule? Contact us at {{clinic_phone}}.",
  },
];

export default function ClinicSettingsPage() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    currency: clinicConfig.currency,
    methods: [
      { name: "Cash", enabled: true },
      { name: "Card", enabled: true },
      { name: "Insurance", enabled: true },
      { name: "Online Transfer", enabled: false },
    ],
    cmiMerchantId: "",
    cmiSecretKey: "",
  });

  const [bookingRules, setBookingRules] = useState<BookingRules>({
    slotDuration: clinicConfig.booking.slotDuration,
    bufferTime: clinicConfig.booking.bufferTime,
    maxAdvanceDays: clinicConfig.booking.maxAdvanceDays,
    maxPerSlot: clinicConfig.booking.maxPerSlot,
    cancellationHours: clinicConfig.booking.cancellationHours,
  });

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(defaultTemplates);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const handleSave = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const togglePaymentMethod = (name: string) => {
    setPaymentSettings({
      ...paymentSettings,
      methods: paymentSettings.methods.map((m) =>
        m.name === name ? { ...m, enabled: !m.enabled } : m
      ),
    });
  };

  const toggleTemplate = (id: string) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const updateTemplateText = (id: string, text: string) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, template: text } : t)));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clinic Settings</h1>

      <Tabs defaultValue="payment">
        <TabsList className="mb-6">
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="booking">Booking Rules</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Templates</TabsTrigger>
        </TabsList>

        {/* Payment Settings */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Settings
                </CardTitle>
                <Button size="sm" onClick={() => handleSave("payment")}>
                  <Save className="h-4 w-4 mr-1" />
                  {savedSection === "payment" ? "Saved!" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Input
                      value={paymentSettings.currency}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, currency: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Accepted Payment Methods</Label>
                  {paymentSettings.methods.map((method) => (
                    <div key={method.name} className="flex items-center justify-between border rounded-lg p-3">
                      <span className="text-sm font-medium">{method.name}</span>
                      <div className="flex items-center gap-2">
                        <Switch checked={method.enabled} onCheckedChange={() => togglePaymentMethod(method.name)} />
                        <Badge variant={method.enabled ? "default" : "secondary"}>
                          {method.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">CMI Payment Gateway (Optional)</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Merchant ID</Label>
                      <Input
                        placeholder="Enter CMI Merchant ID"
                        value={paymentSettings.cmiMerchantId}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, cmiMerchantId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Secret Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter CMI Secret Key"
                        value={paymentSettings.cmiSecretKey}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, cmiSecretKey: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Rules */}
        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Booking Rules
                </CardTitle>
                <Button size="sm" onClick={() => handleSave("booking")}>
                  <Save className="h-4 w-4 mr-1" />
                  {savedSection === "booking" ? "Saved!" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Slot Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={bookingRules.slotDuration}
                    onChange={(e) => setBookingRules({ ...bookingRules, slotDuration: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buffer Time Between Slots (minutes)</Label>
                  <Input
                    type="number"
                    value={bookingRules.bufferTime}
                    onChange={(e) => setBookingRules({ ...bookingRules, bufferTime: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Advance Booking (days)</Label>
                  <Input
                    type="number"
                    value={bookingRules.maxAdvanceDays}
                    onChange={(e) => setBookingRules({ ...bookingRules, maxAdvanceDays: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Patients Per Slot</Label>
                  <Input
                    type="number"
                    value={bookingRules.maxPerSlot}
                    onChange={(e) => setBookingRules({ ...bookingRules, maxPerSlot: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Cancellation Policy
                </h4>
                <div className="space-y-2 max-w-xs">
                  <Label>Minimum Hours Before Appointment to Cancel</Label>
                  <Input
                    type="number"
                    value={bookingRules.cancellationHours}
                    onChange={(e) => setBookingRules({ ...bookingRules, cancellationHours: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Patients must cancel at least {bookingRules.cancellationHours} hours before their appointment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Templates */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Notification Templates
                </CardTitle>
                <Button size="sm" onClick={() => handleSave("whatsapp")}>
                  <Save className="h-4 w-4 mr-1" />
                  {savedSection === "whatsapp" ? "Saved!" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Customize the message templates sent via WhatsApp. Use placeholders like{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{patient_name}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{doctor_name}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{date}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{time}}"}</code>.
              </p>
              <div className="space-y-4">
                {templates.map((t) => (
                  <div key={t.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.label}</span>
                        <Badge variant={t.enabled ? "default" : "secondary"}>
                          {t.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={t.enabled} onCheckedChange={() => toggleTemplate(t.id)} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate(editingTemplate === t.id ? null : t.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingTemplate === t.id ? (
                      <Textarea
                        value={t.template}
                        onChange={(e) => updateTemplateText(t.id, e.target.value)}
                        className="min-h-[100px]"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">{t.template}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
