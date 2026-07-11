#!/usr/bin/env node

/**
 * Patches node_modules package.json files so that Storybook's auto-ref
 * discovery can resolve their package.json. Storybook's `getAutoRefs` does
 * `require.resolve('<pkg>/package.json')` for every dependency; packages that
 * use `exports` but do not explicitly expose `./package.json` cause:
 *
 *   "unable to find package.json for <pkg>"
 *
 * This is a non-functional warning but it fails CI in strict mode.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packages = ["@opennextjs/cloudflare"];

for (const pkg of packages) {
  const pkgJsonPath = path.join(__dirname, "..", "node_modules", pkg, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    console.log(`· ${pkg} not installed, skipping`);
    continue;
  }

  const raw = fs.readFileSync(pkgJsonPath, "utf-8");
  const json = JSON.parse(raw);

  if (!json.exports) {
    console.log(`· ${pkg} has no exports field, skipping`);
    continue;
  }

  if (json.exports["./package.json"] || json.exports["package.json"]) {
    console.log(`· ${pkg}/package.json already exposed, skipping`);
    continue;
  }

  json.exports = {
    "./package.json": "./package.json",
    ...json.exports,
  };

  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");
  console.log(`✓ Exposed package.json in ${pkg}`);
}
