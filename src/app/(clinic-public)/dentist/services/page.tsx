import { Clock, CreditCard, Calendar, Smile } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicServices } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Services Dentaires",
  description:
    "Découvrez nos soins dentaires : implants, orthodontie, blanchiment, prothèses, chirurgie et soins esthétiques.",
};

const toothDiagramCategories: Record<string, { label: string; color: string; teeth: string }> = {
  general: { label: "General Dentistry", color: "bg-sky-100 text-sky-700", teeth: "All teeth" },
  cosmetic: { label: "Cosmetic Dentistry", color: "bg-purple-100 text-purple-700", teeth: "Front teeth (incisors, canines)" },
  orthodontics: { label: "Orthodontics", color: "bg-pink-100 text-pink-700", teeth: "Full arch alignment" },
  implants: { label: "Implantology", color: "bg-amber-100 text-amber-700", teeth: "Single or multiple tooth replacement" },
  surgery: { label: "Oral Surgery", color: "bg-red-100 text-red-700", teeth: "Wisdom teeth, extractions" },
  pediatric: { label: "Pediatric Dentistry", color: "bg-green-100 text-green-700", teeth: "Primary (baby) teeth" },
  endodontics: { label: "Endodontics", color: "bg-orange-100 text-orange-700", teeth: "Root canal treatment" },
  periodontics: { label: "Periodontics", color: "bg-teal-100 text-teal-700", teeth: "Gums and supporting structures" },
};

function getCategoryInfo(category: string | undefined) {
  if (!category) return toothDiagramCategories.general;
  const key = category.toLowerCase().replace(/\s+/g, "");
  return toothDiagramCategories[key] ?? toothDiagramCategories.general;
}

// Simple SVG tooth diagram component
function ToothDiagram({ category }: { category: string }) {
  const info = getCategoryInfo(category);
  return (
    <div className="relative w-full">
      <div className={`rounded-lg p-3 ${info.color} text-center`}>
        <div className="flex items-center justify-center gap-1 mb-1">
          {/* Upper arch - simplified tooth representation */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`upper-${i}`}
              className={`h-3 w-2.5 rounded-t-sm ${
                category === "cosmetic" && (i >= 2 && i <= 5)
                  ? "bg-current opacity-80"
                  : category === "surgery" && (i === 0 || i === 7)
                  ? "bg-current opacity-80"
                  : "bg-current opacity-30"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-1">
          {/* Lower arch */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`lower-${i}`}
              className={`h-3 w-2.5 rounded-b-sm ${
                category === "cosmetic" && (i >= 2 && i <= 5)
                  ? "bg-current opacity-80"
                  : category === "surgery" && (i === 0 || i === 7)
                  ? "bg-current opacity-80"
                  : "bg-current opacity-30"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] mt-1 font-medium">{info.teeth}</p>
      </div>
    </div>
  );
}

export default async function DentistServicesPage() {
  const services = await getPublicServices();
  const activeServices = services.filter((s) => s.active);

  // Group by category
  const grouped = new Map<string, typeof activeServices>();
  for (const service of activeServices) {
    const cat = service.category || "general";
    const list = grouped.get(cat) ?? [];
    list.push(service);
    grouped.set(cat, list);
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Dental Services</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comprehensive dental care using the latest techniques and technology.
          Each treatment is personalized to your needs.
        </p>
      </div>

      {activeServices.length === 0 ? (
        <p className="text-center text-muted-foreground">No services available yet.</p>
      ) : (
        <div className="space-y-12 max-w-5xl mx-auto">
          {Array.from(grouped.entries()).map(([category, categoryServices]) => {
            const catInfo = getCategoryInfo(category);
            return (
              <div key={category}>
                <div className="flex items-center gap-3 mb-6">
                  <Badge className={catInfo.color}>{catInfo.label}</Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {categoryServices.map((service) => (
                    <Card key={service.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                            <Smile className="h-5 w-5 text-sky-600" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            {service.description && (
                              <CardDescription className="mt-1">
                                {service.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ToothDiagram category={category} />
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                          {service.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {service.duration} min
                            </span>
                          )}
                          {service.price > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <CreditCard className="h-4 w-4" />
                              {service.price} {service.currency}
                            </span>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Link
                          href="/book"
                          className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Book This Treatment
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
