/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Building2,
  Users,
  Stethoscope,
  Clock,
  Check,
  Plus,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  RotateCcw,
  FileText,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  OnboardingStepClinic,
  type ClinicFormData,
} from "@/components/super-admin/onboarding-step-clinic";
import {
  OnboardingStepServices,
  type ServiceFormData,
} from "@/components/super-admin/onboarding-step-services";
import {
  OnboardingStepStaff,
  type UserFormData,
} from "@/components/super-admin/onboarding-step-staff";
import {
  OnboardingStepTimeSlots,
  type DoctorTimeSlots,
  type TimeSlotFormData,
} from "@/components/super-admin/onboarding-step-timeslots";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { STAFF_DEFAULT_PASSWORD } from "@/lib/constants";
import {
  createClinic,
  createUser,
  createService,
  createTimeSlotsForDoctor,
  type CreateUserInput,
  type CreateServiceInput,
} from "@/lib/super-admin-actions";

// ---------- Constants ----------

const STEPS = [
  { id: 1, label: "Créer une clinique", icon: Building2 },
  { id: 2, label: "Add Staff", icon: Users },
  { id: 3, label: "Add Services", icon: Stethoscope },
  { id: 4, label: "Time Slots", icon: Clock },
];

const TOTAL_STEPS = STEPS.length;
const STORAGE_KEY = "oltigo_onboarding_draft";

const DEFAULT_SLOT: TimeSlotFormData = {
  day_of_week: 1,
  start_time: "09:00",
  end_time: "12:00",
  max_capacity: "1",
  buffer_minutes: "10",
};

const DEFAULT_CLINIC_FORM: ClinicFormData = {
  name: "",
  type: "",
  tier: "",
  city: "",
  phone: "",
  email: "",
  address: "",
  specialty: "",
  subdomain: "",
  domain: "",
};

const DEFAULT_USER: UserFormData = { role: "clinic_admin", name: "", phone: "", email: "" };
const DEFAULT_SERVICE: ServiceFormData = {
  name: "",
  price: "",
  duration_minutes: "30",
  category: "consultation",
};

// ---------- Draft Types ----------

interface OnboardingDraft {
  step: number;
  clinicForm: ClinicFormData;
  users: UserFormData[];
  services: ServiceFormData[];
  savedAt: string;
}

interface RecentClinic {
  id: string;
  name: string;
  type: string;
  tier: string;
  created_at: string;
  status: string;
}

// ---------- Helper: step completion % ----------

function getStepCompletion(
  stepId: number,
  data: { clinicForm: ClinicFormData; users: UserFormData[]; services: ServiceFormData[] },
): number {
  switch (stepId) {
    case 1: {
      const required = ["name", "subdomain"] as const;
      const optional = [
        "type",
        "tier",
        "city",
        "phone",
        "email",
        "address",
        "specialty",
        "domain",
      ] as const;
      const reqFilled = required.filter((k) => data.clinicForm[k].trim()).length;
      const optFilled = optional.filter((k) => data.clinicForm[k].trim()).length;
      return Math.round((reqFilled / required.length) * 70 + (optFilled / optional.length) * 30);
    }
    case 2: {
      if (data.users.length === 0) return 0;
      const perUser = data.users.map((u) => {
        let score = 0;
        if (u.name.trim()) score += 40;
        if (u.role) score += 20;
        if (u.phone?.trim()) score += 20;
        if (u.email?.trim()) score += 20;
        return score;
      });
      return Math.round(perUser.reduce((a, b) => a + b, 0) / perUser.length);
    }
    case 3: {
      if (data.services.length === 0) return 0;
      const perSvc = data.services.map((s) => {
        let score = 0;
        if (s.name.trim()) score += 50;
        if (s.price?.trim()) score += 25;
        if (s.duration_minutes) score += 25;
        return score;
      });
      return Math.round(perSvc.reduce((a, b) => a + b, 0) / perSvc.length);
    }
    case 4:
      return 0;
    default:
      return 0;
  }
}

function getOverallProgress(
  currentStep: number,
  data: { clinicForm: ClinicFormData; users: UserFormData[]; services: ServiceFormData[] },
): number {
  let total = 0;
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    if (i < currentStep) {
      total += 100;
    } else if (i === currentStep) {
      total += getStepCompletion(i, data);
    }
  }
  return Math.round(total / TOTAL_STEPS);
}

// ---------- Component ----------

