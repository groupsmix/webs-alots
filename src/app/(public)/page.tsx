import type { Metadata } from "next";
import { getTenant } from "@/lib/tenant";
import { LandingPage } from "@/components/landing/landing-page";
import { HeroSection } from "@/components/public/hero-section";
import { ServicesPreview } from "@/components/public/services-preview";
import {
  getPublicReviews,
  getPublicAverageRating,
  getPublicBranding,
} from "@/lib/data/public";
import { mergeSectionVisibility } from "@/lib/section-visibility";
import { getTemplate } from "@/lib/templates";
import { Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  DoctorsSection,
  BookingSection,
  ContactFormSection,
  InsuranceSection,
  FaqSection,
  BeforeAfterSection,
  BlogSection,
  LocationSection,
} from "@/components/public/sections";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  if (!tenant) {
    return {
      title: "Oltigo — La plateforme complète pour gérer votre cabinet médical",
      description:
        "Créez le site de votre cabinet, gérez les rendez-vous et développez votre activité facilement. Plateforme SaaS pour médecins et cabinets au Maroc.",
      openGraph: {
        title: "Oltigo — La plateforme complète pour gérer votre cabinet médical",
        description:
          "Créez le site de votre cabinet, gérez les rendez-vous et développez votre activité facilement.",
        type: "website",
        locale: "fr_MA",
        siteName: "Oltigo",
      },
    };
  }

  // Pull clinic branding for SEO-rich meta tags
  const branding = await getPublicBranding();
  const clinicName = branding.clinicName || tenant.clinicName || "Cabinet Médical";
  const rootDomain = process.env.ROOT_DOMAIN ?? "oltigo.com";
  const canonicalUrl = `https://${tenant.subdomain}.${rootDomain}`;

  const title = `${clinicName} | Prenez rendez-vous en ligne`;
  const description = branding.tagline
    ? `${clinicName} — ${branding.tagline}. Prenez rendez-vous en ligne.`
    : `${clinicName} — Prenez rendez-vous en ligne, consultez nos services et découvrez notre équipe médicale.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_MA",
      siteName: clinicName,
      url: canonicalUrl,
    },
  };
}

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

export default async function HomePage() {
  const tenant = await getTenant();

  // Root domain (no subdomain) → show SaaS landing page
  if (!tenant) {
    return <LandingPage />;
  }

  // Subdomain → show clinic homepage with tenant data
  const [branding, reviews, avgRating] = await Promise.all([
    getPublicBranding(),
    getPublicReviews(),
    getPublicAverageRating(),
  ]);
  const sections = mergeSectionVisibility(
    branding.sectionVisibility as Record<string, boolean>,
  );
  const template = getTemplate(branding.templateId);

  const topReviews = reviews.filter((r) => r.rating >= 4).slice(0, 3);

  return (
    <div className={template.wrapperClass} dir={template.rtl ? "rtl" : "ltr"}>
      {/* Hero — always visible */}
      {sections.hero && <HeroSection />}

      {/* Services */}
      {sections.services && <ServicesPreview />}

      {/* Doctors / Team */}
      {sections.doctors && <DoctorsSection />}

      {/* Reviews */}
      {sections.reviews && topReviews.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Ce que disent nos patients
              </h2>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold">{avgRating}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(avgRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({reviews.length} avis)
                </span>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
              {topReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-muted text-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                    <p className="text-sm font-medium">{review.patientName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link href="/reviews" className={linkBtnOutline}>
                Voir tous les avis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Blog */}
      {sections.blog && <BlogSection />}

      {/* Before / After */}
      {sections.beforeAfter && <BeforeAfterSection />}

      {/* Location */}
      {sections.location && <LocationSection />}

      {/* Booking CTA */}
      {sections.booking && <BookingSection />}

      {/* Contact Form */}
      {sections.contactForm && <ContactFormSection />}

      {/* Insurance */}
      {sections.insurance && <InsuranceSection />}

      {/* FAQ */}
      {sections.faq && <FaqSection />}
    </div>
  );
}
