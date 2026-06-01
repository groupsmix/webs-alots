import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

describe("AI Disclaimer Enforcement", () => {
  it("should enforce that all AI routes return the medical advice disclaimer", () => {
    // Find all files in the ai directory
    const aiApiDir = path.resolve(__dirname, "../ai");
    const v1AiApiDir = path.resolve(__dirname, "../v1/ai");
    const chatApiDir = path.resolve(__dirname, "../chat");

    const getRouteFiles = (dir: string): string[] => {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getRouteFiles(filePath));
        } else if (file === "route.ts") {
          results.push(filePath);
        }
      }
      return results;
    };

    const routes = [
      ...getRouteFiles(aiApiDir),
      ...getRouteFiles(v1AiApiDir),
      ...getRouteFiles(chatApiDir),
    ];

    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const content = fs.readFileSync(route, "utf-8");

      // Some AI routes might not return AI generated content to users,
      // but if they do, they should import getAIDisclaimer or use AI_RESPONSE_DISCLAIMER
      const hasDisclaimerImport =
        content.includes("getAIDisclaimer") || content.includes("AI_RESPONSE_DISCLAIMER");

      // Detect AI provider call sites by grepping source text.
      // Anchored to word boundaries / path prefixes so CodeQL doesn't read this
      // as URL-substring sanitization (codeql[js/incomplete-url-substring-sanitization]).
      const AI_CALL_PATTERNS = [/\/chat\/completions\b/, /\bapi\.cloudflare\.com\//, /\bopenai\b/i];
      const makesAICall = AI_CALL_PATTERNS.some((p) => p.test(content));

      if (makesAICall) {
        expect(
          hasDisclaimerImport,
          `Route ${route} makes an AI call but is missing getAIDisclaimer`,
        ).toBe(true);
      }
    }
  });
});
