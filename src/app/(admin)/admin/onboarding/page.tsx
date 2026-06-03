"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  UserPlus,
  Stethoscope,
  Palette,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  OnboardingStepServices,
  type ServiceFormData,
} from "@/components/super-admin/onboarding-step-services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { key: 1, label: "Clinic Details", icon: Building2 },
  { key: 2, label: "Branding", icon: Palette },
  { key: 3, label: "First Doctor", icon: UserPlus },
  { key: 4, label: "Services", icon: Stethoscope },
  { key: 5, label: "Preview", icon: CheckCircle2 },
];

const STORAGE_KEY = "oltigo_admin_onboarding_draft";

export default function AdminOnboardingWizard() {
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completed, setCompleted] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1: Details
  const [clinicName, setClinicName] = useState("");
  const [subdomain, setSubdomain] = useState("");

  // Step 2: Branding
  const [primaryColor, setPrimaryColor] = useState("#000000");

  // Step 3: First Doctor & Schedule
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");

  // Step 4: Services
  const [services, setServices] = useState<ServiceFormData[]>([
    { name: "", price: "", duration_minutes: "30", category: "consultation" },
  ]);

  // Save / Load Draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.clinicName) setClinicName(parsed.clinicName);
        if (parsed.subdomain) setSubdomain(parsed.subdomain);
        if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
        if (parsed.doctorName) setDoctorName(parsed.doctorName);
        if (parsed.doctorEmail) setDoctorEmail(parsed.doctorEmail);
        if (parsed.services) setServices(parsed.services);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          clinicName,
          subdomain,
          primaryColor,
          doctorName,
          doctorEmail,
          services,
        }),
      );
    }, 1000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [currentStep, clinicName, subdomain, primaryColor, doctorName, doctorEmail, services]);

  const handleNext = () => {
    if (currentStep === 1) {
      const step1Schema = z.object({
        clinicName: z.string().min(2, "Clinic name is required"),
        subdomain: z
          .string()
          .min(2, "Subdomain is required")
          .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
      });
      const res = step1Schema.safeParse({ clinicName, subdomain });
      if (!res.success) {
        addToast(res.error.errors[0].message, "error");
        return;
      }
    }
    if (currentStep === 3) {
      const step3Schema = z.object({
        doctorName: z.string().min(2, "Doctor name is required"),
        doctorEmail: z.string().email("Valid email is required").or(z.literal("")),
      });
      const res = step3Schema.safeParse({ doctorName, doctorEmail });
      if (!res.success) {
        addToast(res.error.errors[0].message, "error");
        return;
      }
    }
    if (currentStep === 4) {
      const validServices = services.filter((s) => s.name.trim().length > 0);
      if (validServices.length === 0) {
        addToast("Please add at least one service", "error");
        return;
      }
    }

    if (currentStep < 5) setCurrentStep((currentStep + 1) as WizardStep);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as WizardStep);
  };

  const handleFinish = async () => {
    // Basic finish flow
    localStorage.removeItem(STORAGE_KEY);
    addToast("Clinic setup completed!", "success");
    setCompleted(true);
    // Ideally this would POST to /api/onboarding/wizard
    window.location.href = "/admin/dashboard";
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Clinic Setup</h1>
        <p className="text-muted-foreground">Complete your clinic&apos;s configuration.</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s) => (
            <div key={s.key} className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  s.key === currentStep
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : s.key < currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.key < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <s.icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${s.key === currentStep ? "text-primary" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Clinic Details</CardTitle>
            <CardDescription>
              We need some basic information to get your clinic set up. You can always change this
              later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Clinic Name</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="rounded-r-none"
                />
                <span className="bg-muted px-3 py-2 border border-l-0 rounded-r-md text-sm text-muted-foreground">
                  .oltigo.com
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Set your clinic&apos;s brand colors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-4 items-center">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>First Doctor</CardTitle>
            <CardDescription>Add the primary doctor for this clinic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doctorName">Doctor Name</Label>
              <Input
                id="doctorName"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctorEmail">Email</Label>
              <Input
                id="doctorEmail"
                type="email"
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              Add doctors so they can be booked. You can add more later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingStepServices services={services} onChange={setServices} />
          </CardContent>
        </Card>
      )}

      {/* Step 5 */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re all set!</CardTitle>
            <CardDescription>Preview your booking page and go live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-2">
              <p>
                <strong>Name:</strong> {clinicName}
              </p>
              <p>
                <strong>URL:</strong> {subdomain}.oltigo.com
              </p>
              <p>
                <strong>Doctor:</strong> {doctorName}
              </p>
              <p>
                <strong>Services:</strong> {services.filter((s) => s.name).length} added
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {currentStep < 5 ? (
          <Button onClick={handleNext}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={completed}>
            <Check className="mr-2 h-4 w-4" /> Complete Setup
          </Button>
        )}
      </div>
    </div>
  );
}
