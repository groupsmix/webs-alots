import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical, Search, FileText, MapPin, Phone,
  ArrowRight, Clock, Shield, Microscope, Activity,
  Droplets, Scan,
} from "lucide-react";
import { getPublicLabTests, getPublicCollectionPoints, getLabTestCategories } from "@/lib/data/lab-public";

export const metadata: Metadata = {
  title: "Laboratoire — Accueil",
  description:
    "Votre laboratoire d'analyses et de radiologie. Consultez nos examens, accédez à vos résultats en ligne et trouvez nos points de prélèvement.",
  openGraph: {
    title: "Laboratoire — Accueil",
    description: "Analyses médicales et radiologie. Résultats en ligne, préparation aux examens.",
  },
};

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors";
const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

const categoryIcons: Record<string, React.ReactNode> = {
  hematology: <Droplets className="h-6 w-6" />,
  biochemistry: <FlaskConical className="h-6 w-6" />,
  radiology: <Scan className="h-6 w-6" />,
  microbiology: <Microscope className="h-6 w-6" />,
};

export default async function LabHomePage() {
  const [allTests, collectionPoints] = await Promise.all([
    getPublicLabTests(),
    getPublicCollectionPoints(),
  ]);

  const categories = getLabTestCategories(allTests);
  const activeTests = allTests.filter((t) => t.active);
  const featuredTests = activeTests.slice(0, 6);

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/10 py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="bg-blue-600 text-white mb-4">
                <Shield className="h-3 w-3 mr-1" /> Certified Laboratory
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                Accurate <span className="text-blue-600">Diagnostics</span> You Can Trust
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Comprehensive lab tests, radiology exams, and fast results.
                Access your results online with your secure patient code.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/lab/my-results" className={linkBtnPrimary}>
                  <FileText className="mr-2 h-4 w-4" />
                  Access Results
                </Link>
                <Link href="/lab/tests" className={linkBtnOutline}>
                  <Search className="mr-2 h-4 w-4" />
                  Browse Tests
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="h-72 w-72 rounded-full bg-blue-200/50 dark:bg-blue-800/20 flex items-center justify-center">
                  <FlaskConical className="h-32 w-32 text-blue-600/30" />
                </div>
                <div className="absolute -top-4 -right-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold">{activeTests.length}+</p>
                      <p className="text-xs text-muted-foreground">Tests Available</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold">{collectionPoints.length}</p>
                      <p className="text-xs text-muted-foreground">Collection Points</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get your lab results quickly and conveniently
          </p>
          <div className="grid gap-8 md:grid-cols-4 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Get Referred", desc: "Bring your doctor's prescription or request to any collection point", icon: FileText },
              { step: "2", title: "Sample Collection", desc: "Visit a collection point or schedule home collection", icon: Droplets },
              { step: "3", title: "Analysis", desc: "Our certified lab processes your samples with precision", icon: Microscope },
              { step: "4", title: "Results Online", desc: "Access your results securely online with your patient code", icon: Search },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="text-xs text-blue-600 font-semibold mb-1">Step {s.step}</div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Test Categories */}
      {categories.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Test Categories</h2>
              <Link href="/lab/tests" className={linkBtnOutline}>
                View All Tests <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {categories.slice(0, 4).map((category) => {
                const count = activeTests.filter((t) => t.category === category).length;
                return (
                  <Card key={category} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-4">
                        {categoryIcons[category.toLowerCase()] || <FlaskConical className="h-6 w-6" />}
                      </div>
                      <h3 className="font-semibold mb-1 capitalize">{category}</h3>
                      <p className="text-sm text-muted-foreground">{count} test{count !== 1 ? "s" : ""} available</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured Tests */}
      {featuredTests.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Popular Tests</h2>
              <Link href="/lab/tests" className={linkBtnOutline}>
                All Tests <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTests.map((test) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {test.category}
                      </Badge>
                      {test.requiresFasting && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                          Fasting Required
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{test.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {test.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-blue-600">
                        {test.price} {test.currency}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {test.turnaroundTime}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Online Results CTA */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Access Your Results Online</h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Use your patient code to securely access your lab and radiology results online. No need to visit the lab.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/lab/my-results" className="inline-flex items-center justify-center rounded-lg bg-white text-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition-colors">
              <FileText className="mr-2 h-4 w-4" />
              View Results
            </Link>
            <Link href="/lab/collection-points" className="inline-flex items-center justify-center rounded-lg border border-white/50 text-white px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors">
              <MapPin className="mr-2 h-4 w-4" />
              Find Collection Points
            </Link>
          </div>
        </div>
      </section>

      {/* Collection Points Preview */}
      {collectionPoints.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Collection Points</h2>
              <Link href="/lab/collection-points" className={linkBtnOutline}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {collectionPoints.slice(0, 3).map((point) => (
                <Card key={point.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold">{point.name}</h3>
                      {point.isMainLab && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                          Main Lab
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {point.address}, {point.city}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        {point.phone}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        {point.hours.length > 0
                          ? `${point.hours[0].open} - ${point.hours[0].close}`
                          : "See schedule"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
