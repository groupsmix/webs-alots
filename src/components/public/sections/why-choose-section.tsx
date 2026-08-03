/* eslint-disable i18next/no-literal-string */
import { Award, Clock, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { publicCardClass } from "@/lib/public-theme";
import type { TemplateDefinition } from "@/lib/templates";

interface WhyChooseSectionProps {
  clinicName?: string;
  cardStyle?: TemplateDefinition["cardStyle"];
}

const reasons = [
  {
    icon: Award,
    title: "Médecin expérimenté",
    description: "Des années de pratique médicale au service de votre santé.",
  },
  {
    icon: Clock,
    title: "Rendez-vous rapides",
    description:
      "Prise de rendez-vous en ligne et rappels WhatsApp pour ne jamais rater une consultation.",
  },
  {
    icon: ShieldCheck,
    title: "Soins personnalisés",
    description: "Une approche centrée sur le patient, avec un suivi attentif et sur mesure.",
  },
  {
    icon: Users,
    title: "Cabinet moderne",
    description:
      "Un environnement accueillant et des équipements adaptés à la médecine contemporaine.",
  },
];

export function WhyChooseSection({
  clinicName = "Notre cabinet",
  cardStyle = "elevated",
}: WhyChooseSectionProps) {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance mb-4">
            Pourquoi choisir {clinicName} ?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Un cabinet de médecine générale engagé pour votre bien-être au quotidien.
          </p>
        </div>
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <Card
                key={reason.title}
                className={`group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${publicCardClass(cardStyle)}`}
              >
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{reason.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {reason.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
