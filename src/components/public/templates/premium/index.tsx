import { BaseTemplate, buildDefaultRenderers, type PublicPageProps } from "../shared";
import { PremiumBooking } from "./booking";
import { PremiumDoctors } from "./doctors";
import { PremiumHero } from "./hero";
import { PremiumServices } from "./services";

export default function PremiumTemplate(props: PublicPageProps) {
  const { branding, locale, template } = props;
  const renderers = buildDefaultRenderers(props);

  renderers.hero = <PremiumHero branding={branding} />;
  renderers.services = <PremiumServices cardStyle={template.cardStyle} />;
  renderers.doctors = <PremiumDoctors clinicName={branding.clinicName} />;
  renderers.booking = <PremiumBooking locale={locale} />;

  return <BaseTemplate {...props} renderers={renderers} />;
}
