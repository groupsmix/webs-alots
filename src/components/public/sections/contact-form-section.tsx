"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";

export function ContactFormSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-xl">
        <h2 className="text-center text-3xl font-bold mb-4">Contactez-nous</h2>
        <p className="text-center text-muted-foreground mb-8">
          Vous avez une question ? Envoyez-nous un message et nous vous
          répondrons rapidement.
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
                    <Label>Nom</Label>
                    <Input placeholder="Votre nom" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="votre@email.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input placeholder="+212 6XX XX XX XX" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="Comment pouvons-nous vous aider ?" rows={4} required />
                </div>
                <Button type="submit" className="w-full">
                  <Send className="h-4 w-4 mr-2" />
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
