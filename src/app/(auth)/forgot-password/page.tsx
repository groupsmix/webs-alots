"use client";

import { ArrowLeft, Heart, Mail, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
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
import { resetPassword } from "@/lib/auth";
import { t, type TranslationKey } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const [locale] = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // MEDIUM 3.1: Use server action instead of client-side Supabase client.
      // This ensures rate limiting and logging are applied server-side.
      const result = await resetPassword(
        email,
        `${window.location.origin}/login`,
      );

      if (result.error) {
        setError(t(locale, result.error as TranslationKey));
        setLoading(false);
        return;
      }

      // HIGH 2.4: Always show generic success message regardless of
      // whether the email exists, preventing username enumeration.
      setSent(true);
      setLoading(false);
    } catch {
      setError(t(locale, "error.unexpected"));
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
        <h1 className="text-xl font-bold">{t(locale, "auth.portalTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(locale, "forgot.resetSubtitle")}
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
            {sent ? t(locale, "forgot.emailSent") : t(locale, "forgot.title")}
          </CardTitle>
          <CardDescription>
            {sent
              ? `${t(locale, "forgot.emailSentDesc")} ${email}`
              : t(locale, "forgot.desc")}
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
                <Label htmlFor="email">{t(locale, "auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t(locale, "auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? t(locale, "forgot.sending")
                  : t(locale, "forgot.sendLink")}
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
              {t(locale, "forgot.sendToAnother")}
            </Button>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t(locale, "forgot.backToLogin")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
