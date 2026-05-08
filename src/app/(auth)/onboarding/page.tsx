"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  User,
  Palette,
  Upload,
  Rocket,
  Loader2,
  ImagePlus,
  SkipForward,
} from "lucide-react";
import { useState, useRef } from "react";
import { ClinicTypeIcon } from "@/components/clinic-type-icon";
import { CelebrationPage } from "@/components/onboarding/celebration-page";
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
import {
  CLINIC_CATEGORIES,
  getTypesByCategory,
  type ClinicCategory,
  type ClinicTypeEntry,
} from "@/lib/config/clinic-types";
import type { VerticalId } from "@/lib/config/verticals";
import { MOROCCAN_CITIES } from "@/lib/morocco";
import {
  getPresetsByVertical,
  type TemplatePreset,
} from "@/lib/template-presets";
import type { ClinicTypeCategory } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepMeta {
  key: WizardStep;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_META: StepMeta[] = [
  { key: 1, label: "Vos infos", sublabel: "30 sec", icon: User },
  {
    key: 2,
    label: "Votre activit\u00e9",
    sublabel: "30 sec",
    icon: Building2,
  },
  { key: 3, label: "Choisir un style", sublabel: "15 sec", icon: Palette },
  { key: 4, label: "Votre logo", sublabel: "Optionnel", icon: Upload },
  { key: 5, label: "Termin\u00e9 !", sublabel: "Instant", icon: Rocket },
];

const CATEGORY_TO_VERTICAL: Record<string, VerticalId> = {
  medical: "healthcare",
  para_medical: "healthcare",
  diagnostic: "healthcare",
  pharmacy_retail: "healthcare",
  clinics_centers: "healthcare",
  dental: "healthcare",
  beauty: "beauty",
  restaurant: "restaurant",
  fitness: "fitness",
  veterinary: "veterinary",
};

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
        Choisissez la cat&eacute;gorie de votre &eacute;tablissement
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
            Choisissez votre sp&eacute;cialit&eacute;
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

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: TemplatePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex gap-1 mb-3">
        <div
          className="h-2 flex-1 rounded-full"
          style={{ backgroundColor: preset.theme.primaryColor }}
        />
        <div
          className="h-2 flex-1 rounded-full"
          style={{ backgroundColor: preset.theme.secondaryColor }}
        />
        <div
          className="h-2 flex-1 rounded-full"
          style={{ backgroundColor: preset.theme.accentColor }}
        />
      </div>
      <div className="rounded-lg border bg-white overflow-hidden mb-3">
        <div
          className="h-16 flex items-end p-2"
          style={{
            background: `linear-gradient(135deg, ${preset.theme.primaryColor}, ${preset.theme.secondaryColor})`,
          }}
        >
          <div className="space-y-1">
            <div className="h-1.5 w-16 bg-white/80 rounded" />
            <div className="h-1 w-10 bg-white/50 rounded" />
          </div>
        </div>
        <div className="p-2 space-y-1.5">
          <div className="flex gap-1">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
          </div>
          <div className="h-1 w-full bg-muted rounded" />
          <div className="h-1 w-3/4 bg-muted rounded" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{preset.name}</p>
          <p className="text-xs text-muted-foreground" dir="rtl">
            {preset.nameAr}
          </p>
        </div>
        {selected && (
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [createdSubdomain, setCreatedSubdomain] = useState<string | null>(null);

  // Step 1: Your Info
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: Your Business
  const [businessSubStep, setBusinessSubStep] = useState<
    "category" | "type" | "details"
  >("category");
  const [selectedCategory, setSelectedCategory] =
    useState<ClinicTypeCategory | null>(null);
  const [selectedType, setSelectedType] = useState<ClinicTypeEntry | null>(
    null,
  );
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");

  // Step 3: Pick a Look
  const [selectedPreset, setSelectedPreset] = useState<TemplatePreset | null>(
    null,
  );

  // Step 4: Upload Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived ---
  const currentCategoryMeta = selectedCategory
    ? CLINIC_CATEGORIES.find((c) => c.key === selectedCategory) ?? null
    : null;

  const detectedVertical: VerticalId | null = selectedCategory
    ? (CATEGORY_TO_VERTICAL[selectedCategory] ?? null)
    : null;

  const availablePresets = detectedVertical
    ? getPresetsByVertical(detectedVertical)
    : [];

  // --- Step 2 handlers ---
  function handleSelectCategory(cat: ClinicCategory) {
    setSelectedCategory(cat.key);
    setSelectedType(null);
    setBusinessSubStep("type");
  }

  function handleSelectType(t: ClinicTypeEntry) {
    setSelectedType(t);
    setBusinessSubStep("details");
  }

  function handleBackToCategory() {
    setSelectedCategory(null);
    setSelectedType(null);
    setBusinessSubStep("category");
  }

  function handleBackToType() {
    setSelectedType(null);
    setBusinessSubStep("type");
  }

  // --- Logo handler ---
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // --- Create clinic and go live (Step 5) ---
  async function handleGoLive() {
    if (!selectedType || !clinicName || !ownerName || !phone) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Create clinic via onboarding API
      const createRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_type_key: selectedType.type_key,
          category: selectedType.category,
          clinic_name: clinicName,
          owner_name: ownerName,
          phone,
          email: email || undefined,
          city: city || undefined,
        }),
      });

      if (!createRes.ok) {
        const data: { error?: string } | null = await createRes
          .json()
          .catch(() => null);
        throw new Error(data?.error ?? "Registration failed");
      }

      const createResult: {
        clinic_id?: string;
        subdomain?: string | null;
      } | null = await createRes.json().catch(() => null);
      const newClinicId = createResult?.clinic_id;
      const newSubdomain = createResult?.subdomain;

      setCreatedSubdomain(newSubdomain ?? null);

      // 2. Save wizard data + auto-seed + go live
      if (newClinicId) {
        // Upload logo if provided
        if (logoFile) {
          const formData = new FormData();
          formData.append("file", logoFile);
          formData.append("category", "logos");
          formData.append("clinicId", newClinicId);
          await fetch("/api/upload", {
            method: "POST",
            body: formData,
          }).catch(() => {
            // Logo upload failure is non-fatal
          });
        }

        const wizardRes = await fetch("/api/onboarding/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_id: newClinicId,
            preset_id: selectedPreset?.id ?? null,
            auto_seed: true,
            go_live: true,
          }),
        });

        if (!wizardRes.ok) {
          const data: { error?: string } | null = await wizardRes
            .json()
            .catch(() => null);
          throw new Error(data?.error ?? "Failed to complete setup");
        }
      }

      setCompleted(true);
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
    if (currentStep === 1) {
      if (!ownerName || !phone) {
        setError("Veuillez remplir votre nom et t\u00e9l\u00e9phone");
        return;
      }
    }
    if (currentStep === 2) {
      if (!selectedType || !clinicName) {
        setError(
          "Veuillez choisir votre sp\u00e9cialit\u00e9 et nommer votre \u00e9tablissement",
        );
        return;
      }
    }
    if (currentStep < 5) {
      setError(null);
      setCurrentStep((currentStep + 1) as WizardStep);
    }
  }

  function handleBack() {
    if (currentStep === 2) {
      if (businessSubStep === "details") {
        handleBackToType();
        return;
      }
      if (businessSubStep === "type") {
        handleBackToCategory();
        return;
      }
    }
    if (currentStep > 1) {
      setError(null);
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  }

  // ---------------------------------------------------------------------------
  // Celebration screen (Step 5 completed)
  // ---------------------------------------------------------------------------
  if (completed && createdSubdomain) {
    return (
      <CelebrationPage
        clinicName={clinicName}
        subdomain={createdSubdomain}
        ownerName={ownerName}
        phone={phone}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Progress indicator
  // ---------------------------------------------------------------------------
  const progressPercent = ((currentStep - 1) / (STEP_META.length - 1)) * 100;

  const progressIndicator = (
    <div className="mb-8">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        {STEP_META.map((s) => {
          const StepIcon = s.icon;
          const isCompleted = s.key < currentStep;
          const isCurrent = s.key === currentStep;
          return (
            <div key={s.key} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => isCompleted && goToStep(s.key)}
                disabled={!isCompleted}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all ${
                  isCompleted
                    ? "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
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
                className={`text-xs hidden sm:block ${
                  isCurrent
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 1: Your Info
  // ---------------------------------------------------------------------------
  const step1Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Vos informations
        </CardTitle>
        <CardDescription>
          Renseignez vos coordonn&eacute;es pour cr&eacute;er votre compte
          administrateur.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && currentStep === 1 && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerName">Nom complet *</Label>
            <Input
              id="ownerName"
              placeholder="Dr. Ahmed Tazi"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@cabinet.ma"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">T&eacute;l&eacute;phone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+212 6XX XX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <div className="flex-1" />
          <Button onClick={handleNext} disabled={!ownerName || !phone}>
            Continuer
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Step 2: Your Business
  // ---------------------------------------------------------------------------
  const step2Content = (
    <>
      {businessSubStep === "category" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Votre activit&eacute;
            </CardTitle>
            <CardDescription>
              Quel type d&apos;&eacute;tablissement souhaitez-vous cr&eacute;er
              ?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryPicker onSelect={handleSelectCategory} />
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {businessSubStep === "type" && currentCategoryMeta && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Votre sp&eacute;cialit&eacute;
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TypePicker
              category={currentCategoryMeta}
              selectedType={selectedType}
              onSelect={handleSelectType}
              onBack={handleBackToCategory}
            />
          </CardContent>
        </Card>
      )}

      {businessSubStep === "details" && selectedType && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={handleBackToType}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Changer de sp&eacute;cialit&eacute;
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClinicTypeIcon
                  name={selectedType.icon}
                  className="h-5 w-5 text-primary"
                />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {selectedType.name_fr}
                </CardTitle>
                <CardDescription dir="rtl">
                  {selectedType.name_ar}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && currentStep === 2 && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName">
                  Nom de l&apos;&eacute;tablissement *
                </Label>
                <Input
                  id="clinicName"
                  placeholder="ex: Cabinet Dr. Ahmed"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <select
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">S&eacute;lectionnez une ville</option>
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={handleBackToType}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleNext}
                disabled={!clinicName || !selectedType}
              >
                Continuer
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Step 3: Pick a Look
  // ---------------------------------------------------------------------------
  const step3Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Choisissez un style
        </CardTitle>
        <CardDescription>
          S&eacute;lectionnez le design qui correspond le mieux &agrave; votre
          activit&eacute;. Vous pourrez le personnaliser plus tard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availablePresets.slice(0, 6).map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={selectedPreset?.id === preset.id}
              onSelect={() => setSelectedPreset(preset)}
            />
          ))}
        </div>
        {availablePresets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Un style par d&eacute;faut sera appliqu&eacute; automatiquement.
            </p>
          </div>
        )}
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div className="flex-1" />
          {!selectedPreset && (
            <Button variant="ghost" onClick={handleNext}>
              <SkipForward className="h-4 w-4 mr-1" />
              Passer
            </Button>
          )}
          <Button onClick={handleNext}>
            Continuer
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Step 4: Upload Logo
  // ---------------------------------------------------------------------------
  const step4Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5" />
          Ajoutez votre logo
        </CardTitle>
        <CardDescription>
          Optionnel &mdash; vous pouvez ajouter ou modifier votre logo plus tard
          depuis le tableau de bord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-48 h-48 rounded-2xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 cursor-pointer"
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-full h-full object-contain rounded-2xl p-2"
              />
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    Cliquez pour t&eacute;l&eacute;charger
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    PNG, JPG ou SVG
                  </p>
                </div>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
          {logoFile && (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">{logoFile.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
              >
                Supprimer
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={handleNext}>
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
  // Step 5: Review & Go Live
  // ---------------------------------------------------------------------------
  const generatedSubdomain = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");

  const step5Content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Pr&ecirc;t &agrave; lancer !
        </CardTitle>
        <CardDescription>
          V&eacute;rifiez les informations et mettez votre site en ligne en un
          clic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && currentStep === 5 && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              Votre site sera accessible &agrave;
            </p>
            <p className="text-xl font-bold text-primary font-mono">
              {generatedSubdomain || "votre-cabinet"}.oltigo.com
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Responsable</span>
                <p className="font-medium">{ownerName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  T&eacute;l&eacute;phone
                </span>
                <p className="font-medium">{phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  &Eacute;tablissement
                </span>
                <p className="font-medium">{clinicName}</p>
              </div>
              {selectedType && (
                <div>
                  <span className="text-muted-foreground">
                    Sp&eacute;cialit&eacute;
                  </span>
                  <p className="font-medium">{selectedType.name_fr}</p>
                </div>
              )}
              {city && (
                <div>
                  <span className="text-muted-foreground">Ville</span>
                  <p className="font-medium">{city}</p>
                </div>
              )}
              {selectedPreset && (
                <div>
                  <span className="text-muted-foreground">Style</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{
                        backgroundColor: selectedPreset.theme.primaryColor,
                      }}
                    />
                    <span className="font-medium text-sm">
                      {selectedPreset.name}
                    </span>
                  </div>
                </div>
              )}
              {logoFile && (
                <div>
                  <span className="text-muted-foreground">Logo</span>
                  <p className="font-medium text-green-700">
                    <Check className="h-3 w-3 inline mr-1" />
                    T&eacute;l&eacute;charg&eacute;
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">
              Ce qui sera cr&eacute;&eacute; automatiquement :
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                Services par d&eacute;faut selon votre sp&eacute;cialit&eacute;
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                Horaires de travail (Lun-Sam, 9h-18h)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                Contenu du site web (textes en FR/AR)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                Message WhatsApp de bienvenue
              </li>
            </ul>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleBack} disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Button
            className="flex-1"
            size="lg"
            disabled={loading}
            onClick={handleGoLive}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Mise en ligne...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Mettre en ligne maintenant
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
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">
          Cr&eacute;er votre &eacute;tablissement
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre site sera en ligne en moins de 2 minutes
        </p>
      </div>
      {progressIndicator}
      {currentStep === 1 && step1Content}
      {currentStep === 2 && step2Content}
      {currentStep === 3 && step3Content}
      {currentStep === 4 && step4Content}
      {currentStep === 5 && step5Content}
    </div>
  );
}
