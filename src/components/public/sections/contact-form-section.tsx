"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactFormSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 max-w-xl">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-balance mb-4">
          Contactez-nous
        </h2>
        <p className="text-center text-muted-foreground mb-6 sm:mb-8">
          Vous avez une question ? Envoyez-nous un message et nous vous répondrons rapidement.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envoyer un message</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <p className="text-center text-sm text-primary font-medium py-8">
                Merci ! Nous vous répondrons dans les plus brefs délais.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Nom</Label>
                    <Input
                      id="contact-name"
                      name="name"
                      className="min-h-11"
                      placeholder="Votre nom"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      name="email"
                      className="min-h-11"
                      type="email"
                      placeholder="votre@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Téléphone</Label>
                  <Input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    className="min-h-11"
                    placeholder="+212 6XX XX XX XX"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    name="message"
                    className="min-h-24"
                    placeholder="Comment pouvons-nous vous aider ?"
                    rows={4}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full min-h-11"
                  data-event="cta-public-contact-submit"
                >
                  <Send className="h-4 w-4 me-2" aria-hidden="true" />
                  Envoyer le message
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
