import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const faqs = [
  {
    q: "Comment prendre rendez-vous ?",
    a: "Vous pouvez prendre rendez-vous en ligne via notre site web en cliquant sur le bouton \u00ab Prendre rendez-vous \u00bb, ou nous appeler directement pendant les heures d'ouverture.",
  },
  {
    q: "Quelles assurances acceptez-vous ?",
    a: "Nous acceptons la plupart des assurances majeures, notamment CNSS, CNOPS, RMA, SAHAM et AXA. Contactez-nous pour les détails de couverture.",
  },
  {
    q: "Quels sont vos horaires d'ouverture ?",
    a: "Nous sommes ouverts du lundi au vendredi de 9h00 à 17h00, et le samedi de 9h00 à 13h00. Nous sommes fermés le dimanche.",
  },
  {
    q: "Ai-je besoin d'une recommandation ?",
    a: "Aucune recommandation n'est nécessaire pour une consultation générale. Certains services spécialisés peuvent nécessiter une orientation de votre médecin traitant.",
  },
  {
    q: "Puis-je annuler ou reporter mon rendez-vous ?",
    a: "Oui, vous pouvez annuler ou reporter votre rendez-vous jusqu'à 24 heures à l'avance via notre site web ou en nous appelant.",
  },
];

export function FaqSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-center text-3xl font-bold mb-4">
          Questions Fréquentes
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Trouvez les réponses aux questions les plus courantes sur nos services.
        </p>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.q}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{faq.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
