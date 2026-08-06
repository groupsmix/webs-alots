import { BaseServices, BaseTemplate, buildDefaultRenderers, type PublicPageProps } from "../shared";

export default function ArabicTemplate(props: PublicPageProps) {
  const renderers = buildDefaultRenderers(props);
  renderers.services = (
    <BaseServices cardStyle={props.template.cardStyle} maxItems={6} gridClass="max-w-6xl mx-auto" />
  );
  return <BaseTemplate {...props} renderers={renderers} />;
}
