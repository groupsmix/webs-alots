import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18nextPlugin from "eslint-plugin-i18next";
import reactHooksPlugin from "eslint-plugin-react-hooks";

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
  ]),
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
      "i18next": i18nextPlugin,
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // Accessibility rules (Audit L9-12)
      // jsx-a11y plugin is already registered by eslint-config-next
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-role": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      // Import ordering (Audit 5.2)
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "pathGroups": [{ "pattern": "@/**", "group": "internal", "position": "after" }],
        "newlines-between": "never",
        "alphabetize": { "order": "asc", "caseInsensitive": true },
      }],
      // i18n rules to catch hardcoded literal strings in UI
      "i18next/no-literal-string": ["warn", {
        "markupOnly": true,
        "ignoreAttribute": ["data-testid", "className", "type", "id", "name", "value", "htmlFor", "role", "href", "target", "rel", "src", "alt", "variant", "size", "key", "placeholder"],
      }],
    },
  },
  {
    // S-17: Prevent scripts/** paths from being imported into Worker bundle.
    // Files under scripts/ are meant for local/CI use only and may contain
    // service-role keys or Node-only APIs that must never reach the browser.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/scripts/*", "**/scripts/**"],
          message: "S-17: scripts/** must not be imported from src/** — they are not part of the Worker bundle.",
        }],
      }],
    },
  },
  {
    // A87-F10: Prevent .skip from slipping into main on test files.
    // describe.skip / it.skip / test.skip silently disable coverage and let
    // regressions through (the skipped RLS suite is the canonical example).
    // Use describe.skipIf() with a documented env guard when genuinely needed.
    files: ["src/**/*.test.{ts,tsx}", "e2e/**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='describe']",
          message: "A87-F10: describe.skip is forbidden in CI. Use describe.skipIf(condition) with a documented env guard, or remove the skip.",
        },
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='it']",
          message: "A87-F10: it.skip is forbidden in CI. Use it.skipIf(condition) with a documented env guard, or remove the skip.",
        },
        {
          selector: "CallExpression[callee.property.name='skip'][callee.object.name='test']",
          message: "A87-F10: test.skip is forbidden in CI. Use test.skipIf(condition) with a documented env guard, or remove the skip.",
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
      "src/app/(auth)/forgot-password/**/*.{ts,tsx}"
    ],
    rules: {
      "i18next/no-literal-string": ["error", {
        "markupOnly": true,
        "ignoreAttribute": ["data-testid", "className", "type", "id", "name", "value", "htmlFor", "role", "href", "target", "rel", "src", "alt", "variant", "size", "key", "placeholder"],
      }],
    }
  }
]);

export default eslintConfig;
