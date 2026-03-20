import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { defaultWebsiteConfig } from "@/lib/website-config";

export function DoctorsSection() {
  const aboutCfg = defaultWebsiteConfig.about;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">Our Team</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Meet our experienced medical professionals dedicated to your health.
        </p>
        <div className="max-w-sm mx-auto">
          <Card>
            <CardContent className="pt-6 text-center">
              {aboutCfg.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={aboutCfg.photoUrl}
                  alt={aboutCfg.doctorName}
                  className="rounded-full h-24 w-24 object-cover mx-auto mb-4"
                />
              ) : (
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {aboutCfg.doctorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              )}
              <h3 className="text-lg font-semibold">{aboutCfg.doctorName}</h3>
              <p className="text-sm text-primary font-medium">
                {aboutCfg.specialty}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {aboutCfg.experience}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
