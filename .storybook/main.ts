import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  viteFinal: (config) => {
    if (config.build) {
      config.build.chunkSizeWarningLimit = 1536;
    } else {
      config.build = { chunkSizeWarningLimit: 1536 };
    }
    return config;
  },
};
export default config;
