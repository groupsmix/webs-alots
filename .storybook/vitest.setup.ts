import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/nextjs-vite";
import { beforeAll } from "vitest";
import * as projectAnnotations from "./preview";

// Applies Storybook project annotations (parameters, decorators, globalTypes)
// to the stories when they run as Vitest component tests. Including the a11y
// addon annotations is what makes `parameters.a11y.test` actually enforced
// during the Vitest run (otherwise a11y checks are UI-only / advisory).
const project = setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

beforeAll(project.beforeAll);
