"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Heart, Mail, Check } from "lucide-react";
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
import { createClient } from "@/lib/supabase-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/login`,
        },
      );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch {
      setError("Une erreur inattendue s'est produite. Veuillez réessayer.");
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
        <p className="text-sm text-muted-foreground">
          Réinitialisez votre mot de passe
        </p>
      </div>

      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {sent ? (
              <Check className="h-6 w-6 text-primary" />
            ) : (
              <Mail className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {sent ? "E-mail envoyé" : "Mot de passe oublié"}
          </CardTitle>
          <CardDescription>
            {sent
              ? `Un lien de réinitialisation a été envoyé à ${email}. Vérifiez votre boîte de réception.`
              : "Entrez votre adresse e-mail pour recevoir un lien de réinitialisation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!sent && (
            <form className="space-y-4" onSubmit={handleSubmit}>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Envoi en cours..."
                  : "Envoyer le lien de réinitialisation"}
              </Button>
            </form>
          )}

          {sent && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Envoyer à une autre adresse
            </Button>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
