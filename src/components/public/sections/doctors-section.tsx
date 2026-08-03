/* eslint-disable i18next/no-literal-string */
import { Award, BookOpen, Globe, Phone } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicDoctors } from "@/lib/data/public";
import { publicCardClass } from "@/lib/public-theme";
import type { TemplateDefinition } from "@/lib/templates";
import { cn } from "@/lib/utils";

interface DoctorsSectionProps {
  cardStyle?: TemplateDefinition["cardStyle"];
  template?: TemplateDefinition;
  clinicName?: string;
}

export async function DoctorsSection({
  cardStyle = "shadow",
  template,
  clinicName,
}: DoctorsSectionProps) {
  const doctors = await getPublicDoctors();
  const isPremium = template?.id === "premium";

  // Deduplicate by name and prefer entries with a specialty/avatar.
  const seen = new Map<string, (typeof doctors)[number]>();
  for (const doctor of doctors) {
    const key = doctor.name.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || doctor.specialty || doctor.avatar) {
      seen.set(key, doctor);
    }
  }
  const uniqueDoctors = Array.from(seen.values());
  const primaryDoctor = uniqueDoctors[0];

  if (uniqueDoctors.length === 0) {
    return (
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Les informations sur notre équipe seront disponibles prochainement.
          </p>
        </div>
      </section>
    );
  }

  if (isPremium && primaryDoctor) {
    const meta = {
      experience: "Plus de 10 ans d'expérience",
      education: "Faculté de Médecine et de Pharmacie",
      languages: primaryDoctor.languages?.length
        ? primaryDoctor.languages.map((l) => l.toUpperCase()).join(", ")
        : "Français, Arabe",
      ...((primaryDoctor as unknown as { meta?: Record<string, string> }).meta ?? {}),
    };

    return (
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-10 lg:gap-16 lg:grid-cols-2 items-center">
              <div className="relative mx-auto lg:mx-0 max-w-md">
                <div className="absolute inset-0 -rotate-3 rounded-[2rem] bg-primary/10" />
                {primaryDoctor.avatar ? (
                  <Image
                    src={primaryDoctor.avatar}
                    alt={primaryDoctor.name}
                    width={520}
                    height={520}
                    className="relative rounded-[2rem] h-80 sm:h-[28rem] w-full object-cover shadow-2xl"
                  />
                ) : (
                  <div className="relative flex h-80 sm:h-[28rem] items-center justify-center rounded-[2rem] bg-card shadow-2xl">
                    <Avatar className="h-32 w-32">
                      <AvatarFallback className="text-5xl bg-primary/10 text-primary">
                        {primaryDoctor.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              <div className="text-center lg:text-start">
                <h2 className="text-sm font-bold uppercase tracking-wide text-primary mb-2">
                  Rencontrez votre médecin
                </h2>
                <h3 className="text-3xl sm:text-4xl font-bold text-balance mb-3">
                  {primaryDoctor.name}
                </h3>
                {primaryDoctor.specialty && (
                  <p className="text-lg text-primary font-medium mb-6">{primaryDoctor.specialty}</p>
                )}
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  {clinicName
                    ? `Médecin dévoué au sein de ${clinicName}, offrant des soins personnalisés et attentionnés à chaque patient.`
                    : "Médecin dévoué offrant des soins personnalisés et attentionnés à chaque patient."}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { icon: Award, label: meta.experience },
                    { icon: BookOpen, label: meta.education },
                    { icon: Globe, label: `Langues : ${meta.languages}` },
                    primaryDoctor.phone
                      ? { icon: Phone, label: primaryDoctor.phone }
                      : { icon: Phone, label: "Réservation en ligne" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <span className="text-sm text-muted-foreground text-start">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-balance mb-4">
          Notre Équipe
        </h2>
        <p className="text-center text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto">
          Découvrez nos professionnels de santé dédiés à votre bien-être.
        </p>
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {uniqueDoctors.map((doctor) => (
            <Card key={doctor.id} className={cn(publicCardClass(cardStyle), "text-center")}>
              <CardContent className="pt-6">
                {doctor.avatar ? (
                  <Image
                    src={doctor.avatar}
                    alt={doctor.name}
                    width={96}
                    height={96}
                    className="rounded-full h-24 w-24 object-cover mx-auto mb-4"
                  />
                ) : (
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {doctor.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                )}
                <h3 className="text-lg font-semibold">{doctor.name}</h3>
                {doctor.specialty && (
                  <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
