import { BaseServices, BaseTemplate, buildDefaultRenderers, type PublicPageProps } from "../shared";

export default function BoldTemplate(props: PublicPageProps) {
  const renderers = buildDefaultRenderers(props);
  renderers.services = (
    <BaseServices
      cardStyle={props.template.cardStyle}
      maxItems={6}
      gridClass="max-w-6xl mx-auto"
      itemClass="group rounded-2xl bg-card p-6 sm:p-8 text-start transition-all duration-300 hover:bg-muted/50"
    />
  );
  return <BaseTemplate {...props} renderers={renderers} />;
}
