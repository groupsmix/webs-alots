import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Tarifs — Plans et Abonnements",
  description:
    "D\u00e9couvrez nos plans tarifaires adapt\u00e9s \u00e0 chaque cabinet m\u00e9dical. Commencez gratuitement et \u00e9voluez selon vos besoins.",
  openGraph: {
    title: "Tarifs — Plans et Abonnements | Oltigo",
    description:
      "D\u00e9couvrez nos plans tarifaires adapt\u00e9s \u00e0 chaque cabinet m\u00e9dical.",
  },
};

interface PlanDisplay {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const plans: PlanDisplay[] = [
  {
    id: "free",
    name: "Gratuit",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Id\u00e9al pour d\u00e9couvrir la plateforme et d\u00e9marrer votre pr\u00e9sence en ligne.",
    features: [
      "Jusqu\u2019\u00e0 2 m\u00e9decins",
      "50 patients",
      "100 rendez-vous / mois",
      "Tableau de bord basique",
      "Site web du cabinet inclus",
    ],
    cta: "Commencer gratuitement",
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 299,
    priceYearly: 2990,
    description: "Pour les cabinets en croissance qui veulent automatiser leur gestion.",
    features: [
      "Jusqu\u2019\u00e0 5 m\u00e9decins",
      "500 patients",
      "500 rendez-vous / mois",
      "SMS & WhatsApp (100 / mois)",
      "Export CSV",
      "Rappels automatiques",
    ],
    cta: "Choisir Starter",
  },
  {
    id: "professional",
    name: "Professionnel",
    priceMonthly: 599,
    priceYearly: 5990,
    description: "La solution compl\u00e8te pour les cabinets \u00e9tablis.",
    features: [
      "M\u00e9decins illimit\u00e9s",
      "Patients illimit\u00e9s",
      "Rendez-vous illimit\u00e9s",
      "SMS & WhatsApp (500 / mois)",
      "Domaine personnalis\u00e9",
      "Consultations vid\u00e9o",
      "Analytique compl\u00e8te",
    ],
    highlighted: true,
    cta: "Choisir Professionnel",
  },
  {
    id: "enterprise",
    name: "Entreprise",
    priceMonthly: 999,
    priceYearly: 9990,
    description: "Pour les cliniques et r\u00e9seaux multi-sites.",
    features: [
      "Tout dans Professionnel",
      "Acc\u00e8s API",
      "Support prioritaire",
      "SMS & WhatsApp illimit\u00e9s",
      "Marque blanche",
      "Multi-sites",
    ],
    cta: "Nous contacter",
  },
];

function formatPrice(price: number): string {
  if (price === 0) return "0";
  return price.toLocaleString("fr-MA");
}

export default async function PricingPage() {
  const tenant = await getTenant();

  // Root domain (no tenant) → show SaaS pricing with landing header/footer
  // Subdomain → pricing is not relevant (clinic sites don't show SaaS pricing)
  const content = (
    <div className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Tarifs
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Des plans adapt&eacute;s &agrave; chaque cabinet
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Commencez gratuitement, &eacute;voluez selon vos besoins.
            Tous les plans incluent un site web professionnel pour votre cabinet.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-6 lg:grid-cols-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-blue-600 bg-white shadow-xl shadow-blue-600/10 ring-1 ring-blue-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    Populaire
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(plan.priceMonthly)}
                  </span>
                  <span className="text-sm text-gray-500">MAD / mois</span>
                </div>
                {plan.priceYearly > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    ou {formatPrice(plan.priceYearly)} MAD / an
                    {" "}
                    <span className="font-medium text-green-600">
                      (&eacute;conomisez {formatPrice(plan.priceMonthly * 12 - plan.priceYearly)} MAD)
                    </span>
                  </p>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-gray-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.id === "enterprise" ? "/contact" : "/register"}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20 hover:bg-gray-800"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ / Additional info */}
        <div className="mt-20 mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
            Questions fr&eacute;quentes
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-gray-900">Puis-je changer de plan &agrave; tout moment ?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Oui, vous pouvez passer &agrave; un plan sup&eacute;rieur ou inf&eacute;rieur &agrave; tout moment.
                Le changement prend effet imm&eacute;diatement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Le plan gratuit est-il vraiment gratuit ?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Oui, aucune carte bancaire n&apos;est requise. Vous pouvez utiliser le plan gratuit
                aussi longtemps que vous le souhaitez avec jusqu&apos;&agrave; 2 m&eacute;decins et 50 patients.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Quels moyens de paiement acceptez-vous ?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Nous acceptons les virements bancaires, CMI, et les paiements par carte.
                Les factures sont envoy&eacute;es mensuellement ou annuellement selon votre choix.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mes donn&eacute;es sont-elles s&eacute;curis&eacute;es ?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Absolument. Toutes les donn&eacute;es sont chiffr&eacute;es et h&eacute;berg&eacute;es de mani&egrave;re s&eacute;curis&eacute;e.
                Nous respectons les normes CNDP pour la protection des donn&eacute;es m&eacute;dicales au Maroc.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // If on root domain, wrap with landing page header/footer
  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <LandingHeader />
        <main className="flex-1">{content}</main>
        <LandingFooter />
      </div>
    );
  }

  return content;
}
