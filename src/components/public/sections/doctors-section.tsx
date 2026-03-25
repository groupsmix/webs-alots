import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicDoctors } from "@/lib/data/public";

export async function DoctorsSection() {
  const doctors = await getPublicDoctors();

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">Notre Équipe</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Découvrez nos professionnels de santé dédiés à votre bien-être.
        </p>
        {doctors.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {doctors.map((doctor) => (
              <Card key={doctor.id}>
                <CardContent className="pt-6 text-center">
                  {doctor.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doctor.avatar}
                      alt={doctor.name}
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
                    <p className="text-sm text-primary font-medium">
                      {doctor.specialty}
                    </p>
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
