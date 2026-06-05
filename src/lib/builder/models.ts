export interface BuilderModel {
  id: string;
  name: string;
  provider: "anthropic";
  description: string;
}

export const BUILDER_MODELS: BuilderModel[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Best balance of speed and quality",
  },
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Most capable, slower",
  },
];

export const DEFAULT_MODEL = BUILDER_MODELS[0];
