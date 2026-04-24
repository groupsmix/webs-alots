import type { Metadata } from "next";
import Image from "next/image";
import { Award, Languages, GraduationCap, Briefcase } from "lucide-react";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "À propos — Notre Médecin",
  description:
    "Découvrez notre médecin, ses qualifications, son expérience et sa spécialité. Un professionnel de santé dédié à votre bien-être.",
  openGraph: {
    title: "À propos — Notre Médecin",
    description: "Découvrez notre médecin, ses qualifications et son expérience.",
  },
};

export default function AboutPage() {
  const cfg = defaultWebsiteConfig.about;

  const credentials = [
    { icon: GraduationCap, label: "Formation", value: cfg.education },
    { icon: Award, label: "Spécialisation", value: cfg.specialization },
    { icon: Briefcase, label: "Expérience", value: cfg.experience },
    { icon: Languages, label: "Langues", value: cfg.languages },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          {cfg.photoUrl ? (
            <Image
              src={cfg.photoUrl}
              alt={cfg.doctorName}
              width={128}
              height={128}
              className="h-32 w-32 rounded-full mx-auto mb-4 object-cover shadow-lg"
            />
          ) : (
            <Avatar className="h-24 w-24 mx-auto mb-4">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {cfg.doctorName.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
          )}
          <h1 className="text-3xl font-bold mb-2">{cfg.doctorName}</h1>
          <p className="text-lg text-primary font-medium">{cfg.specialty}</p>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            {cfg.bio}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-12">
          {credentials.map((cred) => (
            <Card key={cred.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <cred.icon className="h-5 w-5 text-primary" />
                  {cred.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{cred.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>À propos de notre cabinet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{cfg.practiceDescription}</p>
            <p>{cfg.practiceDetails}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
