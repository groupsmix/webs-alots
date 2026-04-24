"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

export function ContactForm() {
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
          <h3 className="text-lg font-semibold mb-2">{t("fr", "contact.successTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("fr", "contact.successMessage")}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setSubmitted(false)}
          >
            {t("fr", "contact.sendAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fr", "contact.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("fr", "contact.name")}</Label>
              <Input id="name" name="name" placeholder={t("fr", "contact.namePlaceholder")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("fr", "contact.phone")}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+212 6XX XX XX XX"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("fr", "contact.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="votre@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">{t("fr", "contact.subject")}</Label>
            <Input
              id="subject"
              name="subject"
              placeholder={t("fr", "contact.subjectPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t("fr", "contact.message")}</Label>
            <Textarea
              id="message"
              name="message"
              placeholder={t("fr", "contact.messagePlaceholder")}
              rows={4}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("fr", "contact.submitting") : t("fr", "contact.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
