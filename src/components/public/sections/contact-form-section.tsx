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
        <h2 className="text-center text-3xl font-bold mb-4">Contact Us</h2>
        <p className="text-center text-muted-foreground mb-8">
          Have a question? Send us a message and we&apos;ll get back to you.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send a Message</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <p className="text-center text-sm text-primary font-medium py-8">
                Thank you! We&apos;ll get back to you soon.
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
                    <Label>Name</Label>
                    <Input placeholder="Your name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="you@example.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+212 6 00 00 00 00" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="How can we help you?" rows={4} required />
                </div>
                <Button type="submit" className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
