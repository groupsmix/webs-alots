"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Stethoscope,
  Clock,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  createClinic,
  createUser,
  createService,
  createTimeSlotsForDoctor,
  type CreateUserInput,
  type CreateServiceInput,
} from "@/lib/super-admin-actions";

// ---------- Types ----------

interface ClinicFormData {
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  tier: "vitrine" | "cabinet" | "pro" | "premium" | "saas";
  city: string;
  phone: string;
  email: string;
  address: string;
  specialty: string;
  domain: string;
}

interface UserFormData {
  role: "clinic_admin" | "receptionist" | "doctor";
  name: string;
  phone: string;
  email: string;
}

interface ServiceFormData {
  name: string;
  price: string;
  duration_minutes: string;
  category: string;
}

interface TimeSlotFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: string;
  buffer_minutes: string;
}

interface DoctorTimeSlots {
  doctorId: string;
  doctorName: string;
  slots: TimeSlotFormData[];
}

// ---------- Constants ----------

const STEPS = [
  { id: 1, label: "Create Clinic", icon: Building2 },
  { id: 2, label: "Add Staff", icon: Users },
  { id: 3, label: "Add Services", icon: Stethoscope },
  { id: 4, label: "Time Slots", icon: Clock },
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_SLOT: TimeSlotFormData = {
  day_of_week: 1,
  start_time: "09:00",
  end_time: "12:00",
  max_capacity: "1",
  buffer_minutes: "10",
};

// ---------- Component ----------

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Clinic
  const [clinicForm, setClinicForm] = useState<ClinicFormData>({
    name: "",
    type: "doctor",
    tier: "pro",
    city: "",
    phone: "",
    email: "",
    address: "",
    specialty: "",
    domain: "",
  });
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null);

  // Step 2: Users
  const [users, setUsers] = useState<UserFormData[]>([
    { role: "clinic_admin", name: "", phone: "", email: "" },
  ]);
  const [createdUsers, setCreatedUsers] = useState<
    { id: string; name: string; role: string }[]
  >([]);

  // Step 3: Services
  const [services, setServices] = useState<ServiceFormData[]>([
    { name: "", price: "", duration_minutes: "30", category: "consultation" },
  ]);

  // Step 4: Time Slots
  const [doctorSlots, setDoctorSlots] = useState<DoctorTimeSlots[]>([]);

  // Completion
  const [completed, setCompleted] = useState(false);

  // ---------- Handlers ----------

  function updateClinicField(field: keyof ClinicFormData, value: string) {
    setClinicForm((prev) => ({ ...prev, [field]: value }));
  }

  function addUser() {
    setUsers((prev) => [
      ...prev,
      { role: "doctor", name: "", phone: "", email: "" },
    ]);
  }

  function removeUser(index: number) {
    setUsers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUser(
    index: number,
    field: keyof UserFormData,
    value: string,
  ) {
    setUsers((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)),
    );
  }

  function addService() {
    setServices((prev) => [
      ...prev,
      { name: "", price: "", duration_minutes: "30", category: "consultation" },
    ]);
  }

  function removeService(index: number) {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

  function updateService(
    index: number,
    field: keyof ServiceFormData,
    value: string,
  ) {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  function addSlotToDoctor(doctorIndex: number) {
    setDoctorSlots((prev) =>
      prev.map((d, i) =>
        i === doctorIndex
          ? { ...d, slots: [...d.slots, { ...DEFAULT_SLOT }] }
          : d,
      ),
    );
  }

  function removeSlotFromDoctor(doctorIndex: number, slotIndex: number) {
    setDoctorSlots((prev) =>
      prev.map((d, i) =>
        i === doctorIndex
          ? { ...d, slots: d.slots.filter((_, si) => si !== slotIndex) }
          : d,
      ),
    );
  }

  function updateSlot(
    doctorIndex: number,
    slotIndex: number,
    field: keyof TimeSlotFormData,
    value: string | number,
  ) {
    setDoctorSlots((prev) =>
      prev.map((d, i) =>
        i === doctorIndex
          ? {
              ...d,
              slots: d.slots.map((s, si) =>
                si === slotIndex ? { ...s, [field]: value } : s,
              ),
            }
          : d,
      ),
    );
  }

  // ---------- Step Submission ----------

  async function handleStep1() {
    if (!clinicForm.name.trim()) {
      setError("Clinic name is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const clinic = await createClinic({
        name: clinicForm.name,
        type: clinicForm.type,
        tier: clinicForm.tier,
        config: {
          locale: "fr",
          currency: "MAD",
          city: clinicForm.city,
          phone: clinicForm.phone,
          email: clinicForm.email,
          address: clinicForm.address,
          specialty: clinicForm.specialty,
          domain: clinicForm.domain,
        },
      });
      setCreatedClinicId(clinic.id);
      setStep(2);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create clinic",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    const validUsers = users.filter((u) => u.name.trim());
    if (validUsers.length === 0) {
      setError("Add at least one staff member");
      return;
    }
    if (!createdClinicId) {
      setError("No clinic created yet. Go back to Step 1.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created: { id: string; name: string; role: string }[] = [];
      for (const u of validUsers) {
        const input: CreateUserInput = {
          clinic_id: createdClinicId,
          role: u.role,
          name: u.name,
          phone: u.phone || undefined,
          email: u.email || undefined,
        };
        const user = await createUser(input);
        created.push({ id: user.id, name: user.name, role: user.role });
      }
      setCreatedUsers(created);

      // Pre-populate doctor time slots for step 4
      const doctors = created.filter((u) => u.role === "doctor" || u.role === "clinic_admin");
      setDoctorSlots(
        doctors.map((d) => ({
          doctorId: d.id,
          doctorName: d.name,
          slots: [
            { day_of_week: 1, start_time: "09:00", end_time: "12:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 1, start_time: "14:00", end_time: "17:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 2, start_time: "09:00", end_time: "12:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 2, start_time: "14:00", end_time: "17:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 3, start_time: "09:00", end_time: "12:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 3, start_time: "14:00", end_time: "17:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 4, start_time: "09:00", end_time: "12:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 4, start_time: "14:00", end_time: "17:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 5, start_time: "09:00", end_time: "12:00", max_capacity: "1", buffer_minutes: "10" },
            { day_of_week: 5, start_time: "14:00", end_time: "17:00", max_capacity: "1", buffer_minutes: "10" },
          ],
        })),
      );

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create users");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep3() {
    const validServices = services.filter((s) => s.name.trim());
    if (validServices.length === 0) {
      setError("Add at least one service");
      return;
    }
    if (!createdClinicId) {
      setError("No clinic created yet.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      for (const s of validServices) {
        const input: CreateServiceInput = {
          clinic_id: createdClinicId,
          name: s.name,
          price: s.price ? parseFloat(s.price) : undefined,
          duration_minutes: parseInt(s.duration_minutes) || 30,
          category: s.category || undefined,
        };
        await createService(input);
      }
      setStep(4);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create services",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStep4() {
    if (!createdClinicId) {
      setError("No clinic created yet.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      for (const doctor of doctorSlots) {
        if (doctor.slots.length === 0) continue;
        await createTimeSlotsForDoctor(
          doctor.doctorId,
          createdClinicId,
          doctor.slots.map((s) => ({
            day_of_week: typeof s.day_of_week === "string" ? parseInt(s.day_of_week as string) : s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            max_capacity: parseInt(s.max_capacity) || 1,
            buffer_minutes: parseInt(s.buffer_minutes) || 10,
          })),
        );
      }
      setCompleted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create time slots",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSkipTimeSlots() {
    setCompleted(true);
  }

  // ---------- Render ----------

  if (completed) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Client Onboarded!</h2>
            <p className="text-muted-foreground mb-2">
              <strong>{clinicForm.name}</strong> has been successfully set up.
            </p>
            <div className="text-sm text-muted-foreground space-y-1 mb-6">
              <p>Clinic ID: <code className="bg-muted px-2 py-0.5 rounded text-xs">{createdClinicId}</code></p>
              <p>{createdUsers.length} staff member(s) created</p>
              <p>{services.filter((s) => s.name.trim()).length} service(s) added</p>
            </div>
            <Separator className="my-6" />
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm mb-6">
              <h3 className="font-semibold mb-2">Next Steps:</h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Edit <code>src/config/clinic.config.ts</code> with the clinic ID above</li>
                <li>Customize <code>src/config/theme.config.ts</code> with brand colors</li>
                <li>Update <code>src/lib/website-config.ts</code> with website content</li>
                <li>Create a git branch: <code>client/{clinicForm.name.toLowerCase().replace(/\s+/g, "-")}</code></li>
                <li>Deploy to Cloudflare Pages</li>
              </ol>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/super-admin/clinics">
                <Button variant="outline">View All Clinics</Button>
              </Link>
              <Button onClick={() => window.location.reload()}>
                <Plus className="h-4 w-4 mr-1" />
                Onboard Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Client Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up a new clinic in your Supabase database — no SQL needed
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-px w-8 mx-2 ${
                  step > s.id - 1 ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                step === s.id
                  ? "bg-primary text-primary-foreground"
                  : step > s.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <s.icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Step 1: Create Clinic */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Step 1: Create Clinic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Clinic Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Cabinet Dr. Sara Tazi"
                  value={clinicForm.name}
                  onChange={(e) => updateClinicField("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Clinic Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={clinicForm.type}
                  onChange={(e) => updateClinicField("type", e.target.value)}
                >
                  <option value="doctor">Doctor</option>
                  <option value="dentist">Dentist</option>
                  <option value="pharmacy">Pharmacy</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subscription Tier</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={clinicForm.tier}
                  onChange={(e) => updateClinicField("tier", e.target.value)}
                >
                  <option value="vitrine">Vitrine — 2,500-3,000 MAD</option>
                  <option value="cabinet">Cabinet — 6,000-8,000 MAD</option>
                  <option value="pro">Pro — 12,000-15,000 MAD</option>
                  <option value="premium">Premium — 20,000-25,000 MAD</option>
                  <option value="saas">SaaS Monthly — 500-1,000 MAD/mo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  placeholder="e.g. Dermatology, General Medicine"
                  value={clinicForm.specialty}
                  onChange={(e) =>
                    updateClinicField("specialty", e.target.value)
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+212 5 37 XX XX XX"
                  value={clinicForm.phone}
                  onChange={(e) => updateClinicField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="contact@clinic.ma"
                  value={clinicForm.email}
                  onChange={(e) => updateClinicField("email", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="e.g. Rabat"
                  value={clinicForm.city}
                  onChange={(e) => updateClinicField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Domain (optional)</Label>
                <Input
                  placeholder="e.g. dr-sara.ma"
                  value={clinicForm.domain}
                  onChange={(e) => updateClinicField("domain", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="45 Avenue Hassan II, Rabat"
                value={clinicForm.address}
                onChange={(e) => updateClinicField("address", e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleStep1} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create Clinic & Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Staff */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Step 2: Add Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add the clinic owner (admin), doctors, and receptionists.
              At least one clinic_admin is required.
            </p>

            {users.map((user, index) => (
              <div
                key={index}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">
                    Staff #{index + 1}
                  </Badge>
                  {users.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeUser(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={user.role}
                      onChange={(e) =>
                        updateUser(index, "role", e.target.value)
                      }
                    >
                      <option value="clinic_admin">
                        Clinic Admin (Owner)
                      </option>
                      <option value="doctor">Doctor</option>
                      <option value="receptionist">Receptionist</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Dr. Sara Tazi"
                      value={user.name}
                      onChange={(e) =>
                        updateUser(index, "name", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="+212 6 XX XX XX XX"
                      value={user.phone}
                      onChange={(e) =>
                        updateUser(index, "phone", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="sara@clinic.ma"
                      value={user.email}
                      onChange={(e) =>
                        updateUser(index, "email", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addUser}>
              <Plus className="h-4 w-4 mr-1" />
              Add Another Staff Member
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleStep2} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Staff & Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Add Services */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Step 3: Add Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add the services this clinic offers (consultations, treatments, etc.)
            </p>

            {services.map((service, index) => (
              <div
                key={index}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Service #{index + 1}</Badge>
                  {services.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeService(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>
                      Service Name{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Consultation Générale"
                      value={service.name}
                      onChange={(e) =>
                        updateService(index, "name", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={service.category}
                      onChange={(e) =>
                        updateService(index, "category", e.target.value)
                      }
                    >
                      <option value="consultation">Consultation</option>
                      <option value="treatment">Treatment</option>
                      <option value="follow-up">Follow-up</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="screening">Screening</option>
                      <option value="vaccination">Vaccination</option>
                      <option value="dental">Dental</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Price (MAD)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 400"
                      value={service.price}
                      onChange={(e) =>
                        updateService(index, "price", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={service.duration_minutes}
                      onChange={(e) =>
                        updateService(
                          index,
                          "duration_minutes",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addService}>
              <Plus className="h-4 w-4 mr-1" />
              Add Another Service
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleStep3} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Services & Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Time Slots */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Step 4: Configure Time Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {doctorSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No doctors were added in Step 2. You can skip this step or go
                  back to add doctors.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Add Staff
                  </Button>
                  <Button onClick={handleSkipTimeSlots}>
                    Skip & Finish
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Configure weekly availability for each doctor. Default is
                  Mon-Fri 9-12 &amp; 14-17. Adjust as needed.
                </p>

                {doctorSlots.map((doctor, dIndex) => (
                  <div key={doctor.doctorId} className="space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {doctor.doctorName}
                    </h3>

                    <div className="space-y-2 pl-2">
                      {doctor.slots.map((slot, sIndex) => (
                        <div
                          key={sIndex}
                          className="flex items-center gap-2 flex-wrap"
                        >
                          <select
                            className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                            value={slot.day_of_week}
                            onChange={(e) =>
                              updateSlot(
                                dIndex,
                                sIndex,
                                "day_of_week",
                                parseInt(e.target.value),
                              )
                            }
                          >
                            {DAY_NAMES.map((name, i) => (
                              <option key={i} value={i}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="time"
                            className="w-28"
                            value={slot.start_time}
                            onChange={(e) =>
                              updateSlot(
                                dIndex,
                                sIndex,
                                "start_time",
                                e.target.value,
                              )
                            }
                          />
                          <span className="text-muted-foreground text-sm">
                            to
                          </span>
                          <Input
                            type="time"
                            className="w-28"
                            value={slot.end_time}
                            onChange={(e) =>
                              updateSlot(
                                dIndex,
                                sIndex,
                                "end_time",
                                e.target.value,
                              )
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              removeSlotFromDoctor(dIndex, sIndex)
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSlotToDoctor(dIndex)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Slot
                    </Button>

                    {dIndex < doctorSlots.length - 1 && (
                      <Separator />
                    )}
                  </div>
                ))}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSkipTimeSlots}
                    >
                      Skip
                    </Button>
                    <Button onClick={handleStep4} disabled={loading}>
                      {loading && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      Save Slots & Finish
                      <Check className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
