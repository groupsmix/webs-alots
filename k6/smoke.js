/**
 * k6 smoke / load test — Oltigo Health staging.
 *
 * This file is run MANUALLY only. Automated post-deploy checks use
 * scripts/smoke-post-deploy.mjs (no k6 dependency).
 *
 * Usage:
 *   # Install k6: https://k6.io/docs/get-started/installation/
 *
 *   # Smoke mode (default — 2 VUs, 30 s, safe for any environment):
 *   k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js
 *
 *   # Load mode (100-VU ramp — staging only, explicit opt-in required):
 *   k6 run --env BASE_URL=https://staging.oltigo.com --env SMOKE_MODE=load k6/smoke.js
 *
 *   # Production (requires explicit opt-in to prevent accidents):
 *   k6 run --env BASE_URL=https://oltigo.com --env ALLOW_PROD=true k6/smoke.js
 *
 * Thresholds enforced:
 *   - availability (custom Rate):  > 99.9 % across user-facing probes
 *   - http_req_failed:             < 0.1 %  (k6 built-in)
 *   - per-endpoint p95 durations:  ping < 300ms, status/health < 500ms, landing < 800ms
 */

/* eslint-disable import/no-anonymous-default-export */
import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

// ── Custom metrics ──────────────────────────────────────────────────────────

/**
 * Tracks HTTP-layer availability only (2xx/503 as expected).
 * JSON-body assertion failures are tracked separately and do NOT
 * trip the availability SLO so that a malformed body doesn't mask
 * a healthy HTTP layer.
 */
const availability = new Rate("availability");

// ── Allowed host allowlist ───────────────────────────────────────────────────

/**
 * Only these hostnames (and their subdomains) are recognised as known
 * Oltigo hosts. Any other host is rejected to prevent accidentally running
 * a load test against an attacker-controlled URL or a typo'd domain.
 *
 * Fix #1: replaces the old `endsWith(".oltigo.com")` check which could be
 * bypassed by a crafted hostname such as "staging.oltigo.com.evil.com".
 */
const ALLOWED_HOSTS = ["oltigo.com", "staging.oltigo.com", "preview.oltigo.com", "localhost"];

function classifyHost(hostname) {
  // Exact match
  if (ALLOWED_HOSTS.includes(hostname)) {
    return hostname === "localhost"
      ? "local"
      : hostname.startsWith("staging") || hostname.startsWith("preview")
        ? "non-prod"
        : "prod";
  }
  // Subdomain of a known host (e.g. "pr-42.preview.oltigo.com")
  for (const allowed of ALLOWED_HOSTS) {
    if (hostname.endsWith(`.${allowed}`)) {
      return allowed === "oltigo.com" ? "prod" : "non-prod";
    }
  }
  return "unknown";
}

// ── Setup: validate environment ──────────────────────────────────────────────

export function setup() {
  const baseUrl = __ENV.BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "BASE_URL is required. Example: k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js",
    );
  }

  // Fix #2: enforce HTTPS (except localhost which may use http for local dev).
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`BASE_URL is not a valid URL: ${baseUrl}`);
  }

  const hostname = parsed.hostname;
  const scheme = parsed.protocol; // "https:" or "http:"

  if (scheme !== "https:" && hostname !== "localhost") {
    throw new Error(
      `BASE_URL must use HTTPS (got "${scheme}"). Plaintext HTTP risks exposing auth cookies. ` +
        `Use: https://${hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`,
    );
  }

  // Fix #1: allowlist-based host classification replaces fragile substring match.
  const hostClass = classifyHost(hostname);

  if (hostClass === "unknown") {
    throw new Error(
      `BASE_URL hostname "${hostname}" is not a recognised Oltigo host. ` +
        `Allowed hosts: ${ALLOWED_HOSTS.join(", ")} (and their subdomains). ` +
        `If this is intentional, add it to the ALLOWED_HOSTS list in k6/smoke.js.`,
    );
  }

  const isProd = hostClass === "prod";
  if (isProd && __ENV.ALLOW_PROD !== "true") {
    throw new Error(
      `BASE_URL resolves to a production host (${hostname}). Set --env ALLOW_PROD=true to confirm.`,
    );
  }

  return { baseUrl };
}

// ── Scenario options ─────────────────────────────────────────────────────────

const smokeScenario = {
  executor: "constant-vus",
  vus: 2,
  duration: "30s",
};

const loadScenario = {
  executor: "ramping-vus",
  stages: [
    { duration: "30s", target: 20 }, // ramp up
    { duration: "3m", target: 100 }, // sustain at 100 VUs
    { duration: "30s", target: 0 }, // ramp down
  ],
};

