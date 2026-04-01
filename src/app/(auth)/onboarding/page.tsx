"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Palette,
  Eye,
  Rocket,
  SkipForward,
  User,
  Briefcase,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { ClinicTypeIcon } from "@/components/clinic-type-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CLINIC_CATEGORIES,
  getTypesByCategory,
  type ClinicCategory,
  type ClinicTypeEntry,
} from "@/lib/config/clinic-types";
import {
  getDefaultServices,
  type DefaultService,
} from "@/lib/config/default-services";
import type { VerticalId } from "@/lib/config/verticals";
import {
  getPresetsByVertical,
  type TemplatePreset,
} from "@/lib/template-presets";
import { templateList, type TemplateDefinition } from "@/lib/templates";
import type { ClinicTypeCategory } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface DoctorProfile {
  clinicName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  npiLicense: string;
  selectedCategory: ClinicTypeCategory | null;
  selectedType: ClinicTypeEntry | null;
}

interface ServiceEntry {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
}

type WeekSchedule = Record<string, DaySchedule>;

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  templateId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS = [
  { key: "monday", label: "Lundi", labelAr: "\u0627\u0644\u0625\u062b\u0646\u064a\u0646" },
  { key: "tuesday", label: "Mardi", labelAr: "\u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621" },
  { key: "wednesday", label: "Mercredi", labelAr: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621" },
  { key: "thursday", label: "Jeudi", labelAr: "\u0627\u0644\u062e\u0645\u064a\u0633" },
  { key: "friday", label: "Vendredi", labelAr: "\u0627\u0644\u062c\u0645\u0639\u0629" },
  { key: "saturday", label: "Samedi", labelAr: "\u0627\u0644\u0633\u0628\u062a" },
  { key: "sunday", label: "Dimanche", labelAr: "\u0627\u0644\u0623\u062d\u062f" },
];

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { enabled: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: true },
  tuesday: { enabled: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: true },
  wednesday: { enabled: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: true },
  thursday: { enabled: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: true },
  friday: { enabled: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: true },
  saturday: { enabled: true, startTime: "09:00", endTime: "13:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: false },
  sunday: { enabled: false, startTime: "09:00", endTime: "13:00", breakStart: "13:00", breakEnd: "14:00", hasBreak: false },
};

const STEP_META: { key: WizardStep; label: string; icon: React.ElementType }[] = [
  { key: 1, label: "Profil", icon: User },
  { key: 2, label: "Services", icon: Briefcase },
  { key: 3, label: "Horaires", icon: Clock },
  { key: 4, label: "Branding", icon: Palette },
  { key: 5, label: "Go Live", icon: Rocket },
];

const COLOR_PRESETS = [
  "#1E4DA1", "#0F6E56", "#7C3AED", "#DC2626",
  "#EA580C", "#0891B2", "#4F46E5", "#059669",
  "#D97706", "#BE185D", "#6D28D9", "#0D9488",
];

let serviceIdCounter = 0;
function nextServiceId(): string {
  serviceIdCounter += 1;
  return `svc-${serviceIdCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryPicker({
  onSelect,
}: {
  onSelect: (cat: ClinicCategory) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground mb-4">
        Choisissez la cat\u00e9gorie de votre \u00e9tablissement
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CLINIC_CATEGORIES.map((cat) => (
          <Card
            key={cat.key}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${cat.color}`}
            onClick={() => onSelect(cat)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
                  <ClinicTypeIcon name={cat.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{cat.name_fr}</h3>
                  <p className="text-xs mt-0.5 font-medium" dir="rtl">
                    {cat.name_ar}
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    {cat.description_fr}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TypePicker({
  category,
  selectedType,
  onSelect,
  onBack,
}: {
  category: ClinicCategory;
  selectedType: ClinicTypeEntry | null;
  onSelect: (t: ClinicTypeEntry) => void;
  onBack: () => void;
}) {
  const types = getTypesByCategory(category.key);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium">
            {category.name_fr} / {category.name_ar}
          </p>
          <p className="text-xs text-muted-foreground">
            Choisissez votre sp\u00e9cialit\u00e9
          </p>
        </div>
        <div className="w-16" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <Card
            key={t.type_key}
            className={`cursor-pointer transition-all hover:shadow-md border-2 ${
              selectedType?.type_key === t.type_key
                ? "border-primary bg-primary/5"
                : "border-transparent hover:border-border"
            }`}
            onClick={() => onSelect(t)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ClinicTypeIcon name={t.icon} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{t.name_fr}</p>
                  <p className="text-xs text-muted-foreground" dir="rtl">
                    {t.name_ar}
                  </p>
                </div>
                {selectedType?.type_key === t.type_key && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [createdSubdomain, setCreatedSubdomain] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);

  // Step 1 sub-step navigation
  const [profileSubStep, setProfileSubStep] = useState<
    "category" | "type" | "form"
  >("category");

  // Step 1: Profile
  const [profile, setProfile] = useState<DoctorProfile>({
    clinicName: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    npiLicense: "",
    selectedCategory: null,
    selectedType: null,
  });

  // Step 2: Services
  const [services, setServices] = useState<ServiceEntry[]>([]);

  // Step 3: Working Hours
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  // Step 4: Branding
  const [branding, setBranding] = useState<BrandingConfig>({
    primaryColor: "#1E4DA1",
    secondaryColor: "#0F6E56",
    templateId: "modern",
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // --- Derived ---
  const currentCategory = profile.selectedCategory
    ? CLINIC_CATEGORIES.find((c) => c.key === profile.selectedCategory) ?? null
    : null;

  // --- Category / Type handlers ---
  function handleSelectCategory(cat: ClinicCategory) {
    setProfile((p) => ({
      ...p,
      selectedCategory: cat.key,
      selectedType: null,
    }));
    setProfileSubStep("type");
  }

  function handleSelectType(t: ClinicTypeEntry) {
    setProfile((p) => ({ ...p, selectedType: t }));
    const defaults = getDefaultServices(t.type_key, t.category);
    setServices(
      defaults.map((s: DefaultService) => ({ ...s, id: nextServiceId() })),
    );
    setProfileSubStep("form");
  }

  function handleBackToCategory() {
    setProfile((p) => ({
      ...p,
      selectedCategory: null,
      selectedType: null,
    }));
    setProfileSubStep("category");
  }

  function handleBackToType() {
    setProfile((p) => ({ ...p, selectedType: null }));
    setProfileSubStep("type");
  }

  // --- Service handlers ---
  function addService() {
    setServices((s) => [
      ...s,
      { id: nextServiceId(), name: "", duration_minutes: 30, price: 0 },
    ]);
  }

  function removeService(id: string) {
    setServices((s) => s.filter((svc) => svc.id !== id));
  }

  function updateService(
    id: string,
    field: keyof Omit<ServiceEntry, "id">,
    value: string | number,
  ) {
    setServices((s) =>
      s.map((svc) => (svc.id === id ? { ...svc, [field]: value } : svc)),
    );
  }

  // --- Schedule handler ---
  const updateDay = useCallback(
    (dayKey: string, field: keyof DaySchedule, value: string | boolean) => {
      setSchedule((prev) => ({
        ...prev,
        [dayKey]: { ...prev[dayKey], [field]: value },
      }));
    },
    [],
  );

  // --- Step 1: create clinic ---
  async function handleCreateClinic() {
    if (
      !profile.selectedType ||
      !profile.clinicName ||
      !profile.ownerName ||
      !profile.phone
    ) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_type_key: profile.selectedType.type_key,
          category: profile.selectedType.category,
          clinic_name: profile.clinicName,
          owner_name: profile.ownerName,
          phone: profile.phone,
          email: profile.email,
          city: profile.city,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Registration failed");
      }

      const result = await res.json().catch(() => null);
      setCreatedSubdomain(result?.subdomain ?? null);
      setClinicId(result?.clinic_id ?? null);
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // --- Save wizard extended data ---
  async function saveWizardData(goLive: boolean) {
    if (!clinicId) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          services: services
            .filter((s) => s.name.trim())
            .map((s) => ({
              name: s.name,
              duration_minutes: s.duration_minutes,
              price: s.price,
            })),
          schedule: Object.entries(schedule)
            .filter(([, day]) => day.enabled)
            .map(([dayKey, day]) => ({
              day_of_week: DAYS.findIndex((d) => d.key === dayKey),
              start_time: day.startTime,
              end_time: day.endTime,
              break_start: day.hasBreak ? day.breakStart : null,
              break_end: day.hasBreak ? day.breakEnd : null,
            })),
          branding: {
            primary_color: branding.primaryColor,
            secondary_color: branding.secondaryColor,
            template_id: branding.templateId,
          },
          go_live: goLive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }

      if (goLive) {
        setCompleted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // --- Navigation ---
  function goToStep(step: WizardStep) {
    setError(null);
    setCurrentStep(step);
  }

  function handleNext() {
    if (currentStep < 5) {
      goToStep((currentStep + 1) as WizardStep);
    }
  }

  function handleBack() {
    if (currentStep === 1) {
      if (profileSubStep === "form") {
        handleBackToType();
      } else if (profileSubStep === "type") {
        handleBackToCategory();
      }
      return;
    }
    if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStep);
    }
  }

  function handleSkip() {
    handleNext();
  }

  // ---------------------------------------------------------------------------
  // Completion screen
  // ---------------------------------------------------------------------------
  if (completed) {
    const clinicUrl = createdSubdomain
      ? `https://${createdSubdomain}.oltigo.com`
      : null;
    return (
      <div className="w-full max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Votre site est en ligne !
            </h2>
            <p className="text-muted-foreground mb-6">
              <strong>{profile.clinicName}</strong> est pr\u00eat \u00e0
              recevoir des rendez-vous.
            </p>
            {clinicUrl && (
              <div className="bg-muted/50 rounded-lg p-4 text-left text-sm mb-6">
                <p className="font-semibold mb-2">
                  Votre site est accessible :
                </p>
                <a
                  href={clinicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline font-mono flex items-center gap-1"
                >
                  {createdSubdomain}.oltigo.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push("/admin/dashboard")}
              >
                Acc\u00e9der au tableau de bord
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Un message WhatsApp de bienvenue a \u00e9t\u00e9 envoy\u00e9
                \u00e0 {profile.phone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Progress indicator
  // ---------------------------------------------------------------------------
  const progressIndicator = (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
      {STEP_META.map((s, i) => {
        const StepIcon = s.icon;
        const isCompleted = s.key < currentStep;
        const isCurrent = s.key === currentStep;
        return (
          <div key={s.key} className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => isCompleted && goToStep(s.key)}
              disabled={!isCompleted}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isCompleted
                  ? "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <StepIcon className="h-4 w-4" />
              )}
            </button>
            <span
              className={`text-xs sm:text-sm hidden sm:inline ${
                isCurrent ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < STEP_META.length - 1 && (
              <div
                className={`w-4 sm:w-8 h-px ${
                  isCompleted ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 1: Profile
  // ---------------------------------------------------------------------------
  const step1Content = (
    <>
      {profileSubStep === "category" && (
        <CategoryPicker onSelect={handleSelectCategory} />
      )}

      {profileSubStep === "type" && currentCategory && (
        <TypePicker
          category={currentCategory}
          selectedType={profile.selectedType}
          onSelect={handleSelectType}
          onBack={handleBackToCategory}
        />
      )}

      {profileSubStep === "form" && profile.selectedType && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBackToType}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Changer de sp\u00e9cialit\u00e9
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClinicTypeIcon
                  name={profile.selectedType.icon}
                  className="h-5 w-5 text-primary"
                />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {profile.selectedType.name_fr}
                </CardTitle>
                <CardDescription dir="rtl">
                  {profile.selectedType.name_ar}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && currentStep === 1 && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName">
                  Nom de l&apos;\u00e9tablissement *
                </Label>
                <Input
                  id="clinicName"
                  placeholder="ex: Cabinet Dr. Ahmed"
                  value={profile.clinicName}
                  onChange={(e) =>
                    setProfile({ ...profile, clinicName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">
                    Nom du docteur / responsable *
                  </Label>
                  <Input
                    id="ownerName"
                    placeholder="Dr. Ahmed Tazi"
                    value={profile.ownerName}
                    onChange={(e) =>
                      setProfile({ ...profile, ownerName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npiLicense">N\u00b0 Ordre / Licence</Label>
                  <Input
                    id="npiLicense"
                    placeholder="ex: 12345"
                    value={profile.npiLicense}
                    onChange={(e) =>
                      setProfile({ ...profile, npiLicense: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">T\u00e9l\u00e9phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@cabinet.ma"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  placeholder="Casablanca"
                  value={profile.city}
                  onChange={(e) =>
                    setProfile({ ...profile, city: e.target.value })
                  }
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={
                  loading ||
                  !profile.clinicName ||
                  !profile.ownerName ||
                  !profile.phone
                }
                onClick={handleCreateClinic}
              >
                {loading ? (
                  "Cr\u00e9ation en cours..."
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Step 2: Services
  // ---------------------------------------------------------------------------
  const step2Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Vos services
        </CardTitle>
        <CardDescription>
          Services pr\u00e9-remplis selon votre sp\u00e9cialit\u00e9. Modifiez
          les prix et dur\u00e9es, ou ajoutez de nouveaux services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && currentStep === 2 && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center gap-2 rounded-lg border p-3 bg-background"
            >
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Nom du service"
                  value={svc.name}
                  onChange={(e) =>
                    updateService(svc.id, "name", e.target.value)
                  }
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      value={svc.duration_minutes}
                      onChange={(e) =>
                        updateService(
                          svc.id,
                          "duration_minutes",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      min
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="number"
                      min={0}
                      value={svc.price}
                      onChange={(e) =>
                        updateService(
                          svc.id,
                          "price",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      MAD
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeService(svc.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" className="w-full" onClick={addService}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un service
          </Button>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" />
            Passer
          </Button>
          <Button onClick={handleNext}>
            Continuer
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Step 3: Working Hours
  // ---------------------------------------------------------------------------
  const step3Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horaires de travail
        </CardTitle>
        <CardDescription>
          D\u00e9finissez vos jours et heures de disponibilit\u00e9. Les
          patients pourront r\u00e9server en ligne pendant ces cr\u00e9neaux.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {DAYS.map((day) => {
            const daySchedule = schedule[day.key];
            return (
              <div
                key={day.key}
                className={`rounded-lg border p-3 transition-colors ${
                  daySchedule.enabled ? "bg-background" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={daySchedule.enabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.key, "enabled", checked)
                    }
                  />
                  <div className="w-24">
                    <p
                      className={`text-sm font-medium ${!daySchedule.enabled ? "text-muted-foreground" : ""}`}
                    >
                      {day.label}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="rtl">
                      {day.labelAr}
                    </p>
                  </div>

                  {daySchedule.enabled && (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={daySchedule.startTime}
                          onChange={(e) =>
                            updateDay(day.key, "startTime", e.target.value)
                          }
                          className="h-8 w-28 text-sm"
                        />
                        <span className="text-muted-foreground text-sm">
                          {"\u2014"}
                        </span>
                        <Input
                          type="time"
                          value={daySchedule.endTime}
                          onChange={(e) =>
                            updateDay(day.key, "endTime", e.target.value)
                          }
                          className="h-8 w-28 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2 ml-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={daySchedule.hasBreak}
                            onChange={(e) =>
                              updateDay(day.key, "hasBreak", e.target.checked)
                            }
                            className="rounded"
                          />
                          Pause
                        </label>
                        {daySchedule.hasBreak && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="time"
                              value={daySchedule.breakStart}
                              onChange={(e) =>
                                updateDay(
                                  day.key,
                                  "breakStart",
                                  e.target.value,
                                )
                              }
                              className="h-7 w-24 text-xs"
                            />
                            <span className="text-muted-foreground text-xs">
                              {"\u2014"}
                            </span>
                            <Input
                              type="time"
                              value={daySchedule.breakEnd}
                              onChange={(e) =>
                                updateDay(day.key, "breakEnd", e.target.value)
                              }
                              className="h-7 w-24 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!daySchedule.enabled && (
                    <p className="text-sm text-muted-foreground italic">
                      Ferm\u00e9
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" />
            Passer
          </Button>
          <Button onClick={handleNext}>
            Continuer
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Step 4: Branding
  // ---------------------------------------------------------------------------
  // Derive the vertical from the selected category to filter presets
  const CATEGORY_TO_VERTICAL: Record<string, VerticalId> = {
    medical: "healthcare",
    dental: "healthcare",
    beauty: "beauty",
    restaurant: "restaurant",
    fitness: "fitness",
    veterinary: "veterinary",
  };
  const detectedVertical: VerticalId | null = profile.selectedCategory
    ? CATEGORY_TO_VERTICAL[profile.selectedCategory] ?? null
    : null;
  const availablePresets = detectedVertical
    ? getPresetsByVertical(detectedVertical)
    : [];

  function handlePickPreset(preset: TemplatePreset) {
    setSelectedPreset(preset.id);
    setBranding({
      primaryColor: preset.theme.primaryColor,
      secondaryColor: preset.theme.secondaryColor,
      templateId: preset.templateId,
    });
  }

  const step4Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Identit\u00e9 visuelle
        </CardTitle>
        <CardDescription>
          Choisissez les couleurs et le style de votre site web.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Quick-start presets */}
          {availablePresets.length > 0 && (
            <div className="space-y-2">
              <Label>D\u00e9marrage rapide \u2014 choisissez un preset</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {availablePresets.slice(0, 4).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`text-left rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                      selectedPreset === preset.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => handlePickPreset(preset)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-1">
                        <div
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: preset.theme.primaryColor }}
                        />
                        <div
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: preset.theme.secondaryColor }}
                        />
                      </div>
                      <span className="font-medium text-sm">{preset.name}</span>
                      {selectedPreset === preset.id && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ou personnalisez manuellement ci-dessous
              </p>
            </div>
          )}

          {/* Primary Color */}
          <div className="space-y-2">
            <Label>Couleur principale</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    branding.primaryColor === color
                      ? "border-foreground scale-110 ring-2 ring-offset-2 ring-primary"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    setBranding({ ...branding, primaryColor: color })
                  }
                />
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {branding.primaryColor}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <Label>Couleur secondaire</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={`sec-${color}`}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    branding.secondaryColor === color
                      ? "border-foreground scale-110 ring-2 ring-offset-2 ring-primary"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    setBranding({ ...branding, secondaryColor: color })
                  }
                />
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      secondaryColor: e.target.value,
                    })
                  }
                  className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {branding.secondaryColor}
                </span>
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Style de site</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templateList.map((tmpl: TemplateDefinition) => (
                <button
                  key={tmpl.id}
                  type="button"
                  className={`text-left rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                    branding.templateId === tmpl.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() =>
                    setBranding({ ...branding, templateId: tmpl.id })
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`h-6 w-6 rounded ${tmpl.wrapperClass} border flex items-center justify-center text-xs font-bold`}
                    >
                      {tmpl.name.charAt(0)}
                    </div>
                    <span className="font-medium text-sm">{tmpl.name}</span>
                    {branding.templateId === tmpl.id && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tmpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview swatch */}
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-2">
              Aper\u00e7u des couleurs
            </p>
            <div className="flex gap-3 items-center">
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: branding.primaryColor }}
              />
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: branding.secondaryColor }}
              />
              <div className="flex-1 space-y-1">
                <div
                  className="h-2 rounded-full w-3/4"
                  style={{ backgroundColor: branding.primaryColor }}
                />
                <div
                  className="h-2 rounded-full w-1/2"
                  style={{
                    backgroundColor: branding.secondaryColor,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" />
            Passer
          </Button>
          <Button onClick={handleNext}>
            Continuer
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Step 5: Preview & Go Live
  // ---------------------------------------------------------------------------
  const generatedUrl = createdSubdomain
    ? `${createdSubdomain}.oltigo.com`
    : "votre-cabinet.oltigo.com";

  const enabledDays = DAYS.filter((d) => schedule[d.key].enabled);
  const activeServices = services.filter((s) => s.name.trim());

  const step5Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Aper\u00e7u &amp; Mise en ligne
        </CardTitle>
        <CardDescription>
          V\u00e9rifiez les informations avant de mettre votre site en ligne.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && currentStep === 5 && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* URL Preview */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              Votre site sera accessible \u00e0
            </p>
            <p className="text-lg font-bold text-primary font-mono">
              {generatedUrl}
            </p>
          </div>

          {/* Profile Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Profil
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">
                  \u00c9tablissement:
                </span>{" "}
                <span className="font-medium">{profile.clinicName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Responsable:</span>{" "}
                <span className="font-medium">{profile.ownerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  T\u00e9l\u00e9phone:
                </span>{" "}
                <span className="font-medium">{profile.phone}</span>
              </div>
              {profile.city && (
                <div>
                  <span className="text-muted-foreground">Ville:</span>{" "}
                  <span className="font-medium">{profile.city}</span>
                </div>
              )}
              {profile.selectedType && (
                <div>
                  <span className="text-muted-foreground">
                    Sp\u00e9cialit\u00e9:
                  </span>{" "}
                  <span className="font-medium">
                    {profile.selectedType.name_fr}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Services Summary */}
          {activeServices.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Services ({activeServices.length})
              </h3>
              <div className="space-y-1">
                {activeServices.map((svc) => (
                  <div key={svc.id} className="flex justify-between text-sm">
                    <span>{svc.name}</span>
                    <span className="text-muted-foreground">
                      {svc.duration_minutes} min {"\u2014"} {svc.price} MAD
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Summary */}
          {enabledDays.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horaires
              </h3>
              <div className="space-y-1">
                {enabledDays.map((day) => {
                  const s = schedule[day.key];
                  return (
                    <div
                      key={day.key}
                      className="flex justify-between text-sm"
                    >
                      <span>{day.label}</span>
                      <span className="text-muted-foreground">
                        {s.startTime} {"\u2014"} {s.endTime}
                        {s.hasBreak &&
                          ` (pause ${s.breakStart}\u2013${s.breakEnd})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Branding Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Style
            </h3>
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded"
                style={{ backgroundColor: branding.primaryColor }}
              />
              <div
                className="h-6 w-6 rounded"
                style={{ backgroundColor: branding.secondaryColor }}
              />
              <span className="text-sm text-muted-foreground">
                Template:{" "}
                {templateList.find(
                  (t: TemplateDefinition) => t.id === branding.templateId,
                )?.name ?? "Modern"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Button
            className="ml-auto"
            size="lg"
            disabled={loading}
            onClick={() => saveWizardData(true)}
          >
            {loading ? (
              "Mise en ligne..."
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-1" />
                Mettre en ligne
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">
          Cr\u00e9er votre \u00e9tablissement
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre site sera en ligne en moins de 5 minutes
        </p>
      </div>

      {/* Progress indicator */}
      {progressIndicator}

      {/* Step content */}
      {currentStep === 1 && step1Content}
      {currentStep === 2 && step2Content}
      {currentStep === 3 && step3Content}
      {currentStep === 4 && step4Content}
      {currentStep === 5 && step5Content}
    </div>
  );
}
