"use client";

import { Award, Languages, GraduationCap, Briefcase } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultWebsiteConfig } from "@/lib/website-config";

/**
 * Clinic about page — shown on subdomains.
 * Displays doctor info, credentials, and practice details.
 */
export function ClinicAboutContent() {
  const cfg = defaultWebsiteConfig.about;

  const credentials = [
    { icon: GraduationCap, label: "Formation", value: cfg.education },
    { icon: Award, label: "Sp\u00E9cialisation", value: cfg.specialization },
    { icon: Briefcase, label: "Exp\u00E9rience", value: cfg.experience },
    { icon: Languages, label: "Langues", value: cfg.languages },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          {cfg.photoUrl ? (
            <Image
              src={cfg.photoUrl}
              alt={cfg.doctorName}
              width={128}
              height={128}
              className="mx-auto mb-4 h-32 w-32 rounded-full object-cover shadow-lg"
            />
          ) : (
            <Avatar className="mx-auto mb-4 h-24 w-24">
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                {cfg.doctorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          )}
          <h1 className="mb-2 text-3xl font-bold">{cfg.doctorName}</h1>
          <p className="text-lg font-medium text-primary">{cfg.specialty}</p>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{cfg.bio}</p>
        </div>

        <div className="mb-12 grid gap-4 md:grid-cols-2">
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
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <CardTitle>{"\u00C0 propos de notre cabinet"}</CardTitle>
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
