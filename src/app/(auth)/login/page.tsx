"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone, ShieldCheck, ArrowLeft, Heart, Mail, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signInWithOTP, verifyOTP, signInWithPassword } from "@/lib/auth";
const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);

    try {
      const result = await signInWithPassword(email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleSendOTP(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    setLoading(true);

    try {
      const result = await signInWithOTP(phone);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setStep("otp");
      setLoading(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await verifyOTP(phone, otp);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-bold">Portail Santé</h1>
        <p className="text-sm text-muted-foreground">Connectez-vous pour gérer votre santé</p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {step === "otp" ? (
              <ShieldCheck className="h-6 w-6 text-primary" />
            ) : method === "email" ? (
              <Mail className="h-6 w-6 text-primary" />
            ) : (
              <Phone className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {step === "otp"
              ? "Vérifiez votre numéro"
              : "Connexion"}
          </CardTitle>
          <CardDescription>
            {step === "otp"
              ? `Nous avons envoyé un code à 6 chiffres au ${phone}`
              : method === "email"
                ? "Entrez votre e-mail et mot de passe pour vous connecter."
                : "Entrez votre numéro de téléphone pour recevoir un code de vérification."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "otp" && PHONE_AUTH_ENABLED ? (
            <form className="space-y-4" onSubmit={handleVerifyOTP}>
              <div className="space-y-2">
                <Label htmlFor="otp">Code de vérification</Label>
                <Input
                  id="otp"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Vous n&apos;avez pas reçu le code ?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => handleSendOTP()}
                  >
                    Renvoyer
                  </button>
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Vérification..." : "Vérifier et se connecter"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setError(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Utiliser un autre numéro
              </Button>
            </form>
          ) : method === "email" ? (
            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
              {PHONE_AUTH_ENABLED && (
                <>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMethod("phone");
                      setError(null);
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Se connecter avec téléphone
                  </Button>
                </>
              )}
            </form>
          ) : PHONE_AUTH_ENABLED ? (
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+212 6XX XX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Nous vous enverrons un code de vérification unique par SMS.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi du code..." : "Envoyer le code de vérification"}
              </Button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMethod("email");
                  setError(null);
                }}
              >
                <Lock className="h-4 w-4 mr-2" />
                Se connecter avec e-mail
              </Button>
            </form>
          ) : null}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;avez pas de compte ?{" "}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              S&apos;inscrire
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
