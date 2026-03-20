"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ClinicTypeIcon } from "@/components/clinic-type-icon";
import {
  CLINIC_CATEGORIES,
  getTypesByCategory,
  type ClinicCategory,
  type ClinicTypeEntry,
} from "@/lib/config/clinic-types";
import type { ClinicTypeCategory } from "@/lib/types/database";

type OnboardingStep = "category" | "type" | "details";

interface ClinicDetails {
  clinicName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<ClinicTypeCategory | null>(null);
  const [selectedType, setSelectedType] = useState<ClinicTypeEntry | null>(null);
  const [details, setDetails] = useState<ClinicDetails>({
    clinicName: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCategory = selectedCategory
    ? CLINIC_CATEGORIES.find((c) => c.key === selectedCategory)
    : null;

  const typesForCategory = selectedCategory
    ? getTypesByCategory(selectedCategory)
    : [];

  function handleSelectCategory(cat: ClinicCategory) {
    setSelectedCategory(cat.key);
    setSelectedType(null);
    setStep("type");
  }

  function handleSelectType(t: ClinicTypeEntry) {
    setSelectedType(t);
    setStep("details");
  }

  function handleBack() {
    setError(null);
    if (step === "type") {
      setStep("category");
      setSelectedCategory(null);
      setSelectedType(null);
    } else if (step === "details") {
      setStep("type");
      setSelectedType(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_type_key: selectedType.type_key,
          category: selectedType.category,
          clinic_name: details.clinicName,
          owner_name: details.ownerName,
          phone: details.phone,
          email: details.email,
          city: details.city,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Registration failed");
      }

      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // Step indicator
  const steps: { key: OnboardingStep; label: string }[] = [
    { key: "category", label: "Catégorie" },
    { key: "type", label: "Type" },
    { key: "details", label: "Détails" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">Créer votre établissement</h1>
        <p className="text-sm text-muted-foreground">
          أنشئ مؤسستك الصحية
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i < stepIndex
                  ? "bg-primary text-primary-foreground"
                  : i === stepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm hidden sm:inline ${
                i === stepIndex ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px ${
                  i < stepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Category Selection */}
      {step === "category" && (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground mb-4">
            Choisissez la catégorie de votre établissement / اختر فئة مؤسستك
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CLINIC_CATEGORIES.map((cat) => (
              <Card
                key={cat.key}
                className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${cat.color}`}
                onClick={() => handleSelectCategory(cat)}
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
      )}

      {/* Step 2: Type Selection */}
      {step === "type" && currentCategory && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-medium">
                {currentCategory.name_fr} / {currentCategory.name_ar}
              </p>
              <p className="text-xs text-muted-foreground">
                Choisissez votre spécialité / اختر تخصصك
              </p>
            </div>
            <div className="w-16" /> {/* spacer for centering */}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {typesForCategory.map((t) => (
              <Card
                key={t.type_key}
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                  selectedType?.type_key === t.type_key
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-border"
                }`}
                onClick={() => handleSelectType(t)}
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
      )}

      {/* Step 3: Details */}
      {step === "details" && selectedType && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClinicTypeIcon
                  name={selectedType.icon}
                  className="h-5 w-5 text-primary"
                />
              </div>
              <div>
                <CardTitle className="text-lg">{selectedType.name_fr}</CardTitle>
                <CardDescription dir="rtl">
                  {selectedType.name_ar}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="clinicName">
                  Nom de l&apos;établissement / اسم المؤسسة
                </Label>
                <Input
                  id="clinicName"
                  placeholder="ex: Cabinet Dr. Ahmed"
                  value={details.clinicName}
                  onChange={(e) =>
                    setDetails({ ...details, clinicName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName">
                  Nom du responsable / اسم المسؤول
                </Label>
                <Input
                  id="ownerName"
                  placeholder="Dr. Ahmed Tazi"
                  value={details.ownerName}
                  onChange={(e) =>
                    setDetails({ ...details, ownerName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone / الهاتف</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={details.phone}
                    onChange={(e) =>
                      setDetails({ ...details, phone: e.target.value })
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
                    value={details.email}
                    onChange={(e) =>
                      setDetails({ ...details, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville / المدينة</Label>
                <Input
                  id="city"
                  placeholder="Casablanca"
                  value={details.city}
                  onChange={(e) =>
                    setDetails({ ...details, city: e.target.value })
                  }
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  "Création en cours..."
                ) : (
                  <>
                    Créer l&apos;établissement
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
