Critical & High (Blockers & Bugs)

1.  Missing Essential Storybook Addons (Blocker)
    File: .storybook/main.ts (Lines 5-11) & package.json
    What's wrong: The addons array in main.ts is missing @storybook/addon-essentials (or the individual addons like @storybook/addon-controls, @storybook/addon-toolbars, and @storybook/addon-viewport).
    Why it's a problem: In .storybook/preview.tsx, you have heavily configured parameters.controls, parameters.viewport, and custom globalTypes for Theme and Locale toolbars. Without the essential addons installed and registered, none of these controls or dropdowns will actually render in the Storybook UI. This completely breaks the intended developer experience.
    Suggested fix:
    Install it: npm install -D @storybook/addon-essentials
    Add "@storybook/addon-essentials" to the addons array in .storybook/main.ts.
2.  DOM Mutation During Render Phase (Performance / Code Quality)
    File: .storybook/preview.tsx (Lines 74-78)
    What's wrong: The global decorator function directly executes applyGlobals(theme, locale), which mutates the document.documentElement (DOM manipulation) synchronously during the render cycle of the component.
    Why it's a problem: In React, performing direct DOM mutations during the render phase is a well-known anti-pattern. It can cause layout thrashing, performance degradation, and hydration mismatches. While Storybook decorators are slightly more forgiving, side-effects must still be relegated to a useEffect hook.
    Suggested fix: Wrap the applyGlobals execution in a useEffect hook:
    tsx
    import { useEffect } from "react";
    // ...
    decorators: [
    (Story, context) => {
    const { theme, locale } = context.globals as { theme?: string; locale?: string };
    useEffect(() => {
    applyGlobals(theme ?? "light", locale ?? "fr");
    }, [theme, locale]);

        return <Story />;

    },
    ],
    🟡 Medium

3.  Unsanitized DOM Injection (Security/Validation)
    File: .storybook/preview.tsx (Lines 15-16)
    What's wrong: locale and dir are passed directly into root.setAttribute("lang", locale) and root.setAttribute("dir", dir).
    Why it's a problem: The locale value is read from context.globals (which can be manipulated via URL parameters, e.g., &globals=locale:some_invalid_string). While standard XSS via .setAttribute is mitigated by the browser escaping HTML, injecting unvalidated strings into the HTML DOM could cause layout breakages or CSS selector mismatches.
    Suggested fix: Add a quick whitelist check inside applyGlobals to ensure locale is one of the supported ones ('fr', 'en', 'ar').
    🟢 Low (Code Quality & Style)
4.  Implicit React Dependency for JSX
    File: .storybook/preview.tsx (Line 77)
    What's wrong: Returning <Story /> utilizes JSX syntax, but import React from "react" is absent.
    Why it's a problem: Since this project utilizes React 19 (which supports the automatic JSX runtime), this is likely compiling fine. However, some Storybook builders (especially older Vite configurations) occasionally stumble if React isn't imported explicitly when writing raw JSX in a .tsx file that isn't transformed properly.
    Suggested fix: If you encounter build errors on npm run build-storybook, add import React from "react"; at the top of preview.tsx.
    Summary: The Storybook setup is structurally sound and integrates perfectly with your vitest setup. However, the missing addon-essentials will prevent you from interacting with your components in the browser, and the render-phase DOM mutation should be cleaned up before developers start building complex UI stories.

Let me know if you would like me to proceed with implementing these fixes!

Run TypeScript compiler finished
WARNING

While you were reviewing the report, the background TypeScript check (npx tsc --noEmit -p tsconfig.json) I ran to verify types across the codebase just finished and failed with a fatal error: JavaScript heap out of memory.

This is a new Blocker that will prevent npm run typecheck, npm run build, and CI pipelines from succeeding.

5. TypeScript Compiler Out of Memory (Blocker)
   What's wrong: The TypeScript compiler (tsc) is running out of allocated memory before it can finish type-checking the project. This is very common in large Next.js/React codebases or when node_modules aren't properly excluded.
   Why it's a problem: Any command that relies on type-checking (like next build or your custom typecheck script) will crash and fail the build.
   Suggested fix:
   Increase the Node memory limit for the typecheck script in package.json:
   json
   "typecheck": "NODE_OPTIONS=--max_old_space_size=8192 tsc --noEmit"
   Verify that your tsconfig.json correctly excludes node_modules, .next, and build output directories.
   Ensure "skipLibCheck": true is set in your tsconfig.json compiler options to avoid type-checking every single library in node_modules.
   Let me know if you would like me
