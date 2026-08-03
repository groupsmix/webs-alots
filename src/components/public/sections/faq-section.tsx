"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DEFAULT_FAQS = [
  {
    q: "Comment prendre rendez-vous ?",
    a: "Vous pouvez prendre rendez-vous en ligne via notre site web en cliquant sur le bouton \u00ab Prendre rendez-vous \u00bb, ou nous appeler directement pendant les heures d'ouverture.",
  },
  {
    q: "Quelles assurances acceptez-vous ?",
    a: "Nous acceptons la plupart des assurances majeures, notamment CNSS, CNOPS, RMA, SAHAM et AXA. Contactez-nous pour les détails de couverture.",
  },
  {
    q: "Quels sont vos horaires d'ouverture ?",
    a: "Nous sommes ouverts du lundi au vendredi de 9h00 à 17h00, et le samedi de 9h00 à 13h00. Nous sommes fermés le dimanche.",
  },
  {
    q: "Ai-je besoin d'une recommandation ?",
    a: "Aucune recommandation n'est nécessaire pour une consultation générale. Certains services spécialisés peuvent nécessiter une orientation de votre médecin traitant.",
  },
  {
    q: "Puis-je annuler ou reporter mon rendez-vous ?",
    a: "Oui, vous pouvez annuler ou reporter votre rendez-vous jusqu'à 24 heures à l'avance via notre site web ou en nous appelant.",
  },
];

interface FaqSectionProps {
  title?: string;
  subtitle?: string;
  faqs?: { q: string; a: string }[];
}

export function FaqSection({ title, subtitle, faqs = DEFAULT_FAQS }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-balance mb-4">
          {title ?? "Questions Fréquentes"}
        </h2>
        <p className="text-center text-muted-foreground mb-6 sm:mb-8">
          {subtitle ?? "Trouvez les réponses aux questions les plus courantes sur nos services."}
        </p>
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={faq.q} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-start text-base sm:text-lg font-medium transition-colors hover:bg-muted/50"
                >
                  <span className="text-balance">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-hidden={!isOpen}
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 pt-0 text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
