"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MOROCCAN_CITIES } from "@/lib/morocco";
import { Stethoscope, Loader2, CheckCircle2 } from "lucide-react";

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
        setError(data.error || "Une erreur est survenue. Veuillez réessayer.");
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
            Un email de bienvenue a été envoyé. Vous allez être redirigé vers la page de connexion...
          </p>
          <Button onClick={() => router.push("/login")}>
            Se connecter maintenant
          </Button>
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
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
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
