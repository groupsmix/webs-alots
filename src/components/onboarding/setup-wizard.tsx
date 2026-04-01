"use client";

import {
  User, Palette, Stethoscope, Clock, UserPlus,
  ChevronRight, ChevronLeft, Check, Loader2, Wand2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { presetList, type TemplatePreset } from "@/lib/template-presets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardProps {
  clinicId: string;
  onComplete?: () => void;
}

interface DoctorProfile {
  name: string;
  photo_url: string;
  specialty: string;
  inpe: string;
}

interface ClinicBranding {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  description: string;
}

interface ServiceEntry {
  name: string;
  duration_minutes: number;
  price: number;
}

interface ScheduleDay {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

interface InviteData {
  name: string;
  contact: string;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "profile", label: "Profil du docteur", icon: User },
  { id: "branding", label: "Identité visuelle", icon: Palette },
  { id: "services", label: "Services & tarifs", icon: Stethoscope },
  { id: "schedule", label: "Horaires", icon: Clock },
  { id: "invite", label: "Inviter un(e) assistant(e)", icon: UserPlus },
] as const;

// Typical Moroccan clinic hours
const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { day_of_week: 0, start_time: "09:00", end_time: "17:00", enabled: false }, // Dimanche
  { day_of_week: 1, start_time: "09:00", end_time: "18:00", enabled: true },
  { day_of_week: 2, start_time: "09:00", end_time: "18:00", enabled: true },
  { day_of_week: 3, start_time: "09:00", end_time: "18:00", enabled: true },
  { day_of_week: 4, start_time: "09:00", end_time: "18:00", enabled: true },
  { day_of_week: 5, start_time: "09:00", end_time: "18:00", enabled: true },
  { day_of_week: 6, start_time: "09:00", end_time: "13:00", enabled: true }, // Samedi
];

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Pre-populated services by common specialties
const DEFAULT_SERVICES: Record<string, ServiceEntry[]> = {
  "Médecine générale": [
    { name: "Consultation générale", duration_minutes: 20, price: 150 },
    { name: "Certificat médical", duration_minutes: 10, price: 100 },
    { name: "Bilan de santé", duration_minutes: 30, price: 250 },
  ],
  Dentiste: [
    { name: "Consultation dentaire", duration_minutes: 20, price: 150 },
    { name: "Détartrage", duration_minutes: 30, price: 300 },
    { name: "Extraction simple", duration_minutes: 30, price: 400 },
    { name: "Plombage", duration_minutes: 30, price: 350 },
  ],
  Pédiatrie: [
    { name: "Consultation pédiatrique", duration_minutes: 20, price: 200 },
    { name: "Vaccination", duration_minutes: 15, price: 150 },
    { name: "Suivi de croissance", duration_minutes: 25, price: 200 },
  ],
  default: [
    { name: "Consultation", duration_minutes: 20, price: 200 },
    { name: "Suivi", duration_minutes: 15, price: 150 },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupWizard({ clinicId, onComplete }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Doctor Profile
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>({
    name: "",
    photo_url: "",
    specialty: "",
    inpe: "",
  });

  // Step 2: Clinic Branding
  const [branding, setBranding] = useState<ClinicBranding>({
    logo_url: "",
    primary_color: "#1E4DA1",
    secondary_color: "#0F6E56",
    description: "",
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // Show a small selection of presets (first 4) for quick setup
  const onboardingPresets = presetList.slice(0, 4);

  async function handlePresetSelect(preset: TemplatePreset) {
    setSelectedPreset(preset.id);
    setApplyingPreset(true);
    try {
      const res = await fetch("/api/branding/apply-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: preset.id }),
      });
      if (res.ok) {
        setBranding((b) => ({
          ...b,
          primary_color: preset.theme.primaryColor,
          secondary_color: preset.theme.secondaryColor,
        }));
      }
    } finally {
      setApplyingPreset(false);
    }
  }

  // Step 3: Services
  const [services, setServices] = useState<ServiceEntry[]>(
    DEFAULT_SERVICES["default"],
  );

  // Step 4: Schedule
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);

  // Step 5: Invite
  const [invite, setInvite] = useState<InviteData>({ name: "", contact: "" });

  // Load specialty-specific services when profile changes
  const loadSpecialtyServices = useCallback((specialty: string) => {
    const specialtyServices = DEFAULT_SERVICES[specialty] || DEFAULT_SERVICES["default"];
    setServices(specialtyServices);
  }, []);

  // ---------------------------------------------------------------------------
  // Step saving logic
  // ---------------------------------------------------------------------------

  async function saveCurrentStep() {
    setSaving(true);
    setStepErrors({});

    try {
      switch (currentStep) {
        case 0: {
          // Save doctor profile
          const res = await fetch("/api/onboarding/wizard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clinic_id: clinicId,
              doctor_profile: {
                name: doctorProfile.name,
                specialty: doctorProfile.specialty,
                inpe: doctorProfile.inpe,
              },
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erreur lors de la sauvegarde du profil");
          }
          break;
        }
        case 1: {
          // Save branding
          const res = await fetch("/api/onboarding/wizard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clinic_id: clinicId,
              branding: {
                primary_color: branding.primary_color,
                secondary_color: branding.secondary_color,
              },
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erreur lors de la sauvegarde du branding");
          }
          break;
        }
        case 2: {
          // Save services
          const validServices = services.filter((s) => s.name.trim().length > 0);
          if (validServices.length > 0) {
            const res = await fetch("/api/onboarding/wizard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clinic_id: clinicId,
                services: validServices,
              }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Erreur lors de la sauvegarde des services");
            }
          }
          break;
        }
        case 3: {
          // Save schedule
          const activeSlots = schedule.filter((s) => s.enabled);
          if (activeSlots.length > 0) {
            const res = await fetch("/api/onboarding/wizard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clinic_id: clinicId,
                schedule: activeSlots.map((s) => ({
                  day_of_week: s.day_of_week,
                  start_time: s.start_time,
                  end_time: s.end_time,
                })),
              }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Erreur lors de la sauvegarde des horaires");
            }
          }
          break;
        }
        case 4: {
          // Save invite + go live
          if (invite.contact.trim()) {
            // Send invite via the existing wizard endpoint
            await fetch("/api/onboarding/wizard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clinic_id: clinicId,
                invite_receptionist: {
                  name: invite.name,
                  contact: invite.contact,
                },
                go_live: true,
              }),
            });
          } else {
            // Just go live without inviting
            await fetch("/api/onboarding/wizard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clinic_id: clinicId,
                go_live: true,
              }),
            });
          }
          break;
        }
      }

      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de sauvegarde";
      setStepErrors({ [currentStep]: message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const success = await saveCurrentStep();
    if (success) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete?.();
      }
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleSkip() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const progressPercent = Math.round(
    ((completedSteps.size) / STEPS.length) * 100,
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Étape {currentStep + 1} sur {STEPS.length}
          </span>
          <span>{progressPercent}% complété</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = completedSteps.has(index);

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (index <= currentStep || isCompleted) {
                  setCurrentStep(index);
                }
              }}
              className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                isActive
                  ? "text-primary"
                  : isCompleted
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : isCompleted
                      ? "border-green-500 bg-green-50"
                      : "border-muted"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className="hidden sm:block">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{STEPS[currentStep].label}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Complétez votre profil professionnel."}
            {currentStep === 1 && "Personnalisez l'apparence de votre site."}
            {currentStep === 2 && "Définissez vos services et tarifs."}
            {currentStep === 3 && "Configurez vos horaires de travail."}
            {currentStep === 4 && "Invitez un(e) secrétaire ou réceptionniste."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Doctor Profile */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc-name">Nom complet *</Label>
                <Input
                  id="doc-name"
                  placeholder="Dr Ahmed Benali"
                  value={doctorProfile.name}
                  onChange={(e) =>
                    setDoctorProfile((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-specialty">Spécialité *</Label>
                <Input
                  id="doc-specialty"
                  placeholder="Médecine générale"
                  value={doctorProfile.specialty}
                  onChange={(e) => {
                    setDoctorProfile((p) => ({ ...p, specialty: e.target.value }));
                    loadSpecialtyServices(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-inpe">Numéro INPE</Label>
                <Input
                  id="doc-inpe"
                  placeholder="Numéro d'inscription à l'ordre"
                  value={doctorProfile.inpe}
                  onChange={(e) =>
                    setDoctorProfile((p) => ({ ...p, inpe: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-photo">URL de la photo</Label>
                <Input
                  id="doc-photo"
                  placeholder="https://..."
                  value={doctorProfile.photo_url}
                  onChange={(e) =>
                    setDoctorProfile((p) => ({ ...p, photo_url: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vous pouvez aussi ajouter votre photo plus tard depuis les paramètres.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Clinic Branding */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Quick preset picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Start: Pick a preset</Label>
                <p className="text-xs text-muted-foreground">
                  Choose a preset to instantly set up your site&apos;s look, or customize manually below.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {onboardingPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={applyingPreset}
                      onClick={() => handlePresetSelect(preset)}
                      className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                        selectedPreset === preset.id
                          ? "ring-2 ring-primary border-primary"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{preset.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: preset.theme.primaryColor }}
                        />
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: preset.theme.secondaryColor }}
                        />
                        <div
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: preset.theme.accentColor }}
                        />
                      </div>
                      {selectedPreset === preset.id && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Applied
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or customize manually
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand-logo">URL du logo</Label>
                <Input
                  id="brand-logo"
                  placeholder="https://..."
                  value={branding.logo_url}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, logo_url: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vous pouvez uploader votre logo plus tard depuis les paramètres.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="brand-primary">Couleur principale</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="brand-primary"
                      value={branding.primary_color}
                      onChange={(e) =>
                        setBranding((b) => ({ ...b, primary_color: e.target.value }))
                      }
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding.primary_color}
                      onChange={(e) =>
                        setBranding((b) => ({ ...b, primary_color: e.target.value }))
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-secondary">Couleur secondaire</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="brand-secondary"
                      value={branding.secondary_color}
                      onChange={(e) =>
                        setBranding((b) => ({
                          ...b,
                          secondary_color: e.target.value,
                        }))
                      }
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding.secondary_color}
                      onChange={(e) =>
                        setBranding((b) => ({
                          ...b,
                          secondary_color: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-desc">Description de la clinique</Label>
                <textarea
                  id="brand-desc"
                  placeholder="Votre cabinet médical à Casablanca..."
                  value={branding.description}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, description: e.target.value }))
                  }
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {/* Preview */}
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground mb-2">Aperçu</p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ backgroundColor: branding.primary_color }}
                  />
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ backgroundColor: branding.secondary_color }}
                  />
                  <div
                    className="h-3 w-24 rounded"
                    style={{ backgroundColor: branding.primary_color }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Services & Prices */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Services pré-remplis selon votre spécialité. Modifiez ou ajoutez des services.
              </p>
              {services.map((service, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">Nom du service</Label>
                    )}
                    <Input
                      placeholder="Consultation"
                      value={service.name}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setServices(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">Durée (min)</Label>
                    )}
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      value={service.duration_minutes}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[index] = {
                          ...updated[index],
                          duration_minutes: parseInt(e.target.value) || 20,
                        };
                        setServices(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">Prix (MAD)</Label>
                    )}
                    <Input
                      type="number"
                      min={0}
                      value={service.price}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[index] = {
                          ...updated[index],
                          price: parseFloat(e.target.value) || 0,
                        };
                        setServices(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setServices(services.filter((_, i) => i !== index));
                      }}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setServices([
                    ...services,
                    { name: "", duration_minutes: 20, price: 0 },
                  ])
                }
              >
                + Ajouter un service
              </Button>
            </div>
          )}

          {/* Step 4: Working Hours */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Horaires pré-remplis avec les heures typiques au Maroc. Ajustez selon vos besoins.
              </p>
              {schedule.map((day, index) => (
                <div
                  key={day.day_of_week}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    day.enabled ? "bg-white" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <label className="flex items-center gap-2 min-w-[110px]">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) => {
                        const updated = [...schedule];
                        updated[index] = { ...updated[index], enabled: e.target.checked };
                        setSchedule(updated);
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">{DAY_NAMES[day.day_of_week]}</span>
                  </label>
                  {day.enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={day.start_time}
                        onChange={(e) => {
                          const updated = [...schedule];
                          updated[index] = { ...updated[index], start_time: e.target.value };
                          setSchedule(updated);
                        }}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Input
                        type="time"
                        value={day.end_time}
                        onChange={(e) => {
                          const updated = [...schedule];
                          updated[index] = { ...updated[index], end_time: e.target.value };
                          setSchedule(updated);
                        }}
                        className="w-28"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Invite Receptionist */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Invitez un(e) secrétaire pour gérer vos rendez-vous. Vous pouvez aussi le faire plus tard.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Nom</Label>
                <Input
                  id="invite-name"
                  placeholder="Nom du/de la réceptionniste"
                  value={invite.name}
                  onChange={(e) =>
                    setInvite((i) => ({ ...i, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-contact">Email ou téléphone</Label>
                <Input
                  id="invite-contact"
                  placeholder="email@exemple.com ou 0612345678"
                  value={invite.contact}
                  onChange={(e) =>
                    setInvite((i) => ({ ...i, contact: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {/* Error display */}
          {stepErrors[currentStep] && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {stepErrors[currentStep]}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || saving}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Précédent
        </Button>

        <Button variant="ghost" onClick={handleSkip} disabled={saving}>
          Passer cette étape
        </Button>

        <Button onClick={handleNext} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Sauvegarde...
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              Terminer
              <Check className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
