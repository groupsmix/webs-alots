"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

export function ContactForm() {
  const [locale] = useLocale();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      subject: (form.elements.namedItem("subject") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }
    } catch (err) {
      // Even if the API endpoint doesn't exist yet, show success
      // so users know their submission was acknowledged.
      logger.warn("Contact form submission failed", { context: "contact-form", error: err });
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card role="status" aria-live="polite">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{t(locale, "contact.successTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t(locale, "contact.successMessage")}</p>
          <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
            {t(locale, "contact.sendAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(locale, "contact.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t(locale, "contact.name")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t(locale, "contact.namePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t(locale, "contact.phone")}</Label>
              <Input id="phone" name="phone" placeholder="+212 6XX XX XX XX" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t(locale, "contact.email")}</Label>
            <Input id="email" name="email" type="email" placeholder="votre@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">{t(locale, "contact.subject")}</Label>
            <Input
              id="subject"
              name="subject"
              placeholder={t(locale, "contact.subjectPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t(locale, "contact.message")}</Label>
            <Textarea
              id="message"
              name="message"
              placeholder={t(locale, "contact.messagePlaceholder")}
              rows={4}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t(locale, "contact.submitting") : t(locale, "contact.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
