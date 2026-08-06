import { BaseServices, type BaseServicesProps } from "../shared";

export interface PremiumServicesProps {
  cardStyle?: BaseServicesProps["cardStyle"];
}

export function PremiumServices({ cardStyle = "elevated" }: PremiumServicesProps) {
  return (
    <BaseServices
      cardStyle={cardStyle}
      maxItems={6}
      gridClass="max-w-6xl mx-auto"
      itemClass="group rounded-2xl bg-card p-6 sm:p-8 text-start transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    />
  );
}
