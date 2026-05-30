// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18nextPlugin from "eslint-plugin-i18next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
      i18next: i18nextPlugin,
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Accessibility rules (Audit L9-12, A68-F1: upgraded warn→error)
      // jsx-a11y plugin is already registered by eslint-config-next.
      // These MUST be "error" so CI fails on new a11y violations.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/label-has-associated-control": "error",
      // Import ordering (Audit 5.2)
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal", position: "after" }],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // i18n rules to catch hardcoded literal strings in UI
      // AUDIT FINDING #22: Tightened config to reduce false positives from
      // Tailwind class names (gap-2, text-muted-foreground, etc.) by adding
      // ignoreCallee for utility functions and ignoreProperty for non-user-facing props.
      "i18next/no-literal-string": [
        "warn",
        {
          markupOnly: true,
          onlyAttribute: [],
          ignoreAttribute: [
            "data-testid",
            "className",
            "style",
            "type",
            "id",
            "name",
            "value",
            "htmlFor",
            "role",
            "href",
            "target",
            "rel",
            "src",
            "alt",
            "variant",
            "size",
            "key",
            "placeholder",
            "aria-label",
          ],
          ignoreCallee: [
            "clsx",
            "cn",
            "twMerge",
            "cva",
            "t",
            "z.object",
            "z.string",
            "z.enum",
            "logger",
            "console",
          ],
          ignoreProperty: ["displayName", "key", "as", "variant", "size", "data-testid"],
        },
      ],
    },
  },
  {
    // S-17: Prevent scripts/** paths from being imported into Worker bundle.
    // Files under scripts/ are meant for local/CI use only and may contain
    // service-role keys or Node-only APIs that must never reach the browser.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/scripts/*", "**/scripts/**"],
              message:
                "S-17: scripts/** must not be imported from src/** — they are not part of the Worker bundle.",
            },
          ],
        },
      ],
    },
  },
  {
    // A87-F10: Prevent .skip from slipping into main on test files.
    // describe.skip / it.skip / test.skip silently disable coverage and let
    // regressions through (the skipped RLS suite is the canonical example).
    // Use describe.skipIf() with a documented env guard when genuinely needed.
    files: ["src/**/*.test.{ts,tsx}", "e2e/**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='describe']",
          message:
            "A87-F10: describe.skip is forbidden in CI. Use describe.skipIf(condition) with a documented env guard, or remove the skip.",
        },
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='it']",
          message:
            "A87-F10: it.skip is forbidden in CI. Use it.skipIf(condition) with a documented env guard, or remove the skip.",
        },
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='test']",
          message:
            "A87-F10: test.skip is forbidden in CI. Use test.skipIf(condition) with a documented env guard, or remove the skip.",
        },
        {
          selector:
            "CallExpression[callee.property.name='skipIf'][callee.object.name='describe'] > Literal[value=true]:first-child",
          message:
            "FR-35: describe.skipIf(true) permanently disables tests. Use an env-guard variable instead.",
        },
        {
          selector:
            "CallExpression[callee.property.name='skipIf'][callee.object.name='it'] > Literal[value=true]:first-child",
          message:
            "FR-35: it.skipIf(true) permanently disables tests. Use an env-guard variable instead.",
        },
        {
          selector:
            "CallExpression[callee.property.name='skipIf'][callee.object.name='test'] > Literal[value=true]:first-child",
          message:
            "FR-35: test.skipIf(true) permanently disables tests. Use an env-guard variable instead.",
        },
      ],
    },
  },
  {
    // Enforce no-literal-string strictly on the fully translated auth/2fa folders
    files: [
      "src/app/(auth)/setup-2fa/**/*.{ts,tsx}",
      "src/components/doctor/mfa-settings.tsx",
      "src/app/(auth)/login/**/*.{ts,tsx}",
      "src/app/(auth)/register/**/*.{ts,tsx}",
      "src/app/(auth)/forgot-password/**/*.{ts,tsx}",
    ],
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          markupOnly: true,
          ignoreAttribute: [
            "data-testid",
            "className",
            "type",
            "id",
            "name",
            "value",
            "htmlFor",
            "role",
            "href",
            "target",
            "rel",
            "src",
            "alt",
            "variant",
            "size",
            "key",
            "placeholder",
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.stories.{ts,tsx}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  {
    // ENV-CENTRALIZATION: Enforce that environment variables are read through
    // src/lib/env.ts rather than accessed directly via process.env.
    // Exceptions:
    //   1. src/lib/env.ts itself — that's where validation lives.
    //   2. next.config.ts / instrumentation.ts — build-time / edge bootstrap.
    //   3. Test files — can read env vars directly for test config.
    //   4. Scripts — standalone Node scripts run outside Next.js.
    //   5. wrangler.toml-adjacent Worker entry points.
    //
    // When you genuinely need direct access (Workers AI creds, build-time
    // constants) add a // eslint-disable-next-line no-restricted-syntax
    // comment with a justification on the same line.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/env.ts",
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**",
      "src/instrumentation.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // Catch: process.env.FOO and process.env["FOO"]
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "ENV-001: Read environment variables through src/lib/env.ts instead of process.env directly. " +
            "If this is a build-time or Workers-only access, add // eslint-disable-next-line no-restricted-syntax with justification.",
        },
      ],
    },
  },
  ...storybook.configs["flat/recommended"],
]);

export default eslintConfig;
