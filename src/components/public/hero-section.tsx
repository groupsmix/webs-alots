"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinic.config";

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary/5 to-primary/10 py-24">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Welcome to {clinicConfig.name}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Professional healthcare services with easy online booking. Schedule
          your appointment today.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/book" className={buttonVariants({ size: "lg" })}>
            Book an Appointment
          </Link>
          <Link
            href="/services"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Our Services
          </Link>
        </div>
      </div>
    </section>
  );
}
