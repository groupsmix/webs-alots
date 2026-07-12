// Generate i18n-literal-baseline.json
// Extracts all JSX text nodes from src/**/*.tsx and writes an array of
// regex-escaped patterns for eslint-plugin-i18next's words.exclude option.
// This creates a ratchet: existing hardcoded strings are grandfathered, but
// any new JSX literal string will fail lint until it is translated.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceFile, forEachChild, isJsxText, ScriptKind, ScriptTarget } from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadHtmlEntities() {
  const source = readFileSync(
    join(
      __dirname,
      "..",
      "node_modules",
      "eslint-plugin-i18next",
      "lib",
      "options",
      "htmlEntities.js",
    ),
    "utf-8",
  );
  const start = source.indexOf("{");
  const end = source.indexOf("module.exports");
  const objectLiteral = source.slice(start, end).trim().replace(/;\s*$/, "");
  return new Function(`return ${objectLiteral};`)();
}

const htmlEntities = loadHtmlEntities();

function decodeHtmlEntities(raw) {
  return raw.replace(/&(#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);/g, (match, nameOrNum) => {
    if (!nameOrNum.startsWith("#")) {
      return htmlEntities[nameOrNum] ?? match;
    }
    const num = nameOrNum.slice(1);
    try {
      const codePoint =
        num.startsWith("x") || num.startsWith("X") ? parseInt(num.slice(1), 16) : parseInt(num, 10);
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}

const SRC_DIR = "src";
const OUTPUT_FILE = "i18n-literal-baseline.json";

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      yield* walk(path);
    } else if (extname(path) === ".tsx") {
      yield path;
    }
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const literals = new Set();

for (const file of walk(SRC_DIR)) {
  const content = readFileSync(file, "utf-8");
  const sourceFile = createSourceFile(file, content, ScriptTarget.Latest, true, ScriptKind.TSX);

  function visit(node) {
    if (isJsxText(node)) {
      const text = decodeHtmlEntities(node.text).trim();
      if (text.length > 0) {
        literals.add(text);
      }
    }
    forEachChild(node, visit);
  }

  forEachChild(sourceFile, visit);
}

const baseline = [...literals]
  .map((literal) => `^${escapeRegExp(literal)}$`)
  .sort((a, b) => a.localeCompare(b));

writeFileSync(OUTPUT_FILE, JSON.stringify(baseline, null, 2) + "\n");
console.log(`Wrote ${baseline.length} literal patterns to ${OUTPUT_FILE}`);
