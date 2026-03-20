import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = {
  title: "Prendre Rendez-vous",
  description:
    "Réservez votre rendez-vous médical en ligne en quelques clics. Choisissez votre créneau et confirmez instantanément.",
  openGraph: {
    title: "Prendre Rendez-vous",
    description: "Réservez votre rendez-vous médical en ligne en quelques clics.",
  },
};

export default function BookingPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <BookingForm />
    </div>
  );
}
