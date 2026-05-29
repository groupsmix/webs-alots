/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Building2,
  Globe,
  Database,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  SkipForward,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";

interface ProvisioningStep {
  step_key: string;
  step_label: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create_clinic: Building2,
  configure_subdomain: Globe,
  setup_tables: Database,
  assign_whatsapp: MessageSquare,
  setup_payment: CreditCard,
};

const CLINIC_TYPES = [
  { value: "doctor", label: "Doctor" },
  { value: "dentist", label: "Dentist" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "clinic", label: "Clinic" },
  { value: "hospital", label: "Hospital" },
  { value: "laboratory", label: "Laboratory" },
  { value: "veterinary", label: "Veterinary" },
  { value: "restaurant", label: "Restaurant" },
];

const TIERS = [
  { value: "vitrine", label: "Vitrine (Free)" },
  { value: "cabinet", label: "Cabinet" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
];

const GATEWAYS = [
  { value: "cmi", label: "CMI (Moroccan Interbank)" },
  { value: "stripe", label: "Stripe" },
  { value: "cash", label: "Cash Only" },
];

export default function ProvisioningWizardPage() {
  const { addToast } = useToast();
  const [wizardStep, setWizardStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);
  const [createdClinicId, setCreatedClinicId] = useState<string | null>(null);
  const [createdSubdomain, setCreatedSubdomain] = useState<string | null>(null);

  // Form state
  const [clinicName, setClinicName] = useState("");
  const [clinicType, setClinicType] = useState("doctor");
  const [tier, setTier] = useState("pro");
  const [subdomain, setSubdomain] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [paymentGateway, setPaymentGateway] = useState<string>("");
  const [subdomainManuallyEdited, setSubdomainManuallyEdited] = useState(false);

  function handleClinicNameChange(value: string) {
    setClinicName(value);
    if (!subdomainManuallyEdited) {
      setSubdomain(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/--+/g, "-"),
      );
    }
  }

  function handleSubdomainChange(value: string) {
    setSubdomain(value);
    setSubdomainManuallyEdited(true);
  }

  async function handleProvision() {
    if (!clinicName.trim() || !subdomain.trim() || !ownerName.trim() || !ownerEmail.trim()) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/onboarding-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_name: clinicName,
          clinic_type: clinicType,
          tier,
          subdomain,
          owner_name: ownerName,
          owner_email: ownerEmail,
          owner_phone: ownerPhone || undefined,
          city: city || undefined,
          specialty: specialty || undefined,
          whatsapp_number: whatsappNumber || undefined,
          payment_gateway: paymentGateway || undefined,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        addToast(json.error ?? "Provisioning failed", "error");
        return;
      }

      setCreatedClinicId(json.data.clinicId);
      setCreatedSubdomain(json.data.subdomain);
      setProvisioningSteps(json.data.steps);
      setWizardStep(3);
      addToast("Clinic provisioned successfully!", "success");
    } catch (err) {
      logger.error("Provisioning request failed", {
        context: "provision-wizard",
        error: err,
      });
      addToast("Failed to provision clinic", "error");
    } finally {
      setLoading(false);
    }
  }

  function getStepStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case "skipped":
        return <SkipForward className="h-5 w-5 text-gray-400" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Onboarding", href: "/super-admin/onboarding" },
          { label: "Auto-Provision" },
        ]}
      />

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">Auto-Provision Clinic</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatically provision a new clinic with all required infrastructure
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { step: 1, label: "Clinic Details" },
          { step: 2, label: "Infrastructure" },
          { step: 3, label: "Results" },
        ].map(({ step, label }) => (
          <div key={step} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${
                wizardStep >= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{label}</span>
            {step < 3 && <Separator className="flex-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Clinic Details */}
      {wizardStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Clinic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinicName">Clinic Name *</Label>
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => handleClinicNameChange(e.target.value)}
                  placeholder="Dr. Smith Clinic"
                />
              </div>
              <div>
                <Label htmlFor="subdomain">Subdomain *</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="subdomain"
                    value={subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    placeholder="dr-smith"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    .oltigo.com
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinicType">Clinic Type</Label>
                <Select value={clinicType} onValueChange={setClinicType}>
                  <SelectTrigger id="clinicType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINIC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tier">Subscription Tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ownerName">Owner Name *</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Dr. Ahmed Smith"
                />
              </div>
              <div>
                <Label htmlFor="ownerEmail">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="ahmed@clinic.ma"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ownerPhone">Owner Phone</Label>
                <Input
                  id="ownerPhone"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+212 6XX XXX XXX"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Casablanca"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="General Medicine"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setWizardStep(2)}>
                Next: Infrastructure <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Infrastructure Config */}
      {wizardStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Infrastructure Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsappNumber">WhatsApp Business Number</Label>
              <Input
                id="whatsappNumber"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+212 6XX XXX XXX (optional)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to skip WhatsApp number assignment
              </p>
            </div>

            <div>
              <Label htmlFor="paymentGateway">Payment Gateway</Label>
              <Select value={paymentGateway} onValueChange={setPaymentGateway}>
                <SelectTrigger id="paymentGateway">
                  <SelectValue placeholder="Select gateway (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAYS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to skip payment gateway setup
              </p>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Provisioning will:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Create clinic record with config
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Configure subdomain: {subdomain || "..."}.oltigo.com
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4" /> Setup database tables with RLS
                </li>
                {whatsappNumber && (
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Assign WhatsApp number
                  </li>
                )}
                {paymentGateway && (
                  <li className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Setup {paymentGateway.toUpperCase()} payment
                    gateway
                  </li>
                )}
              </ul>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleProvision} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Provisioning...
                  </>
                ) : (
                  "Provision Clinic"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {wizardStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Provisioning Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">
                Clinic &quot;{clinicName}&quot; has been provisioned
              </p>
              <p className="text-xs text-green-600 mt-1">
                Clinic ID: <code className="bg-green-100 px-1 rounded">{createdClinicId}</code>
              </p>
              {createdSubdomain && (
                <p className="text-xs text-green-600 mt-1">
                  URL:{" "}
                  <a
                    href={`https://${createdSubdomain}.oltigo.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {createdSubdomain}.oltigo.com
                  </a>
                </p>
              )}
            </div>

            {/* Provisioning Steps */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Provisioning Steps</h3>
              {provisioningSteps.map((step) => {
                const Icon = STEP_ICONS[step.step_key] ?? Building2;
                return (
                  <div
                    key={step.step_key}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    {getStepStatusIcon(step.status)}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{step.step_label}</p>
                      {step.error_message && (
                        <p className="text-xs text-red-600">{step.error_message}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        step.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : step.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : step.status === "skipped"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="flex gap-3 justify-end">
              <Link href="/super-admin/onboarding">
                <Button variant="outline">Continue to Full Onboarding</Button>
              </Link>
              <Link href="/super-admin/clinics">
                <Button>View All Clinics</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
