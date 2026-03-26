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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  createClinic,
  createUser,
  createService,
  createTimeSlotsForDoctor,
  type CreateUserInput,
  type CreateServiceInput,
} from "@/lib/super-admin-actions";
import { STAFF_DEFAULT_PASSWORD } from "@/lib/constants";
import {
  OnboardingStepClinic,
  type ClinicFormData,
} from "@/components/super-admin/onboarding-step-clinic";
import {
  OnboardingStepStaff,
  type UserFormData,
} from "@/components/super-admin/onboarding-step-staff";
import {
  OnboardingStepServices,
  type ServiceFormData,
} from "@/components/super-admin/onboarding-step-services";
import {
  OnboardingStepTimeSlots,
  type DoctorTimeSlots,
  type TimeSlotFormData,
} from "@/components/super-admin/onboarding-step-timeslots";

// ---------- Constants ----------

const STEPS = [
  { id: 1, label: "Create Clinic", icon: Building2 },
  { id: 2, label: "Add Staff", icon: Users },
  { id: 3, label: "Add Services", icon: Stethoscope },
  { id: 4, label: "Time Slots", icon: Clock },
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
    subdomain: "",
    domain: "",
  });
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null);
  const [subdomainManuallyEdited, setSubdomainManuallyEdited] = useState(false);

  // Step 2: Users
  const [users, setUsers] = useState<UserFormData[]>([
    { role: "clinic_admin", name: "", phone: "", email: "" },
  ]);
  const [createdUsers, setCreatedUsers] = useState<
    { id: string; name: string; role: string; email?: string }[]
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
    setClinicForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate subdomain from clinic name if subdomain hasn't been manually edited
      if (field === "name" && !subdomainManuallyEdited) {
        next.subdomain = value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/--+/g, "-");
      }
      return next;
    });
    if (field === "subdomain") {
      setSubdomainManuallyEdited(true);
    }
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
    if (!clinicForm.subdomain.trim()) {
      setError("Subdomain is required — the clinic needs a URL to be accessible");
      return;
    }
    // Validate subdomain format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(clinicForm.subdomain)) {
      setError("Subdomain must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)");
      return;
    }
    // Validate email format if provided
    if (clinicForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clinicForm.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const clinic = await createClinic({
        name: clinicForm.name,
        type: clinicForm.type,
        tier: clinicForm.tier,
        subdomain: clinicForm.subdomain || undefined,
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

    // Validate email format for users who provided an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const u of validUsers) {
      if (u.email && !emailRegex.test(u.email)) {
        setError(`Invalid email for "${u.name}": ${u.email}. Please enter a valid email address or leave it empty.`);
        return;
      }
    }

    // Require at least one clinic_admin
    if (!validUsers.some((u) => u.role === "clinic_admin")) {
      setError("At least one staff member must have the Clinic Admin (Owner) role");
      return;
    }

    // Require email for all clinic_admin users — they need login credentials
    const adminsWithoutEmail = validUsers.filter((u) => u.role === "clinic_admin" && !u.email?.trim());
    if (adminsWithoutEmail.length > 0) {
      setError(`Email is required for Clinic Admin "${adminsWithoutEmail[0].name || "(unnamed)"}" — they need an email to log in.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created: { id: string; name: string; role: string; email?: string }[] = [];
      for (const u of validUsers) {
        const input: CreateUserInput = {
          clinic_id: createdClinicId,
          role: u.role,
          name: u.name,
          phone: u.phone || undefined,
          email: u.email || undefined,
        };
        const user = await createUser(input);
        created.push({ id: user.id, name: user.name, role: user.role, email: user.email ?? undefined });
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
            {/* Staff Login Credentials */}
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm mb-6">
              <h3 className="font-semibold mb-3">Staff Login Credentials:</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Role</th>
                      <th className="text-left py-2 pr-4 font-medium">Name</th>
                      <th className="text-left py-2 pr-4 font-medium">Email (Login)</th>
                      <th className="text-left py-2 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {createdUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 capitalize">{u.role.replace("_", " ")}</td>
                        <td className="py-2 pr-4">{u.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {u.email ? (
                            u.email
                          ) : (
                            <span className="text-amber-600 italic">No email — cannot log in</span>
                          )}
                        </td>
                        <td className="py-2 font-mono text-xs">
                          {u.email ? STAFF_DEFAULT_PASSWORD : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {createdUsers.some((u) => u.email) && (
                <p className="text-xs text-amber-600 mt-3 font-medium">
                  Important: Please change the default passwords after first login.
                </p>
              )}
              {createdUsers.some((u) => !u.email) && (
                <p className="text-xs text-destructive mt-2">
                  Staff without email cannot log in. Edit their profile in Admin to add an email and enable access.
                </p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm mb-6">
              <h3 className="font-semibold mb-2">Clinic is Live:</h3>
              <div className="space-y-2 text-muted-foreground">
                {clinicForm.subdomain && (
                  <p>
                    Clinic URL:{" "}
                    <a
                      href={`https://${clinicForm.subdomain}.oltigo.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline font-mono"
                    >
                      {clinicForm.subdomain}.oltigo.com
                    </a>
                  </p>
                )}
                <p>The clinic is automatically accessible — no deployment needed.</p>
                {clinicForm.subdomain && (
                  <p>
                    Staff can log in at{" "}
                    <a
                      href={`https://${clinicForm.subdomain}.oltigo.com/login`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline font-mono"
                    >
                      {clinicForm.subdomain}.oltigo.com/login
                    </a>
                    {" "}using the credentials above.
                  </p>
                )}
                <p>Branding, colors, and website content can be customized from <strong>Admin → Branding</strong>.</p>
              </div>
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

      {/* Step Forms */}
      {step === 1 && (
        <OnboardingStepClinic
          clinicForm={clinicForm}
          loading={loading}
          onUpdateField={updateClinicField}
          onSubmit={handleStep1}
        />
      )}

      {step === 2 && (
        <OnboardingStepStaff
          users={users}
          loading={loading}
          onAddUser={addUser}
          onRemoveUser={removeUser}
          onUpdateUser={updateUser}
          onBack={() => setStep(1)}
          onSubmit={handleStep2}
        />
      )}

      {step === 3 && (
        <OnboardingStepServices
          services={services}
          loading={loading}
          onAddService={addService}
          onRemoveService={removeService}
          onUpdateService={updateService}
          onBack={() => setStep(2)}
          onSubmit={handleStep3}
        />
      )}

      {step === 4 && (
        <OnboardingStepTimeSlots
          doctorSlots={doctorSlots}
          loading={loading}
          onAddSlot={addSlotToDoctor}
          onRemoveSlot={removeSlotFromDoctor}
          onUpdateSlot={updateSlot}
          onBack={() => setStep(3)}
          onSkip={handleSkipTimeSlots}
          onSubmit={handleStep4}
        />
      )}
    </div>
  );
}
