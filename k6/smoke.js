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

/** Tracks whether each user-facing probe succeeded — drives the availability SLO. */
const availability = new Rate("availability");

// ── Setup: validate environment ──────────────────────────────────────────────

export function setup() {
  const baseUrl = __ENV.BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "BASE_URL is required. Example: k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js",
    );
  }
  const isProd =
    baseUrl.includes("oltigo.com") &&
    !baseUrl.includes("staging") &&
    !baseUrl.includes("preview") &&
    !baseUrl.includes("localhost");
  if (isProd && __ENV.ALLOW_PROD !== "true") {
    throw new Error("BASE_URL looks like a production host. Set --env ALLOW_PROD=true to confirm.");
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

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function (data) {
  const BASE_URL = data.baseUrl;

  // ── /api/ping — liveness probe ────────────────────────────────────────────
  // Must be 200. Any other status = hard failure.
  const ping = http.get(`${BASE_URL}/api/ping`, {
    tags: { endpoint: "ping" },
  });
  const pingOk = check(ping, {
    "ping 200": (r) => r.status === 200,
  });
  availability.add(pingOk);

  // ── /api/status — platform status ─────────────────────────────────────────
  // Accepts 200 (all ok) and 503 (degraded but intentionally reported).
  // 503 is an expected response when a subsystem is disabled (e.g. AI kill
  // switch), NOT an infrastructure failure — don't trip http_req_failed.
  const status = http.get(`${BASE_URL}/api/status`, {
    tags: { endpoint: "status" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  const statusOk = check(status, {
    "status 200 or 503": (r) => r.status === 200 || r.status === 503,
    "status has status field": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.status === "string";
      } catch {
        return false;
      }
    },
  });
  availability.add(statusOk);

  // ── /api/health — readiness probe ─────────────────────────────────────────
  // Same contract as /api/status: 200 = healthy, 503 = degraded but responsive.
  const health = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: "health" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  const healthOk = check(health, {
    "health 200 or 503": (r) => r.status === 200 || r.status === 503,
    "health has status value": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "ok" || body.status === "degraded";
      } catch {
        return false;
      }
    },
  });
  availability.add(healthOk);

  // ── / — landing page ──────────────────────────────────────────────────────
  // Accepts any 2xx or 3xx — the CDN may redirect to a locale-prefixed URL
  // (e.g. /fr/) which is correct behaviour, not a failure.
  const landing = http.get(`${BASE_URL}/`, {
    tags: { endpoint: "landing" },
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }),
  });
  const landingOk = check(landing, {
    "landing 2xx or 3xx": (r) => r.status >= 200 && r.status <= 399,
  });
  availability.add(landingOk);

  sleep(1);
}
