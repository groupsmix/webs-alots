import { DynamicHeader } from "@/components/public/dynamic-header";
import { PublicHeader } from "@/components/public/header";
import { templatePackages, type TemplateHeaderProps } from "@/lib/template-registry";

/**
 * Template-aware header renderer.
 *
 * Priority:
 * 1. Template package's own Header component.
 * 2. Legacy "top-sticky" variant → PublicHeader.
 * 3. Variant-driven DynamicHeader.
 */
export function TemplateHeader(props: TemplateHeaderProps) {
  const pkg = templatePackages[props.template.id];

  if (pkg?.Header) {
    return <pkg.Header {...props} />;
  }

  if (props.template.headerVariant === "top-sticky") {
    return (
      <PublicHeader
        logoUrl={props.logoUrl}
        clinicName={props.clinicName}
        sectionVisibility={props.sectionVisibility}
        phone={props.phone}
        email={props.email}
        address={props.address}
      />
    );
  }

  return (
    <DynamicHeader
      logoUrl={props.logoUrl}
      clinicName={props.clinicName}
      headerVariant={props.template.headerVariant}
      template={props.template}
      phone={props.phone}
      email={props.email}
      address={props.address}
    />
  );
}
