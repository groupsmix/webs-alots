import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicDoctors } from "@/lib/data/public";
import { publicCardClass } from "@/lib/public-theme";
import type { TemplateDefinition } from "@/lib/templates";

interface DoctorsSectionProps {
  cardStyle?: TemplateDefinition["cardStyle"];
}

export async function DoctorsSection({ cardStyle = "shadow" }: DoctorsSectionProps) {
  const doctors = await getPublicDoctors();

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

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-balance mb-4">
          Notre Équipe
        </h2>
        <p className="text-center text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto">
          Découvrez nos professionnels de santé dédiés à votre bien-être.
        </p>
        {uniqueDoctors.length > 0 ? (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {uniqueDoctors.map((doctor) => (
              <Card key={doctor.id} className={publicCardClass(cardStyle)}>
                <CardContent className="pt-6 text-center">
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
        ) : (
          <p className="text-center text-muted-foreground">
            Les informations sur notre équipe seront disponibles prochainement.
          </p>
        )}
      </div>
    </section>
  );
}
