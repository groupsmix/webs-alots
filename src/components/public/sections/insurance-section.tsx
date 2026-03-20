import { Shield } from "lucide-react";

const insuranceProviders = [
  "CNSS",
  "CNOPS",
  "RMA",
  "SAHAM",
  "AXA",
  "Wafa Assurance",
  "Atlanta",
  "MAMDA",
];

export function InsuranceSection() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">
          Insurance Accepted
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          We accept most major insurance providers. Contact us if you don&apos;t
          see your provider listed.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-2xl mx-auto">
          {insuranceProviders.map((provider) => (
            <div
              key={provider}
              className="flex items-center gap-2 rounded-lg border bg-card p-3"
            >
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">{provider}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
