import { BaseTemplate, buildDefaultRenderers, type PublicPageProps } from "../shared";

export default function ElegantTemplate(props: PublicPageProps) {
  const renderers = buildDefaultRenderers(props);
  return <BaseTemplate {...props} renderers={renderers} />;
}
