import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-billing";

export const metadata: Metadata = {
  title: "Tarifs — Plans et Abonnements",
  description:
    "Découvrez nos plans tarifaires adaptés à chaque cabinet médical. Du plan gratuit au plan Enterprise, trouvez l'offre qui vous convient.",
  openGraph: {
    title: "Tarifs — Plans et Abonnements | Oltigo",
    description:
      "Plans tarifaires pour professionnels de santé. Commencez gratuitement.",
  },
};

function formatLimit(value: number): string {
  return value === -1 ? "Illimité" : String(value);
}

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 text-center sm:px-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
          Tarifs
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Un plan pour chaque cabinet
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Commencez gratuitement et &eacute;voluez selon vos besoins.
          Tous les plans incluent un site web professionnel et la gestion des rendez-vous.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPopular = plan.id === "professional";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  isPopular
                    ? "border-blue-600 shadow-lg shadow-blue-600/10 ring-1 ring-blue-600"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    Populaire
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      {plan.priceMonthly === 0
                        ? "Gratuit"
                        : `${plan.priceMonthly}`}
                    </span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm text-gray-500">
                        {plan.currency}/mois
                      </span>
                    )}
                  </div>
                  {plan.priceYearly > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      {plan.priceYearly} {plan.currency}/an (
                      {Math.round(
                        ((plan.priceMonthly * 12 - plan.priceYearly) /
                          (plan.priceMonthly * 12)) *
                          100,
                      )}
                      % d&apos;&eacute;conomie)
                    </p>
                  )}
                </div>

                {/* Limits summary */}
                <div className="mb-6 space-y-2 border-b border-gray-100 pb-6 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">
                      {formatLimit(plan.maxDoctors)}
                    </span>{" "}
                    {plan.maxDoctors === 1 ? "m\u00e9decin" : "m\u00e9decins"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">
                      {formatLimit(plan.maxPatients)}
                    </span>{" "}
                    patients
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">
                      {formatLimit(plan.maxAppointmentsPerMonth)}
                    </span>{" "}
                    RDV/mois
                  </p>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.priceMonthly === 0 ? "/register" : "/contact"}
                  className={`group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                    isPopular
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                      : plan.priceMonthly === 0
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {plan.priceMonthly === 0
                    ? "Commencer gratuitement"
                    : plan.id === "enterprise"
                      ? "Nous contacter"
                      : "Choisir ce plan"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ section */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Questions fr&eacute;quentes
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Puis-je changer de plan \u00e0 tout moment ?",
                a: "Oui, vous pouvez passer \u00e0 un plan sup\u00e9rieur ou inf\u00e9rieur \u00e0 tout moment. La diff\u00e9rence sera calcul\u00e9e au prorata.",
              },
              {
                q: "Le plan gratuit est-il vraiment gratuit ?",
                a: "Absolument. Le plan Free est gratuit pour toujours, sans carte de cr\u00e9dit requise. Il inclut jusqu'\u00e0 2 m\u00e9decins et 50 patients.",
              },
              {
                q: "Comment fonctionne la facturation ?",
                a: "La facturation est mensuelle ou annuelle, au choix. Les plans annuels b\u00e9n\u00e9ficient d'une r\u00e9duction d'environ 17%.",
              },
              {
                q: "Quels moyens de paiement acceptez-vous ?",
                a: "Nous acceptons les cartes bancaires (CMI) et les virements bancaires pour les plans annuels.",
              },
            ].map(({ q, a }) => (
              <div
                key={q}
                className="rounded-xl border border-gray-100 p-6"
              >
                <h3 className="font-semibold text-gray-900">{q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
