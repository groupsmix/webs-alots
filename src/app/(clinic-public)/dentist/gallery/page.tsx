import { Camera, Calendar, Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicBranding } from "@/lib/data/public";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Before & After Gallery",
  description:
    "Browse our dental before and after gallery. See real patient transformations from our dental treatments.",
};

interface GalleryCase {
  id: string;
  description: string;
  category: string;
  beforeDate: string;
  afterDate: string | null;
}

async function getApprovedBeforeAfterCases(): Promise<GalleryCase[]> {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("before_after_photos")
    .select("id, description, category, before_date, after_date")
    .eq("clinic_id", tenant.clinicId)
    .not("after_date", "is", null)
    .order("before_date", { ascending: false });

  if (error || !data) return [];

  return data.map((d: Record<string, unknown>) => ({
    id: (d.id as string) ?? "",
    description: (d.description as string) ?? "",
    category: (d.category as string) ?? "General",
    beforeDate: (d.before_date as string) ?? "",
    afterDate: (d.after_date as string) ?? null,
  }));
}

const categoryColors: Record<string, string> = {
  General: "bg-sky-100 text-sky-700",
  Whitening: "bg-amber-100 text-amber-700",
  Implants: "bg-purple-100 text-purple-700",
  Orthodontics: "bg-pink-100 text-pink-700",
  Veneers: "bg-emerald-100 text-emerald-700",
  Crowns: "bg-orange-100 text-orange-700",
};

export default async function GalleryPage() {
  const [cases, branding] = await Promise.all([
    getApprovedBeforeAfterCases(),
    getPublicBranding(),
  ]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Before & After Gallery</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Real results from our dental treatments at {branding.clinicName}.
          All cases shown with patient consent.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Shield className="h-4 w-4 text-sky-600" />
          <span className="text-sm text-muted-foreground">
            Only approved cases with completed treatments are displayed
          </span>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Gallery Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We are preparing our before and after gallery. Check back soon to see
            real patient transformations.
          </p>
          <Link href="/book" className={buttonVariants()}>
            <Calendar className="h-4 w-4 mr-2" />
            Book a Consultation
          </Link>
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {Array.from(new Set(cases.map((c) => c.category))).map((cat) => (
              <Badge
                key={cat}
                className={categoryColors[cat] ?? "bg-gray-100 text-gray-700"}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {/* Cases Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {cases.map((caseItem) => (
              <Card key={caseItem.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  {/* Before/After side by side placeholder */}
                  <div className="grid grid-cols-2">
                    <div className="aspect-square bg-muted flex items-center justify-center border-r">
                      <div className="text-center">
                        <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground font-medium">Before</p>
                      </div>
                    </div>
                    <div className="aspect-square bg-sky-50 dark:bg-sky-950/10 flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="h-8 w-8 text-sky-600 mx-auto mb-1" />
                        <p className="text-xs text-sky-600 font-medium">After</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant="secondary"
                        className={categoryColors[caseItem.category] ?? ""}
                      >
                        {caseItem.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{caseItem.beforeDate}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {caseItem.description || "Dental treatment transformation"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* CTA */}
      <div className="text-center mt-12">
        <p className="text-muted-foreground mb-4">
          Ready to transform your smile?
        </p>
        <Link href="/book" className={buttonVariants({ size: "lg" })}>
          <Calendar className="h-4 w-4 mr-2" />
          Book Your Consultation
        </Link>
      </div>
    </div>
  );
}
