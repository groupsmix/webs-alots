#!/usr/bin/env node
/**
 * Post-deploy smoke test — runs against the LIVE deployed site.
 *
 * Purpose: catch a broken deploy within ~30s instead of waiting for a user
 * to report it. This is the check that would have caught the signup outage:
 * the homepage and login rendered fine, but the /register client bundle had
 * no Supabase credentials inlined, so signup threw for every visitor.
 *
 * Three layers:
 *   1. Route liveness — key public routes + /api/health respond < 400.
 *   2. Signup integrity — the deployed /register page's client JS bundle
 *      actually contains a Supabase URL and an anon/publishable key. This is
 *      the build-time-inlining failure mode that server-side checks miss.
 *   3. PHI masking integrity (audit 2026-06-09 Task 2) — the bundle contains
 *      the MaskingBuildSentinel marker with the expected masking level.
 *      getMaskLevel() defaults to "none" when NEXT_PUBLIC_DATA_MASKING was
 *      absent at build time, and the env.ts startup check reads the runtime
 *      var — so a build without the variable fails silently everywhere
 *      except here. Override the expectation with SMOKE_EXPECTED_MASKING.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://oltigo.com node scripts/smoke-post-deploy.mjs
 *   (defaults to https://oltigo.com)
 *
 * Exit code 0 = all pass, 1 = at least one failure.
 */

const BASE = (process.env.SMOKE_BASE_URL || "https://oltigo.com").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

/** Routes that must respond with a status below `maxStatus`. */
const ROUTES = [
  { path: "/", maxStatus: 400 },
  { path: "/login", maxStatus: 400 },
  { path: "/register", maxStatus: 400 },
  { path: "/pricing", maxStatus: 400 },
  { path: "/api/health", maxStatus: 400 },
];

const SUPABASE_URL_RE = /https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)/i;
const SUPABASE_KEY_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_publishable_[\w-]{20,}/;

// Audit Task 2: marker emitted by src/components/masking-build-sentinel.tsx.
// Two recognised shapes:
//   1. Minifier-folded literal:        "__OLTIGO_MASKING_BUILD__partial"
//   2. Unfolded concat (variable):     "__OLTIGO_MASKING_BUILD__" + r   where
//      r is a same-module export bound to MASKING_BUILD_LEVEL.
//
// The previous "[\s\S]{0,300}?(partial|full|none|unset)" form was a foot-gun:
// when the build did NOT inline NEXT_PUBLIC_DATA_MASKING (the exact failure
// mode this check exists to detect), mask.ts's own `=== "none"` / `=== "full"`
// comparisons sit only a few dozen chars after the marker in the bundled
// chunk, and the non-greedy match would lock onto one of those — reporting
// e.g. "none" while the true MASKING_BUILD_LEVEL value at runtime was
// "unset". The fix below requires the level to be either immediately glued
// to the marker (folded case) or to appear in a sentinel-binding initializer
// of the form `<var> = ... NEXT_PUBLIC_DATA_MASKING || "<level>"` within a
// short window. Anything else returns null and the report stays honest.
const MASKING_SENTINEL_RE_FOLDED = /__OLTIGO_MASKING_BUILD__(partial|full|none|unset)/;
const MASKING_SENTINEL_RE_BINDING =
  /NEXT_PUBLIC_DATA_MASKING\s*\|\|\s*["'](partial|full|none|unset)["']/;
function extractMaskingLevel(text) {
  return (
    text.match(MASKING_SENTINEL_RE_FOLDED)?.[1] ??
    text.match(MASKING_SENTINEL_RE_BINDING)?.[1] ??
    null
  );
}
const EXPECTED_MASKING = process.env.SMOKE_EXPECTED_MASKING || "partial";

let failures = 0;
const log = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRoutes() {
  for (const { path, maxStatus } of ROUTES) {
    try {
      const { status } = await fetchText(BASE + path);
      log(status < maxStatus, `${path} → HTTP ${status} (expected < ${maxStatus})`);
    } catch (err) {
      log(false, `${path} → request failed: ${err?.message || err}`);
    }
  }
}

/**
 * Verify the deployed /register page ships a usable Supabase client. The
 * credentials are inlined into one of the referenced /_next/static chunks,
 * so we fetch the page, then scan its JS bundles for a URL + key.
 */
async function checkSignupIntegrity() {
  let html;
  try {
    ({ text: html } = await fetchText(BASE + "/register"));
  } catch (err) {
    log(false, `signup integrity: could not load /register (${err?.message || err})`);
    return;
  }

  const chunks = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  const unique = [...new Set(chunks)].slice(0, 60);
  if (unique.length === 0) {
    log(false, "signup integrity: no client JS chunks referenced by /register");
    return;
  }

  let urlFound = SUPABASE_URL_RE.test(html);
  let keyFound = SUPABASE_KEY_RE.test(html);
  // Deliberately NOT matched against the HTML: the SSR pass renders the
  // sentinel with the Worker's RUNTIME env value, which is exactly the
  // value that lies when the build-time variable is missing. Only the JS
  // chunks carry the build-time inlined level.
  let maskingLevel = null;

  for (const chunk of unique) {
    if (urlFound && keyFound && maskingLevel) break;
    try {
      const { text } = await fetchText(BASE + chunk);
      if (!urlFound && SUPABASE_URL_RE.test(text)) urlFound = true;
      if (!keyFound && SUPABASE_KEY_RE.test(text)) keyFound = true;
      if (!maskingLevel) maskingLevel = extractMaskingLevel(text);
    } catch {
      // ignore individual chunk fetch errors; absence is what we test for
    }
  }

  log(urlFound, "signup integrity: Supabase URL inlined in client bundle");
  log(
    keyFound,
    keyFound
      ? "signup integrity: Supabase anon/publishable key inlined in client bundle"
      : "signup integrity: Supabase anon key MISSING from client bundle — signup will fail " +
          "(set NEXT_PUBLIC_SUPABASE_ANON_KEY as a GitHub Actions build secret)",
  );

  // Audit Task 2: PHI masking must be baked into the client bundle.
  if (maskingLevel === null) {
    log(
      false,
      "masking integrity: MaskingBuildSentinel marker NOT found in client bundle — " +
        "cannot verify NEXT_PUBLIC_DATA_MASKING was inlined at build time",
    );
  } else {
    log(
      maskingLevel === EXPECTED_MASKING,
      maskingLevel === EXPECTED_MASKING
        ? `masking integrity: client bundle masking level is "${maskingLevel}"`
        : `masking integrity: client bundle masking level is "${maskingLevel}" but expected ` +
            `"${EXPECTED_MASKING}" — PHI will render ${
              maskingLevel === "none" || maskingLevel === "unset"
                ? "UNMASKED"
                : "incorrectly masked"
            } in client components (set NEXT_PUBLIC_DATA_MASKING in the deploy build env)`,
    );
  }
}

(async () => {
  console.log(`Post-deploy smoke test → ${BASE}\n`);
  await checkRoutes();
  await checkSignupIntegrity();
  console.log("");
  if (failures > 0) {
    console.error(`✗ smoke test FAILED with ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("✓ smoke test passed.");
})();
