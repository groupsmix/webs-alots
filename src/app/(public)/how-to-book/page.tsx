import type { Metadata } from "next";
import Link from "next/link";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Comment Réserver",
  description:
    "Guide étape par étape pour prendre rendez-vous en ligne dans notre cabinet médical. Simple, rapide et sécurisé.",
  openGraph: {
    title: "Comment Réserver",
    description: "Guide étape par étape pour prendre rendez-vous en ligne.",
  },
};

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80 transition-colors";

export default function HowToBookPage() {
  const cfg = defaultWebsiteConfig.howToBook;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {cfg.subtitle}
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6 mb-12">
        {cfg.steps.map((step, index) => (
          <Card key={index}>
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Link href="/book" className={linkBtnPrimary}>
          Book Your Appointment Now
        </Link>
      </div>
    </div>
  );
}
