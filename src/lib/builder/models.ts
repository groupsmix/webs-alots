export interface BuilderModel {
  id: string;
  name: string;
  provider: "anthropic";
  description: string;
}

export const BUILDER_MODELS: BuilderModel[] = [
  {
    // Task A2: claude-sonnet-4-20250514 retires 2026-06-15.
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Best balance of speed and quality",
  },
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    description: "Most capable, slower",
  },
];

export const DEFAULT_MODEL = BUILDER_MODELS[0];
