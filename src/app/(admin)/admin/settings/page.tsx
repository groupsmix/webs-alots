"use client";

import { useState } from "react";
import { CreditCard, MessageCircle, Calendar, Save, Edit, Ban, Building2, Phone, MapPin, Globe, RefreshCw, Languages, Monitor, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { clinicConfig } from "@/config/clinic.config";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface PaymentSettings {
  currency: string;
  methods: { name: string; enabled: boolean }[];
  cmiMerchantId: string;
  cmiSecretKey: string;
}

interface ClinicProfile {
  name: string;
  type: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  googleMapsUrl: string;
  website: string;
}

interface BookingRules {
  slotDuration: number;
  bufferTime: number;
  maxAdvanceDays: number;
  maxPerSlot: number;
  cancellationHours: number;
  allowRescheduling: boolean;
  rescheduleHours: number;
  autoConfirm: boolean;
  noShowPolicy: string;
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
  {
    id: "t6",
    name: "prescription_ready",
    label: "Prescription Ready",
    enabled: true,
    template: "Hello {{patient_name}}, your prescription from {{doctor_name}} is ready. You can collect it at {{clinic_name}} or view it online.",
  },
  {
    id: "t7",
    name: "payment_receipt",
    label: "Payment Receipt",
    enabled: false,
    template: "Payment received: {{amount}} {{currency}} for your visit with {{doctor_name}} on {{date}}. Thank you! — {{clinic_name}}",
  },
  {
    id: "t8",
    name: "waitlist_available",
    label: "Waitlist Availability",
    enabled: false,
    template: "Good news {{patient_name}}! A slot has opened with {{doctor_name}} on {{date}} at {{time}}. Reply YES to book or it will be offered to the next patient.",
  },
];

export default function ClinicSettingsPage() {
  const [clinicProfile, setClinicProfile] = useState<ClinicProfile>({
    name: clinicConfig.name,
    type: clinicConfig.type,
    phone: clinicConfig.contact.phone || "",
    whatsapp: clinicConfig.contact.whatsapp || "",
    email: clinicConfig.contact.email || "",
    address: clinicConfig.contact.address || "",
    city: clinicConfig.contact.city || "",
    googleMapsUrl: clinicConfig.contact.googleMapsUrl || "",
    website: clinicConfig.domain || "",
  });

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
    allowRescheduling: true,
    rescheduleHours: 12,
    autoConfirm: false,
    noShowPolicy: "Patient will be marked as no-show if they do not arrive within 15 minutes of their appointment time.",
  });

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(defaultTemplates);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [patientMessageLocale, setPatientMessageLocale] = useState<"fr" | "ar" | "darija">("fr");
  const [kioskModeEnabled, setKioskModeEnabled] = useState(false);
  const [googlePlaceId, setGooglePlaceId] = useState("");

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
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Settings" }]} />
      <h1 className="text-2xl font-bold mb-6">Clinic Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="profile">Clinic Profile</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="booking">Booking Rules</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Templates</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {/* Clinic Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Clinic Profile
                </CardTitle>
                <Button size="sm" onClick={() => handleSave("profile")}>
                  <Save className="h-4 w-4 mr-1" />
                  {savedSection === "profile" ? "Saved!" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Clinic Name</Label>
                    <Input
                      value={clinicProfile.name}
                      onChange={(e) => setClinicProfile({ ...clinicProfile, name: e.target.value })}
                      placeholder="My Clinic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Clinic Type</Label>
                    <select
                      value={clinicProfile.type}
                      onChange={(e) => setClinicProfile({ ...clinicProfile, type: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="doctor">Doctor / General Practice</option>
                      <option value="dentist">Dentist / Dental Clinic</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Information
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        value={clinicProfile.phone}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, phone: e.target.value })}
                        placeholder="+212 6 00 00 00 00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Number</Label>
                      <Input
                        value={clinicProfile.whatsapp}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, whatsapp: e.target.value })}
                        placeholder="+212 6 00 00 00 00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={clinicProfile.email}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, email: e.target.value })}
                        placeholder="contact@clinic.ma"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Website / Domain</Label>
                      <Input
                        value={clinicProfile.website}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, website: e.target.value })}
                        placeholder="www.myclinic.ma"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={clinicProfile.address}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, address: e.target.value })}
                        placeholder="123 Rue Example, Quartier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={clinicProfile.city}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, city: e.target.value })}
                        placeholder="Casablanca"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Google Maps URL</Label>
                      <Input
                        value={clinicProfile.googleMapsUrl}
                        onChange={(e) => setClinicProfile({ ...clinicProfile, googleMapsUrl: e.target.value })}
                        placeholder="https://maps.google.com/..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Allow Rescheduling</Label>
                      <Switch
                        checked={bookingRules.allowRescheduling}
                        onCheckedChange={(checked) => setBookingRules({ ...bookingRules, allowRescheduling: checked })}
                      />
                    </div>
                    {bookingRules.allowRescheduling && (
                      <div className="space-y-2 mt-2">
                        <Label>Min Hours Before Appointment to Reschedule</Label>
                        <Input
                          type="number"
                          value={bookingRules.rescheduleHours}
                          onChange={(e) => setBookingRules({ ...bookingRules, rescheduleHours: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Additional Policies
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <span className="text-sm font-medium">Auto-confirm Bookings</span>
                      <p className="text-xs text-muted-foreground">Automatically confirm new appointments without manual approval</p>
                    </div>
                    <Switch
                      checked={bookingRules.autoConfirm}
                      onCheckedChange={(checked) => setBookingRules({ ...bookingRules, autoConfirm: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>No-show Policy</Label>
                    <Textarea
                      value={bookingRules.noShowPolicy}
                      onChange={(e) => setBookingRules({ ...bookingRules, noShowPolicy: e.target.value })}
                      className="min-h-[80px]"
                    />
                  </div>
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
              {/* Patient Message Locale Preference */}
              <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Languages className="h-4 w-4" />
                  <h4 className="text-sm font-medium">Patient Message Language</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose the language for patient-facing WhatsApp notifications. Darija (Moroccan Arabic) is recommended for higher engagement.
                </p>
                <select
                  value={patientMessageLocale}
                  onChange={(e) => setPatientMessageLocale(e.target.value as "fr" | "ar" | "darija")}
                  className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="fr">Fran\u00e7ais (French)</option>
                  <option value="ar">\u0627\u0644\u0639\u0631\u0628\u064a\u0629 (Arabic)</option>
                  <option value="darija">\u0627\u0644\u062f\u0627\u0631\u062c\u0629 (Darija / Moroccan Arabic)</option>
                </select>
              </div>

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
        {/* Features (Kiosk Mode & Google Reviews) */}
        <TabsContent value="features">
          <div className="space-y-6">
            {/* Kiosk Mode */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Patient Self-Check-In Kiosk
                  </CardTitle>
                  <Button size="sm" onClick={() => handleSave("features")}>
                    <Save className="h-4 w-4 mr-1" />
                    {savedSection === "features" ? "Saved!" : "Save"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <span className="text-sm font-medium">Enable Kiosk Mode</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        When enabled, patients can self-check-in using a tablet at your clinic entrance.
                        Access via <code className="bg-muted px-1 rounded text-xs">/checkin</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={kioskModeEnabled}
                        onCheckedChange={setKioskModeEnabled}
                      />
                      <Badge variant={kioskModeEnabled ? "default" : "secondary"}>
                        {kioskModeEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  {kioskModeEnabled && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Kiosk mode is active. Set up a tablet at your clinic entrance and open the
                        <code className="bg-blue-100 px-1 mx-1 rounded text-xs">/checkin</code>
                        page in full-screen mode. Patients can enter their phone number to check in.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Google Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Google Reviews Automation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    After appointments, patients receive a WhatsApp message asking to rate their experience.
                    Positive ratings (4-5 stars) are redirected to leave a Google Review.
                  </p>
                  <div className="space-y-2">
                    <Label>Google Place ID</Label>
                    <Input
                      value={googlePlaceId}
                      onChange={(e) => setGooglePlaceId(e.target.value)}
                      placeholder="ChIJxxxxxxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Find your Place ID at{" "}
                      <a
                        href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Google Place ID Finder
                      </a>
                      . This is used to generate the review link sent to happy patients.
                    </p>
                  </div>
                  {googlePlaceId && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-800">
                        Review link preview:{" "}
                        <code className="bg-green-100 px-1 rounded">
                          https://search.google.com/local/writereview?placeid={googlePlaceId}
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
