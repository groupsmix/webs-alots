import { DynamicFooter } from "@/components/public/dynamic-footer";
import { PublicFooter } from "@/components/public/footer";
import { templatePackages, type TemplateFooterProps } from "@/lib/template-registry";

/**
 * Template-aware footer renderer.
 *
 * Priority:
 * 1. Template package's own Footer component.
 * 2. Legacy "classic-3col" variant → PublicFooter.
 * 3. Variant-driven DynamicFooter.
 */
export function TemplateFooter(props: TemplateFooterProps) {
  const pkg = templatePackages[props.template.id];

  if (pkg?.Footer) {
    return <pkg.Footer {...props} />;
  }

  if (props.template.footerVariant === "classic-3col") {
    return (
      <PublicFooter
        clinicName={props.clinicName}
        phone={props.phone ?? undefined}
        email={props.email ?? undefined}
        address={props.address ?? undefined}
        locale={props.locale}
      />
    );
  }

  return (
    <DynamicFooter
      clinicName={props.clinicName}
      footerVariant={props.template.footerVariant}
      template={props.template}
      phone={props.phone}
      email={props.email}
      address={props.address}
    />
  );
}
