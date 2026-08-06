import { BaseTemplate, buildDefaultRenderers, type PublicPageProps } from "../shared";

export default function ModernTemplate(props: PublicPageProps) {
  const renderers = buildDefaultRenderers(props);
  return <BaseTemplate {...props} renderers={renderers} />;
}
