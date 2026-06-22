/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
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

// Audit #2: only these system types satisfy the `clinics.type` CHECK
// constraint (migration 00001). Offering unsupported types caused the
// provisioning INSERT to fail and surface a misleading error.
const CLINIC_TYPES = [
  { value: "doctor", label: "Médecin" },
  { value: "dentist", label: "Dentiste" },
  { value: "pharmacy", label: "Pharmacie" },
];

const TIERS = [
  { value: "vitrine", label: "Vitrine (Gratuit)" },
  { value: "cabinet", label: "Cabinet" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" },
  { value: "saas", label: "SaaS" },
];

const GATEWAYS = [
  { value: "cmi", label: "CMI (Interbancaire Marocain)" },
  { value: "stripe", label: "Stripe" },
  { value: "cash", label: "Espèces uniquement" },
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
      addToast("Veuillez remplir tous les champs obligatoires", "error");
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
        addToast(json.error ?? "Échec du provisionnement", "error");
        return;
      }

      setCreatedClinicId(json.data.clinicId);
      setCreatedSubdomain(json.data.subdomain);
      setProvisioningSteps(json.data.steps);
      setWizardStep(3);
      addToast("Clinique provisionnée avec succès !", "success");
    } catch (err) {
      logger.error("Provisioning request failed", {
        context: "provision-wizard",
        error: err,
      });
      addToast("Échec du provisionnement de la clinique", "error");
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
          { label: "Intégration", href: "/super-admin/onboarding" },
          { label: "Provisionnement auto" },
        ]}
      />

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">Provisionnement automatique</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provisionner automatiquement une nouvelle clinique avec toute l&apos;infrastructure
          requise
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { step: 1, label: "Détails clinique" },
          { step: 2, label: "Infrastructure" },
          { step: 3, label: "Résultats" },
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
              Informations de la clinique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinicName">Nom de la clinique *</Label>
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => handleClinicNameChange(e.target.value)}
                  placeholder="Clinique Dr. Ahmed"
                />
              </div>
              <div>
                <Label htmlFor="subdomain">Sous-domaine *</Label>
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
                <Label htmlFor="clinicType">Type de clinique</Label>
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
                <Label htmlFor="tier">Forfait d&apos;abonnement</Label>
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
                <Label htmlFor="ownerName">Nom du propriétaire *</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Dr. Ahmed Benali"
                />
              </div>
              <div>
                <Label htmlFor="ownerEmail">Email du propriétaire *</Label>
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
                <Label htmlFor="ownerPhone">Téléphone du propriétaire</Label>
                <Input
                  id="ownerPhone"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+212 6XX XXX XXX"
                />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Casablanca"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="specialty">Spécialité</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Médecine générale"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setWizardStep(2)}>
                Suivant : Infrastructure <ArrowRight className="h-4 w-4 ml-1" />
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
              Configuration de l&apos;infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsappNumber">Numéro WhatsApp Business</Label>
              <Input
                id="whatsappNumber"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+212 6XX XXX XXX (optionnel)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Laisser vide pour ignorer l&apos;attribution du numéro WhatsApp
              </p>
            </div>

            <div>
              <Label htmlFor="paymentGateway">Passerelle de paiement</Label>
              <Select value={paymentGateway} onValueChange={setPaymentGateway}>
                <SelectTrigger id="paymentGateway">
                  <SelectValue placeholder="Sélectionner la passerelle (optionnel)" />
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
                Laisser vide pour ignorer la configuration du paiement
              </p>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Le provisionnement va :</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Créer l&apos;enregistrement clinique
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Configurer le sous-domaine : {subdomain || "..."}
                  .oltigo.com
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4" /> Configurer les tables avec RLS
                </li>
                {whatsappNumber && (
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Attribuer le numéro WhatsApp
                  </li>
                )}
                {paymentGateway && (
                  <li className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Configurer la passerelle{" "}
                    {paymentGateway.toUpperCase()}
                  </li>
                )}
              </ul>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={handleProvision} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Provisionnement...
                  </>
                ) : (
                  "Provisionner la clinique"
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
              Provisionnement terminé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">
                La clinique &quot;{clinicName}&quot; a été provisionnée
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
              <h3 className="text-sm font-semibold">Étapes du provisionnement</h3>
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
                <Button variant="outline">Continuer l&apos;intégration complète</Button>
              </Link>
              <Link href="/super-admin/clinics">
                <Button>Voir toutes les cliniques</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
