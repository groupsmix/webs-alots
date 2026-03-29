import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pill, Search, Upload, Truck, Heart, Syringe, Shield,
  Clock, MapPin, Phone, ArrowRight, Star, ShoppingBag,
} from "lucide-react";
import {
  getPublicPharmacyProducts,
  getPublicPharmacyServices,
  isPublicCurrentlyOnDuty,
  getPublicNextOnDuty,
} from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Pharmacie — Accueil",
  description:
    "Votre pharmacie de confiance. Catalogue de produits, services pharmaceutiques, envoi d'ordonnance en ligne et pharmacie de garde.",
  openGraph: {
    title: "Pharmacie — Accueil",
    description: "Votre pharmacie de confiance. Catalogue, services et ordonnances en ligne.",
  },
};

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors";
const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

const serviceIcons: Record<string, React.ReactNode> = {
  Heart: <Heart className="h-6 w-6" />,
  Syringe: <Syringe className="h-6 w-6" />,
  Shield: <Shield className="h-6 w-6" />,
};

export default async function PharmacyHomePage() {
  const [allProducts, allServices, onDuty, nextDuty] = await Promise.all([
    getPublicPharmacyProducts(),
    getPublicPharmacyServices(),
    isPublicCurrentlyOnDuty(),
    getPublicNextOnDuty(),
  ]);

  const featuredProducts = allProducts.filter((p) => p.active).slice(0, 4);
  const topServices = allServices.filter((s) => s.available).slice(0, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/10 py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {onDuty ? (
                  <Badge className="bg-emerald-600 text-white animate-pulse">
                    <Clock className="h-3 w-3 mr-1" /> On Duty Now
                  </Badge>
                ) : nextDuty ? (
                  <Badge variant="outline" className="border-emerald-600 text-emerald-600">
                    <Clock className="h-3 w-3 mr-1" /> Next on duty: {nextDuty.date}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                Your Trusted <span className="text-emerald-600">Pharmacy</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Quality healthcare products, professional services, and prescription management.
                Upload your prescription online and we&apos;ll have it ready for you.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/pharmacy/prescription-upload" className={linkBtnPrimary}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Prescription
                </Link>
                <Link href="/pharmacy/catalog" className={linkBtnOutline}>
                  <Search className="mr-2 h-4 w-4" />
                  Browse Products
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="h-72 w-72 rounded-full bg-emerald-200/50 dark:bg-emerald-800/20 flex items-center justify-center">
                  <Pill className="h-32 w-32 text-emerald-600/30" />
                </div>
                <div className="absolute -top-4 -right-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold">{allProducts.length}+</p>
                      <p className="text-xs text-muted-foreground">Products</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-semibold">4.8/5</p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Prescription Upload Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get your medications ready without waiting in line
          </p>
          <div className="grid gap-8 md:grid-cols-4 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Upload", desc: "Take a photo of your prescription and upload it", icon: Upload },
              { step: "2", title: "Review", desc: "Our pharmacist reviews and prepares your order", icon: Search },
              { step: "3", title: "Notify", desc: "Get a WhatsApp notification when it's ready", icon: Phone },
              { step: "4", title: "Collect", desc: "Pick up or get it delivered to your door", icon: Truck },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="text-xs text-emerald-600 font-semibold mb-1">Step {s.step}</div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Featured Products</h2>
            <Link href="/pharmacy/catalog" className={linkBtnOutline}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant={product.requiresPrescription ? "destructive" : "secondary"} className="text-xs">
                      {product.requiresPrescription ? "Prescription" : "OTC"}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {product.category}
                    </Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{product.name}</h3>
                  {product.genericName && (
                    <p className="text-xs text-muted-foreground mb-2">{product.genericName}</p>
                  )}
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-emerald-600">
                      {product.price} {product.currency}
                    </span>
                    <Badge
                      variant={product.stockQuantity > 0 ? "outline" : "destructive"}
                      className={product.stockQuantity > 0 ? "text-emerald-600 border-emerald-600" : ""}
                    >
                      {product.stockQuantity > 0 ? "In Stock" : "Out of Stock"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Our Services</h2>
            <Link href="/pharmacy/services" className={linkBtnOutline}>
              All Services <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {topServices.map((service) => (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mb-4">
                    {serviceIcons[service.icon] || <Pill className="h-6 w-6" />}
                  </div>
                  <h3 className="font-semibold mb-2">{service.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-emerald-600">
                      {service.price === 0 ? "Free" : `${service.price} ${service.currency}`}
                    </span>
                    {service.duration > 0 && (
                      <span className="text-muted-foreground">{service.duration} min</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* On-Duty / Garde Section */}
      <section className="py-16 bg-emerald-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">On-Duty Pharmacy (Garde)</h2>
          <p className="text-emerald-100 mb-6 max-w-xl mx-auto">
            Need medication after hours? Check our on-duty schedule to know when we&apos;re available for emergency pharmacy services.
          </p>
          {onDuty ? (
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-lg px-6 py-3 mb-6">
              <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
              <span className="font-semibold text-lg">We are currently on duty!</span>
            </div>
          ) : nextDuty ? (
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-lg px-6 py-3 mb-6">
              <Clock className="h-5 w-5" />
              <span>Next on-duty: <strong>{nextDuty.date}</strong> ({nextDuty.startTime} - {nextDuty.endTime})</span>
            </div>
          ) : (
            <p className="text-emerald-100 mb-6">No upcoming on-duty schedule available.</p>
          )}
          <div className="flex justify-center gap-3">
            <Link href="/pharmacy/contact" className="inline-flex items-center justify-center rounded-lg bg-white text-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-50 transition-colors">
              <Phone className="mr-2 h-4 w-4" />
              Call Us
            </Link>
            <Link href="/pharmacy/contact" className="inline-flex items-center justify-center rounded-lg border border-white/50 text-white px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors">
              <MapPin className="mr-2 h-4 w-4" />
              Find Us
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Upload Your Prescription?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Save time by uploading your prescription online. We&apos;ll prepare your medications and notify you via WhatsApp when they&apos;re ready.
          </p>
          <Link href="/pharmacy/prescription-upload" className={linkBtnPrimary}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Prescription Now
          </Link>
        </div>
      </section>
    </>
  );
}
