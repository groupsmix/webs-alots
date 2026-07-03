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
const SMOKE_AI_PATH = process.env.SMOKE_AI_PATH || "";
const SMOKE_AI_METHOD = (process.env.SMOKE_AI_METHOD || "POST").toUpperCase();
const SMOKE_AI_BODY =
  process.env.SMOKE_AI_BODY ||
  JSON.stringify({
    question: "Réponds avec un bref statut de disponibilité.",
    conversationHistory: [],
  });
const SMOKE_AI_COOKIE = process.env.SMOKE_AI_COOKIE || "";
const SMOKE_AI_AUTH_HEADER = process.env.SMOKE_AI_AUTH_HEADER || "";
const SMOKE_AI_EXPECT_STATUS = Number(process.env.SMOKE_AI_EXPECT_STATUS || 200);

// Audit Task 14: paths that are 501 stubs in the main Worker and MUST be
// zone-routed to the separate `webs-alots-ai` Worker in production. Comma-
// separated; set empty to skip.
const SMOKE_AI_WORKER_PATHS = (process.env.SMOKE_AI_WORKER_PATHS || "/api/copilotkit")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
// Three recognised shapes (chunk-source forms — NOT the rendered DOM, which
// reflects the runtime sentinel and cannot be trusted for build-time checks):
//
//   1. Minifier-folded literal:        "__OLTIGO_MASKING_BUILD__partial"
//      (when the minifier statically concatenates marker + level)
//
//   2. Webpack-style exports descriptor:
//      ..."MASKING_BUILD_LEVEL", 0, "partial", ... "MASKING_BUILD_MARKER"...
//      (turbopack/webpack `e.s([...])` exports — the level sits as a separate
//      export entry adjacent to the binding name; the value is the literal
//      result of inlining process.env.NEXT_PUBLIC_DATA_MASKING || "unset")
//
//   3. Unfolded binding initializer:
//      NEXT_PUBLIC_DATA_MASKING || "<level>"
//      (build kept the original `|| "unset"` fallback because inlining did
//      not reach this file — same failure mode #1016 exists to detect, and
//      the level captured is the FALLBACK, not the true build-time value)
//
// The previous "[\s\S]{0,300}?(partial|full|none|unset)" form was a foot-gun:
// when inlining failed, mask.ts's own `=== "none"` / `=== "full"`
// comparisons sit only a few dozen chars after the marker in the chunk, and
// the non-greedy match would lock onto one of those — reporting e.g. "none"
// while the true MASKING_BUILD_LEVEL at runtime was "unset". Each regex
// below is anchored to a binding the level is provably associated with.
const MASKING_SENTINEL_RE_FOLDED = /__OLTIGO_MASKING_BUILD__(partial|full|none|unset)/;
const MASKING_SENTINEL_RE_EXPORT =
  /["']MASKING_BUILD_LEVEL["']\s*,\s*\d+\s*,\s*["'](partial|full|none|unset)["']/;
const MASKING_SENTINEL_RE_BINDING =
  /NEXT_PUBLIC_DATA_MASKING\s*\|\|\s*["'](partial|full|none|unset)["']/;
function extractMaskingLevel(text) {
  return (
    text.match(MASKING_SENTINEL_RE_FOLDED)?.[1] ??
    text.match(MASKING_SENTINEL_RE_EXPORT)?.[1] ??
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

async function fetchText(url, init = undefined) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
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

/**
 * Audit Task 17 — Layer 4: Health endpoint JSON validation.
 */
async function checkHealthJson() {
  try {
    const { status, text } = await fetchText(BASE + "/api/health");
    log(status < 503, `health JSON: HTTP ${status} (expected < 503)`);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      log(false, "health JSON: response is not valid JSON");
      return;
    }
    // /api/health is wrapped by apiSuccess() so the live response shape is
    // { ok: true, data: HealthResponse }. Both the route's own tests and
    // the admin /status page + cron uptime monitor read `body.data.status`,
    // so the smoke test follows the same contract. Fall back to top-level
    // `status` for safety against future shape changes.
    const healthStatus =
      typeof parsed?.data?.status === "string"
        ? parsed.data.status
        : typeof parsed?.status === "string"
          ? parsed.status
          : undefined;
    log(
      typeof healthStatus === "string",
      `health JSON: has "status" field (${JSON.stringify(healthStatus)})`,
    );
    log(
      healthStatus !== "unhealthy",
      healthStatus !== "unhealthy"
        ? `health JSON: status is "${healthStatus}"`
        : `health JSON: status is "unhealthy" — a dependency is DOWN`,
    );
  } catch (err) {
    log(false, `health JSON: request failed (${err?.message || err})`);
  }
}

/**
 * Audit Task 17 — Layer 5: Security headers.
 */
async function checkSecurityHeaders() {
  let resHeaders;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(BASE + "/login", { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    resHeaders = res.headers;
  } catch (err) {
    log(false, `security headers: could not fetch /login (${err?.message || err})`);
    return;
  }
  const REQUIRED = [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", null],
  ];
  for (const [name, expected] of REQUIRED) {
    const val = resHeaders.get(name);
    if (expected === null) {
      log(val !== null, `security headers: ${name} is ${val !== null ? `"${val}"` : "MISSING"}`);
    } else {
      log(
        val?.toLowerCase() === expected.toLowerCase(),
        `security headers: ${name} = ${val ?? "MISSING"} (expected "${expected}")`,
      );
    }
  }
}

/**
 * Audit Task 17 — Layer 6: Auth page noindex regression guard.
 */
async function checkAuthNoindex() {
  for (const path of ["/login", "/register"]) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(BASE + path, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      const robotsHeader = res.headers.get("x-robots-tag") || "";
      const html = await res.text();
      const metaNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"'<>]*noindex/i.test(
        html,
      );
      const headerNoindex = /noindex/i.test(robotsHeader);
      log(
        metaNoindex || headerNoindex,
        `auth noindex: ${path} — ${
          metaNoindex
            ? "meta robots noindex present"
            : headerNoindex
              ? `X-Robots-Tag: ${robotsHeader}`
              : "NO noindex found — page may be indexed by search engines"
        }`,
      );
    } catch (err) {
      log(false, `auth noindex: ${path} request failed (${err?.message || err})`);
    }
  }
}

/**
 * Audit Task 14 — Layer 7: dual-Worker AI routing split.
 *
 * /api/copilotkit is a STUB in the main `webs-alots` Worker that returns
 * HTTP 501. In production, Cloudflare zone routes must send this path to the
 * separate `webs-alots-ai` Worker BEFORE the main Worker sees it. The built-in failure signature of a missing or
 * misordered route is therefore a 501 served from the main Worker — exactly
 * what this probe catches. A correctly routed unauthenticated call is rejected
 * by the AI Worker (typically 401/403/405), never answered by the 501 stub.
 */
async function checkAiWorkerRouting() {
  if (SMOKE_AI_WORKER_PATHS.length === 0) {
    console.log("· ai routing: skipped (SMOKE_AI_WORKER_PATHS empty)");
    return;
  }
  for (const path of SMOKE_AI_WORKER_PATHS) {
    try {
      const { status, text } = await fetchText(BASE + path);
      // 501 is the definitive stub signature; the "Route moved" body marker is
      // stub-specific too and guards against the status code being changed.
      const servedByStub = status === 501 || /"error"\s*:\s*"Route moved"/.test(text);
      log(
        !servedByStub,
        servedByStub
          ? `ai routing: ${path} → HTTP ${status} served by the 501 STUB in the main Worker — ` +
              `the Cloudflare zone route to webs-alots-ai is missing or misordered`
          : `ai routing: ${path} → HTTP ${status} (reached webs-alots-ai, not the 501 stub)`,
      );
      // Informational only: a routed unauthenticated call should be rejected.
      if (!servedByStub && status >= 400 && ![401, 403, 405].includes(status)) {
        console.log(
          `· ai routing: ${path} returned ${status} (expected 401/403/405 unauthenticated) — review`,
        );
      }
    } catch (err) {
      log(false, `ai routing: ${path} request failed (${err?.message || err})`);
    }
  }
}

async function checkOptionalAiEndpoint() {
  if (!SMOKE_AI_PATH) {
    console.log("· ai smoke: skipped (SMOKE_AI_PATH not configured)");
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (SMOKE_AI_COOKIE) headers.Cookie = SMOKE_AI_COOKIE;
  if (SMOKE_AI_AUTH_HEADER) headers.Authorization = SMOKE_AI_AUTH_HEADER;

  try {
    const {
      status,
      text,
      headers: responseHeaders,
    } = await fetchText(BASE + SMOKE_AI_PATH, {
      method: SMOKE_AI_METHOD,
      headers,
      body: SMOKE_AI_METHOD === "GET" || SMOKE_AI_METHOD === "HEAD" ? undefined : SMOKE_AI_BODY,
    });

    log(
      status === SMOKE_AI_EXPECT_STATUS,
      `ai smoke: ${SMOKE_AI_PATH} → HTTP ${status} (expected ${SMOKE_AI_EXPECT_STATUS})`,
    );

    const contentType = responseHeaders.get("content-type") || "";
    const isJson = /application\/json/i.test(contentType);
    const isSse = /text\/event-stream/i.test(contentType);
    log(
      isJson || isSse,
      `ai smoke: content-type ${contentType || "MISSING"} (expected JSON or SSE)`,
    );

    if (isJson) {
      try {
        const parsed = JSON.parse(text);
        const ok = parsed?.ok === true || typeof parsed?.data === "object";
        log(ok, `ai smoke: JSON payload shape is ${ok ? "valid" : "unexpected"}`);
      } catch {
        log(false, "ai smoke: response body is not valid JSON");
      }
    } else if (isSse) {
      log(/data:\s*/.test(text), "ai smoke: SSE stream emitted data frames");
    }
  } catch (err) {
    log(false, `ai smoke: request failed (${err?.message || err})`);
  }
}

(async () => {
  console.log(`Post-deploy smoke test → ${BASE}\n`);
  await checkRoutes();
  await checkSignupIntegrity();
  await checkHealthJson();
  await checkSecurityHeaders();
  await checkAuthNoindex();
  await checkAiWorkerRouting();
  await checkOptionalAiEndpoint();
  console.log("");
  if (failures > 0) {
    console.error(`✗ smoke test FAILED with ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("✓ smoke test passed.");
})();
