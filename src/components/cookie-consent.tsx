"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * GDPR / Loi 09-08 cookie consent banner.
 * Stores consent in localStorage so it only shows once.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    if (typeof window !== "undefined") {
      localStorage.setItem("cookie-consent", "accepted");
    }
    setVisible(false);
  }

  function decline() {
    if (typeof window !== "undefined") {
      localStorage.setItem("cookie-consent", "declined");
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg md:flex md:items-center md:justify-between md:gap-4 md:px-6"
    >
      <p className="text-sm text-muted-foreground mb-3 md:mb-0">
        Ce site utilise des cookies pour améliorer votre expérience.
        En continuant, vous acceptez notre{" "}
        <a href="/privacy" className="underline hover:text-foreground">
          politique de confidentialité
        </a>
        .
      </p>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={decline}>
          Refuser
        </Button>
        <Button size="sm" onClick={accept}>
          Accepter
        </Button>
      </div>
    </div>
  );
}
