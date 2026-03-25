const steps = [
  {
    number: "01",
    title: "Créez votre compte",
    description: "Inscrivez-vous en quelques secondes et configurez votre cabinet.",
  },
  {
    number: "02",
    title: "Ajoutez vos services",
    description: "Définissez vos consultations, tarifs et horaires de travail.",
  },
  {
    number: "03",
    title: "Partagez votre lien",
    description: "Envoyez votre lien unique à vos patients pour qu'ils prennent rendez-vous.",
  },
  {
    number: "04",
    title: "Recevez des rendez-vous",
    description: "Les patients réservent en ligne et vous gérez tout depuis votre tableau de bord.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="comment-ca-marche" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Comment ça marche
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Lancez votre présence en ligne en 4 étapes simples.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, description }) => (
            <div key={number} className="relative">
              <div className="mb-4 text-4xl font-bold text-gray-200">
                {number}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
