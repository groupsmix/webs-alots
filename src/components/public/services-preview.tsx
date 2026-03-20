import Link from "next/link";
import { Stethoscope, Calendar, FileText, ArrowRight } from "lucide-react";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

const previewServices = [
  {
    icon: Stethoscope,
    title: "General Consultation",
    description: "Comprehensive health check-ups and medical consultations.",
  },
  {
    icon: Calendar,
    title: "Easy Booking",
    description:
      "Book your appointment online in minutes, 24/7 availability.",
  },
  {
    icon: FileText,
    title: "Digital Records",
    description:
      "Access your medical history, prescriptions, and documents online.",
  },
];

export function ServicesPreview() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-12">Our Services</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {previewServices.map((service) => (
            <div
              key={service.title}
              className="rounded-xl border bg-card p-6 text-center shadow-sm"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/services"
            className={linkBtnOutline}
          >
            View All Services
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
