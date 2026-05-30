"use client";

import { Stethoscope, Loader2, CheckCircle2, Mail, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOROCCAN_CITIES } from "@/lib/morocco";
import { cn } from "@/lib/utils";

// Mirrors the server-side SELF_SERVICE_REGISTRATION_ENABLED gate in
// /api/v1/register-clinic. The server flag is the source of truth; this
// public mirror only exists so we can render the right UI at page load
// instead of letting the operator fill out the entire form and then hit
// a 403 "disabled" error from the API.
//
// Both flags must be "true" for self-service to actually work in
// production (see SECURITY_FLAG_ACKNOWLEDGMENTS in src/lib/env.ts —
// SELF_SERVICE_REGISTRATION_ACK is also required at server startup).
const SELF_SERVICE_REGISTRATION_ENABLED =
  process.env.NEXT_PUBLIC_SELF_SERVICE_REGISTRATION_ENABLED === "true"; // nosemgrep: semgrep.env-access — NEXT_PUBLIC_* is inlined at build time by Next.js for client bundle; mirror of server flag in env.ts

const CONTACT_EMAIL = "contact@oltigo.com";

const SPECIALTIES = [
  "Médecine générale",
  "Dentiste",
  "Pédiatrie",
  "Gynécologie",
  "Dermatologie",
  "Cardiologie",
  "Ophtalmologie",
  "ORL",
  "Orthopédie",
  "Neurologie",
  "Psychiatrie",
  "Urologie",
  "Pneumologie",
  "Endocrinologie",
  "Rhumatologie",
  "Kinésithérapie",
  "Nutritionniste",
  "Pharmacie",
  "Laboratoire",
  "Radiologie",
  "Autre",
];

interface RegistrationResult {
  clinic_url: string;
  subdomain: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegistrationResult | null>(null);

  const [form, setForm] = useState({
    clinic_name: "",
    doctor_name: "",
    email: "",
    phone: "",
    specialty: "",
    city: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/register-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        // If the server returns the "disabled" 403, show the French
        // operator-facing message + contact path rather than echoing
        // the raw English API string into the red error box.
        if (res.status === 403 && typeof data.error === "string") {
          setError(
            "L'inscription en libre-service est actuellement indisponible. " +
              `Pour créer votre clinique, contactez-nous à ${CONTACT_EMAIL}.`,
          );
        } else {
          setError(data.error || "Une erreur est survenue. Veuillez réessayer.");
        }
        return;
      }

      setSuccess({
        clinic_url: data.data.clinic_url,
        subdomain: data.data.subdomain,
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  // When self-service is disabled (current default per audit R-12), don't
  // make the operator fill out 6 fields just to get a 403. Show a clear
  // "contact us" panel up front with the same visual structure as the form.
  if (!SELF_SERVICE_REGISTRATION_ENABLED) {
    const subject = encodeURIComponent("Demande d'inscription clinique");
    const body = encodeURIComponent(
      "Bonjour Oltigo,\n\n" +
        "Je souhaite créer un compte clinique sur la plateforme.\n\n" +
        "- Nom de la clinique :\n" +
        "- Nom du docteur :\n" +
        "- Spécialité :\n" +
        "- Ville :\n" +
        "- Téléphone :\n\n" +
        "Merci.",
    );
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Inscription par contact</CardTitle>
          <CardDescription>
            L&apos;inscription en libre-service est temporairement fermée — chaque clinique est
            vérifiée manuellement par notre équipe avant activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Pour créer votre clinique, écrivez-nous : nous vous accompagnons dans la mise en service
            en moins de 24h.
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`}
            className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full")}
          >
            <Mail className="mr-2 h-4 w-4" />
            Nous contacter — {CONTACT_EMAIL}
          </a>
          <p className="text-center text-xs text-muted-foreground">
            Vous avez déjà un compte ?{" "}
            <a href="/login" className="text-primary underline">
              Se connecter
            </a>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Vous êtes un patient ?{" "}
            <a href="/register" className="text-primary underline">
              Créer un compte patient
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl">Clinique créée avec succès !</CardTitle>
          <CardDescription>
            Votre site est disponible à :{" "}
            <a
              href={success.clinic_url}
              className="font-medium text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {success.clinic_url}
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Un email de bienvenue a été envoyé. Vous allez être redirigé vers la page de
            connexion...
          </p>
          <Button onClick={() => router.push("/login")}>Se connecter maintenant</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Créer votre clinique</CardTitle>
        <CardDescription>
          Commencez gratuitement — obtenez votre site web professionnel en quelques minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Clinic Name */}
          <div className="space-y-1.5">
            <Label htmlFor="clinic_name">Nom de la clinique *</Label>
            <Input
              id="clinic_name"
              placeholder="Ex: Cabinet Dr Ahmed"
              value={form.clinic_name}
              onChange={(e) => updateField("clinic_name", e.target.value)}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          {/* Doctor Name */}
          <div className="space-y-1.5">
            <Label htmlFor="doctor_name">Nom du docteur *</Label>
            <Input
              id="doctor_name"
              placeholder="Ex: Dr Ahmed Benali"
              value={form.doctor_name}
              onChange={(e) => updateField("doctor_name", e.target.value)}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="docteur@email.com"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
              maxLength={254}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0612345678"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              required
              minLength={8}
              maxLength={30}
            />
          </div>

          {/* Specialty */}
          <div className="space-y-1.5">
            <Label htmlFor="specialty">Spécialité *</Label>
            <select
              id="specialty"
              value={form.specialty}
              onChange={(e) => updateField("specialty", e.target.value)}
              required
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sélectionnez une spécialité</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville</Label>
            <select
              id="city"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Sélectionnez une ville</option>
              {MOROCCAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              "Commencer gratuitement"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Vous avez déjà un compte ?{" "}
            <a href="/login" className="text-primary underline">
              Se connecter
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