export default function OnboardingPage() {
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResumeDraft, setShowResumeDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1: Clinic
  const [clinicForm, setClinicForm] = useState<ClinicFormData>({ ...DEFAULT_CLINIC_FORM });
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null);
  const [subdomainManuallyEdited, setSubdomainManuallyEdited] = useState(false);

  // Step 2: Users
  const [users, setUsers] = useState<UserFormData[]>([{ ...DEFAULT_USER }]);
  const [createdUsers, setCreatedUsers] = useState<
    { id: string; name: string; role: string; email?: string }[]
  >([]);

  // Step 3: Services
  const [services, setServices] = useState<ServiceFormData[]>([{ ...DEFAULT_SERVICE }]);

  // Step 4: Time Slots
  const [doctorSlots, setDoctorSlots] = useState<DoctorTimeSlots[]>([]);

  // Completion
  const [completed, setCompleted] = useState(false);

  // Recently onboarded clinics
  const [recentClinics, setRecentClinics] = useState<RecentClinic[]>([]);

  // Summary / review
  const [showReview, setShowReview] = useState(false);

  // ---------- Draft Persistence ----------

  const saveDraft = useCallback(() => {
    const draft: OnboardingDraft = {
      step,
      clinicForm,
      users,
      services,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
    } catch {
      // localStorage quota exceeded or unavailable — ignore
    }
  }, [step, clinicForm, users, services]);

  const loadDraft = useCallback((): OnboardingDraft | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingDraft;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraftSavedAt(null);
    addToast("Draft cleared", "info");
  }, [addToast]);

  const restoreDraft = useCallback((draft: OnboardingDraft) => {
    setStep(draft.step);
    setClinicForm(draft.clinicForm);
    setUsers(draft.users);
    setServices(draft.services);
    setDraftSavedAt(draft.savedAt);
    setShowResumeDraft(false);
  }, []);

  // Check for existing draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setShowResumeDraft(true);
    }
    // Load recently onboarded clinics from localStorage
    try {
      const stored = localStorage.getItem("oltigo_recent_onboarded");
      if (stored) {
        setRecentClinics(JSON.parse(stored) as RecentClinic[]);
      }
    } catch {
      // ignore
    }
  }, [loadDraft]);

  // Auto-save on form changes (debounced)
  useEffect(() => {
    if (completed || createdClinicId) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 1000);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [clinicForm, users, services, step, completed, createdClinicId, saveDraft]);

  // ---------- Recently Onboarded ----------

  function addRecentClinic(clinic: RecentClinic) {
    setRecentClinics((prev) => {
      const updated = [clinic, ...prev.filter((c) => c.id !== clinic.id)].slice(0, 5);
      try {
        localStorage.setItem("oltigo_recent_onboarded", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }

  // ---------- Handlers ----------

  function updateClinicField(field: keyof ClinicFormData, value: string) {
    setClinicForm((prev) => {
      const next = { ...prev, [field]: value };
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
    setUsers((prev) => [...prev, { role: "doctor", name: "", phone: "", email: "" }]);
  }

  function removeUser(index: number) {
    setUsers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUser(index: number, field: keyof UserFormData, value: string) {
    setUsers((prev) => prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
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

  function updateService(index: number, field: keyof ServiceFormData, value: string) {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSlotToDoctor(doctorIndex: number) {
    setDoctorSlots((prev) =>
      prev.map((d, i) =>
        i === doctorIndex ? { ...d, slots: [...d.slots, { ...DEFAULT_SLOT }] } : d,
      ),
    );
  }

  function removeSlotFromDoctor(doctorIndex: number, slotIndex: number) {
    setDoctorSlots((prev) =>
      prev.map((d, i) =>
        i === doctorIndex ? { ...d, slots: d.slots.filter((_, si) => si !== slotIndex) } : d,
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
              slots: d.slots.map((s, si) => (si === slotIndex ? { ...s, [field]: value } : s)),
            }
          : d,
      ),
    );
  }

  // ---------- Navigation ----------

  function navigateToStep(targetStep: number) {
    if (targetStep < step && targetStep >= 1) {
      setStep(targetStep);
      setError(null);
    }
  }

  // ---------- Step Submission ----------

  async function handleStep1() {
    if (!clinicForm.name.trim()) {
      setError("Le nom de la clinique est requis");
      return;
    }
    if (!clinicForm.subdomain.trim()) {
      setError("Le sous-domaine est requis — la clinique a besoin d'une URL pour être accessible");
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(clinicForm.subdomain)) {
      setError(
        "Subdomain must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)",
      );
      return;
    }
    if (clinicForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clinicForm.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!clinicForm.type) {
      setError("Please select a clinic type");
      return;
    }
    if (!clinicForm.tier) {
      setError("Please select a subscription tier");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const clinic = await createClinic({
        name: clinicForm.name,
        type: clinicForm.type || "doctor",
        tier: clinicForm.tier || "pro",
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
      addToast(`Clinic "${clinicForm.name}" created successfully`, "success");
      // Clear draft since real data is now in DB
      clearDraft();
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create clinic";
      setError(msg);
      addToast(msg, "error");
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const u of validUsers) {
      if (u.email && !emailRegex.test(u.email)) {
        setError(
          `Invalid email for "${u.name}": ${u.email}. Please enter a valid email address or leave it empty.`,
        );
        return;
      }
    }

    if (!validUsers.some((u) => u.role === "clinic_admin")) {
      setError("At least one staff member must have the Clinic Admin (Owner) role");
      return;
    }

    const adminsWithoutEmail = validUsers.filter(
      (u) => u.role === "clinic_admin" && !u.email?.trim(),
    );
    if (adminsWithoutEmail.length > 0) {
      setError(
        `Email is required for Clinic Admin "${adminsWithoutEmail[0].name || "(unnamed)"}" — they need an email to log in.`,
      );
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
        created.push({
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email ?? undefined,
        });
      }
      setCreatedUsers(created);
      addToast(`${created.length} staff member(s) created`, "success");

      const doctors = created.filter((u) => u.role === "doctor" || u.role === "clinic_admin");
      setDoctorSlots(
        doctors.map((d) => ({
          doctorId: d.id,
          doctorName: d.name,
          slots: [
            {
              day_of_week: 1,
              start_time: "09:00",
              end_time: "12:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 1,
              start_time: "14:00",
              end_time: "17:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 2,
              start_time: "09:00",
              end_time: "12:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 2,
              start_time: "14:00",
              end_time: "17:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 3,
              start_time: "09:00",
              end_time: "12:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 3,
              start_time: "14:00",
              end_time: "17:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 4,
              start_time: "09:00",
              end_time: "12:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 4,
              start_time: "14:00",
              end_time: "17:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 5,
              start_time: "09:00",
              end_time: "12:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
            {
              day_of_week: 5,
              start_time: "14:00",
              end_time: "17:00",
              max_capacity: "1",
              buffer_minutes: "10",
            },
          ],
        })),
      );

      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create users";
      setError(msg);
      addToast(msg, "error");
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
      addToast(`${validServices.length} service(s) added`, "success");
      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create services";
      setError(msg);
      addToast(msg, "error");
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
            day_of_week:
              typeof s.day_of_week === "string" ? parseInt(s.day_of_week as string) : s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            max_capacity: parseInt(s.max_capacity) || 1,
            buffer_minutes: parseInt(s.buffer_minutes) || 10,
          })),
        );
      }
      addToast("Time slots configured successfully", "success");

      // Save to recently onboarded
      addRecentClinic({
        id: createdClinicId,
        name: clinicForm.name,
        type: clinicForm.type || "doctor",
        tier: clinicForm.tier || "pro",
        created_at: new Date().toISOString(),
        status: "active",
      });

      setCompleted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create time slots";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleSkipTimeSlots() {
    if (createdClinicId) {
      addRecentClinic({
        id: createdClinicId,
        name: clinicForm.name,
        type: clinicForm.type || "doctor",
        tier: clinicForm.tier || "pro",
        created_at: new Date().toISOString(),
        status: "active",
      });
    }
    setCompleted(true);
  }

  // ---------- Computed ----------

  const overallProgress = getOverallProgress(step, { clinicForm, users, services });

  // ---------- Render ----------

  // Resume draft prompt
  if (showResumeDraft) {
    const draft = loadDraft();
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto mb-4">
              <RotateCcw className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Resume draft?</h2>
            <p className="text-muted-foreground mb-1">
              You have an unsaved onboarding draft
              {draft?.clinicForm.name ? (
                <>
                  {" "}
                  for <strong>{draft.clinicForm.name}</strong>
                </>
              ) : null}
              .
            </p>
            {draft?.savedAt && (
              <p className="text-xs text-muted-foreground mb-6">
                Last saved: {new Date(draft.savedAt).toLocaleString()}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  clearDraft();
                  setShowResumeDraft(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Start Fresh
              </Button>
              {draft && (
                <Button onClick={() => restoreDraft(draft)}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Resume Draft
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review / summary before step 4 submission
  if (showReview) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "Onboarding" },
            { label: "Review" },
          ]}
        />
        <h1 className="text-2xl font-bold mb-2">Review Before Submission</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Please review all information before completing the onboarding.
        </p>

        <div className="space-y-4">
          {/* Clinic Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Clinic Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReview(false);
                    setStep(1);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {clinicForm.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span> {clinicForm.type}
                </div>
                <div>
                  <span className="text-muted-foreground">Tier:</span> {clinicForm.tier}
                </div>
                <div>
                  <span className="text-muted-foreground">Subdomain:</span> {clinicForm.subdomain}
                  .oltigo.com
                </div>
                {clinicForm.city && (
                  <div>
                    <span className="text-muted-foreground">City:</span> {clinicForm.city}
                  </div>
                )}
                {clinicForm.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span> {clinicForm.phone}
                  </div>
                )}
                {clinicForm.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span> {clinicForm.email}
                  </div>
                )}
                {clinicForm.specialty && (
                  <div>
                    <span className="text-muted-foreground">Specialty:</span> {clinicForm.specialty}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Staff */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Staff ({createdUsers.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReview(false);
                    setStep(2);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                {createdUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {u.role.replace("_", " ")}
                    </Badge>
                    <span>{u.name}</span>
                    {u.email && <span className="text-muted-foreground text-xs">({u.email})</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Services ({services.filter((s) => s.name.trim()).length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReview(false);
                    setStep(3);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {services
                  .filter((s) => s.name.trim())
                  .map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>{s.name}</span>
                      {s.price && <span className="text-muted-foreground">{s.price} MAD</span>}
                      <span className="text-muted-foreground text-xs">
                        ({s.duration_minutes} min)
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Slots ({doctorSlots.reduce((a, d) => a + d.slots.length, 0)})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReview(false);
                    setStep(4);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                {doctorSlots.map((d) => (
                  <div key={d.doctorId}>
                    <span className="font-medium">{d.doctorName}</span>
                    <span className="text-muted-foreground ml-2">({d.slots.length} slot(s))</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setShowReview(false);
              setStep(4);
            }}
          >
            Back to Editing
          </Button>
          <Button onClick={handleStep4} disabled={loading}>
            {loading ? "Submitting..." : "Complete Onboarding"}
          </Button>
        </div>
      </div>
    );
  }

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
              <p>
                Clinic ID:{" "}
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{createdClinicId}</code>
              </p>
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
                          {u.email ? (
                            STAFF_DEFAULT_PASSWORD
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                  Staff without email cannot log in. Edit their profile in Admin to add an email and
                  enable access.
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
                    </a>{" "}
                    using the credentials above.
                  </p>
                )}
                <p>
                  Branding, colors, and website content can be customized from{" "}
                  <strong>Admin → Branding</strong>.
                </p>
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
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Onboarding" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Client Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a new clinic in your Supabase database — no SQL needed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftSavedAt && !createdClinicId && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="h-3 w-3" />
              Draft saved
            </span>
          )}
          {!createdClinicId && (
            <>
              <Button variant="outline" size="sm" onClick={saveDraft}>
                <Save className="h-4 w-4 mr-1" />
                Save as Draft
              </Button>
              <Button variant="ghost" size="sm" onClick={clearDraft}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Draft
              </Button>
            </>
          )}
          <Link href="/super-admin/onboarding/provision">
            <Button variant="outline" size="sm">
              Provisionnement auto
            </Button>
          </Link>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
          <span className="text-xs font-medium">{overallProgress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            data-width={Math.round(overallProgress)}
          />
        </div>
      </div>

      {/* Step Indicator with completion % */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const stepCompletion = getStepCompletion(s.id, { clinicForm, users, services });
          const isClickable = s.id < step;
          return (
            <div key={s.id} className="flex items-center">
              {i > 0 && (
                <div className={`h-px w-8 mx-2 ${step > s.id - 1 ? "bg-primary" : "bg-border"}`} />
              )}
              <button
                type="button"
                onClick={() => isClickable && navigateToStep(s.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                      ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                      : "bg-muted text-muted-foreground cursor-default"
                }`}
              >
                {step > s.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
                {step === s.id && stepCompletion > 0 && stepCompletion < 100 && (
                  <span className="text-[10px] opacity-80">{stepCompletion}%</span>
                )}
              </button>
            </div>
          );
        })}
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
          onSubmit={() => setShowReview(true)}
        />
      )}

      {/* Recently Onboarded Clinics */}
      {recentClinics.length > 0 && (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recently Onboarded Clinics
            </h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Type</th>
                        <th className="text-left py-3 px-4 font-medium">Tier</th>
                        <th className="text-left py-3 px-4 font-medium">Created</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClinics.map((c) => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium">{c.name}</td>
                          <td className="py-3 px-4 capitalize">{c.type}</td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {c.tier}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={c.status === "active" ? "default" : "secondary"}
                              className="text-xs capitalize"
                            >
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Link href="/super-admin/clinics">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
