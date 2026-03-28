import type { Metadata } from "next";
import Image from "next/image";
import {
  Award, Languages, GraduationCap, Briefcase, Stethoscope,
  MapPin, Phone, Mail, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";
import { getPublicDoctors, getPublicBranding } from "@/lib/data/public";
import { clinicConfig } from "@/config/clinic.config";

export const metadata: Metadata = {
  title: "Doctor Profile",
  description:
    "Meet our doctor — qualifications, speciality, diplomas, languages spoken, and more.",
  openGraph: {
    title: "Doctor Profile",
    description: "Meet our doctor — qualifications, speciality, and experience.",
  },
};

export default async function DoctorProfilePage() {
  const [doctors, branding] = await Promise.all([
    getPublicDoctors(),
    getPublicBranding(),
  ]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Our Medical Team</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Meet the dedicated healthcare professionals at {branding.clinicName}
        </p>
      </div>

      {doctors.length === 0 ? (
        <p className="text-center text-muted-foreground">No doctors listed yet.</p>
      ) : (
        <div className="space-y-8 max-w-4xl mx-auto">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden">
              <div className="md:flex">
                {/* Photo / Avatar */}
                <div className="md:w-64 flex-shrink-0 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-8">
                  {doctor.avatar ? (
                    <Image
                      src={doctor.avatar}
                      alt={doctor.name}
                      width={160}
                      height={160}
                      className="h-40 w-40 rounded-full object-cover shadow-lg"
                    />
                  ) : (
                    <Avatar className="h-32 w-32">
                      <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                        {doctor.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">{doctor.name}</h2>
                      {doctor.specialty && (
                        <Badge variant="secondary" className="mt-1">
                          <Stethoscope className="h-3 w-3 mr-1" />
                          {doctor.specialty}
                        </Badge>
                      )}
                    </div>
                    <Link
                      href="/book"
                      className={buttonVariants({ size: "sm" })}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Book Appointment
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 mb-4">
                    {doctor.consultationFee > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-primary" />
                        <span>Consultation: <strong>{doctor.consultationFee} {clinicConfig.currency}</strong></span>
                      </div>
                    )}
                    {doctor.languages.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Languages className="h-4 w-4 text-primary" />
                        <span>{doctor.languages.join(", ")}</span>
                      </div>
                    )}
                    {doctor.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{doctor.phone}</span>
                      </div>
                    )}
                    {doctor.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{doctor.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Diplomas / Credentials placeholder */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      Board Certified
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {clinicConfig.type === "dentist" ? "Dental Surgery" : "General Medicine"}
                    </Badge>
                    {branding.address && (
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {branding.address}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
