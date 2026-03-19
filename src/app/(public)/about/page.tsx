import { Award, Languages, GraduationCap, Briefcase } from "lucide-react";
import { doctors } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const credentials = [
  { icon: GraduationCap, label: "Education", value: "Doctor of Medicine — University of Casablanca" },
  { icon: Award, label: "Specialization", value: "Board Certified in General & Internal Medicine" },
  { icon: Briefcase, label: "Experience", value: "15+ years of clinical practice" },
  { icon: Languages, label: "Languages", value: "Arabic, French, English" },
];

export default function AboutPage() {
  const mainDoctor = doctors[0];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Avatar className="h-24 w-24 mx-auto mb-4">
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {mainDoctor.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold mb-2">{mainDoctor.name}</h1>
          <p className="text-lg text-primary font-medium">{mainDoctor.specialty}</p>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Dedicated to providing exceptional healthcare with a patient-centered
            approach. Combining modern medical practices with compassionate care
            for every patient.
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
            <CardTitle>About Our Practice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Our clinic is equipped with modern medical technology and provides
              a comfortable, welcoming environment for all patients. We believe
              in preventive medicine and thorough diagnosis to ensure the best
              outcomes.
            </p>
            <p>
              Whether you need a routine check-up, specialized consultation, or
              ongoing care management, our team is here to support your health
              journey. We accept most major insurance providers including CNSS
              and CNOPS.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
