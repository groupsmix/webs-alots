import {
  BaseHero,
  BaseTemplate,
  buildDefaultRenderers,
  getHeroOverrides,
  type PublicPageProps,
} from "../shared";

export default function MinimalTemplate(props: PublicPageProps) {
  const renderers = buildDefaultRenderers(props);
  const { branding } = props;
  renderers.hero = (
    <BaseHero branding={branding} overrides={getHeroOverrides(branding)} variant="minimal" />
  );
  return <BaseTemplate {...props} renderers={renderers} />;
}
