#!/usr/bin/env node
/**
 * Post-deploy smoke test — runs against the LIVE deployed site.
 *
 * Purpose: catch a broken deploy within ~30s instead of waiting for a user
 * to report it. This is the check that would have caught the signup outage:
 * the homepage and login rendered fine, but the /register client bundle had
 * no Supabase credentials inlined, so signup threw for every visitor.
 *
 * Two layers:
 *   1. Route liveness — key public routes + /api/health respond < 400.
 *   2. Signup integrity — the deployed /register page's client JS bundle
 *      actually contains a Supabase URL and an anon/publishable key. This is
 *      the build-time-inlining failure mode that server-side checks miss.
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

  for (const chunk of unique) {
    if (urlFound && keyFound) break;
    try {
      const { text } = await fetchText(BASE + chunk);
      if (!urlFound && SUPABASE_URL_RE.test(text)) urlFound = true;
      if (!keyFound && SUPABASE_KEY_RE.test(text)) keyFound = true;
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