const isLoadMode = __ENV.SMOKE_MODE === "load";

export const options = {
  scenarios: {
    main: isLoadMode ? loadScenario : smokeScenario,
  },
  thresholds: {
    // Availability SLO: > 99.9% of user-facing probes must succeed.
    availability: ["rate>0.999"],

    // Overall error rate < 0.1%.
    http_req_failed: ["rate<0.001"],

    // Per-endpoint p95 latency budgets (tagged thresholds).
    "http_req_duration{endpoint:ping}": ["p(95)<300"],
    "http_req_duration{endpoint:status}": ["p(95)<500"],
    "http_req_duration{endpoint:health}": ["p(95)<500"],
    "http_req_duration{endpoint:landing}": ["p(95)<800"],
  },
};

// ── Request params ────────────────────────────────────────────────────────────

/**
 * Fix #4: per-request timeout so a hanging server fails fast instead of
 * blocking a VU for the full 60-second k6 default.
 */
const REQUEST_PARAMS = { timeout: "5s" };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fix #5 / Fix #6: parse JSON body defensively.
 * Returns the parsed object on success, or null on failure — and emits a
 * diagnostic console.warn so malformed bodies are visible in the k6 summary
 * without silently returning false from a check.
 *
 * Callers use this for assertion-only checks that are kept separate from the
 * HTTP-layer availability metric so a bad body doesn't trip the SLO.
 */
function parseJsonBody(r) {
  const ct = r.headers["Content-Type"] || "";
  if (!ct.includes("application/json")) {
    console.warn(`[warn] ${r.url} returned Content-Type "${ct}" — expected application/json`);
  }
  try {
    return JSON.parse(r.body);
  } catch (e) {
    console.warn(`[warn] ${r.url} body is not valid JSON: ${e.message}`);
    return null;
  }
}

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function (data) {
  const BASE_URL = data.baseUrl;

  // Fix #3: randomised think time (0.5 – 2.5 s) to avoid synchronised request
  // waves and produce a more realistic load distribution.
  const thinkTime = Math.random() * 2 + 0.5;

  // ── /api/ping — liveness probe ────────────────────────────────────────────
  // Must be 200. Any other status = hard failure.
  const ping = http.get(`${BASE_URL}/api/ping`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "ping" },
  });
  // HTTP-layer check drives the availability SLO.
  const pingHttpOk = check(ping, {
    "ping 200": (r) => r.status === 200,
  });
  availability.add(pingHttpOk);

  // ── /api/status — platform status ─────────────────────────────────────────
  // Accepts 200 (all ok) and 503 (degraded but intentionally reported).
  // 503 is an expected response when a subsystem is disabled (e.g. AI kill
  // switch), NOT an infrastructure failure — don't trip http_req_failed.
  const status = http.get(`${BASE_URL}/api/status`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "status" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  // Fix #5: HTTP availability and JSON body assertion tracked separately.
  const statusHttpOk = check(status, {
    "status 200 or 503": (r) => r.status === 200 || r.status === 503,
  });
  availability.add(statusHttpOk);
  // Body assertion — failure here is surfaced as a check failure but does NOT
  // affect the availability SLO metric.
  const statusBody = parseJsonBody(status);
  check(statusBody, {
    "status has status field": (b) => b !== null && typeof b.status === "string",
  });

  // ── /api/health — readiness probe ─────────────────────────────────────────
  // Same contract as /api/status: 200 = healthy, 503 = degraded but responsive.
  const health = http.get(`${BASE_URL}/api/health`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "health" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  // Fix #5: HTTP availability and JSON body assertion tracked separately.
  const healthHttpOk = check(health, {
    "health 200 or 503": (r) => r.status === 200 || r.status === 503,
  });
  availability.add(healthHttpOk);
  const healthBody = parseJsonBody(health);
  check(healthBody, {
    "health has status value": (b) => b !== null && (b.status === "ok" || b.status === "degraded"),
  });

  // ── / — landing page ──────────────────────────────────────────────────────
  // Accepts any 2xx or 3xx — the CDN may redirect to a locale-prefixed URL
  // (e.g. /fr/) which is correct behaviour, not a failure.
  const landing = http.get(`${BASE_URL}/`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "landing" },
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }),
  });
  const landingOk = check(landing, {
    "landing 2xx or 3xx": (r) => r.status >= 200 && r.status <= 399,
  });
  availability.add(landingOk);

  sleep(thinkTime);
}
