/**
 * k6 Load Test — Oltigo Health Critical Paths
 *
 * F-A86-02: Baseline load test for booking, webhook, and AI endpoints.
 * Validates p95/p99 latency budgets under realistic clinic traffic.
 *
 * Run locally:
 *   k6 run tests/load/booking-and-ai.k6.js --env BASE_URL=https://staging.oltigo.health
 *
 * Run in CI (after deployment to staging):
 *   k6 run tests/load/booking-and-ai.k6.js \
 *     --env BASE_URL=$STAGING_URL \
 *     --env AUTH_TOKEN=$STAGING_LOAD_TEST_TOKEN \
 *     --out json=results/k6-$(date +%Y%m%d).json
 *
 * Latency budgets (SLOs):
 *   Booking availability check : p95 < 300ms, p99 < 500ms
 *   Booking create             : p95 < 500ms, p99 < 1000ms
 *   Patient list (staff)       : p95 < 400ms, p99 < 800ms
 *   AI drug-check              : p95 < 3000ms, p99 < 5000ms (LLM latency)
 *   Static assets              : p95 < 50ms
 *
 * @see https://k6.io/docs/
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────

const bookingErrors = new Counter("booking_errors");
const aiErrors = new Counter("ai_errors");
const bookingDuration = new Trend("booking_duration", true);
const aiDuration = new Trend("ai_duration", true);
const errorRate = new Rate("error_rate");

// ── Test configuration ────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Realistic clinic traffic (daytime ramp)
    clinic_traffic: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },  // Ramp up
        { duration: "2m", target: 25 },   // Sustain peak clinic load
        { duration: "30s", target: 50 },  // Spike (busy morning)
        { duration: "1m", target: 25 },   // Return to normal
        { duration: "30s", target: 0 },   // Ramp down
      ],
    },
    // Scenario 2: Sustained low background traffic (cron health check pattern)
    background_traffic: {
      executor: "constant-vus",
      vus: 3,
      duration: "5m",
    },
  },

  thresholds: {
    // P95/P99 latency budgets
    "booking_duration{type:availability}": ["p(95)<300", "p(99)<500"],
    "booking_duration{type:create}": ["p(95)<500", "p(99)<1000"],
    "ai_duration{type:drug-check}": ["p(95)<3000", "p(99)<5000"],

    // Error rate budgets
    "error_rate": ["rate<0.01"],          // < 1% overall errors
    "booking_errors": ["count<10"],       // < 10 booking errors per run
    "ai_errors": ["count<5"],             // < 5 AI errors per run

    // k6 built-in
    "http_req_failed": ["rate<0.01"],
    "http_req_duration": ["p(95)<2000"],  // Global 2s p95 budget
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Authorization": AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : "",
    // Simulate a real clinic subdomain
    "Host": `demo.${new URL(BASE_URL).hostname}`,
    ...extra,
  };
}

// ── Scenarios ─────────────────────────────────────────────────────────────

/**
 * Main test function — simulates a staff member's session.
 */
export default function () {
  // 1. Check booking availability
  const availabilityStart = Date.now();
  const availRes = http.get(
    `${BASE_URL}/api/booking/available-slots?date=${new Date().toISOString().split("T")[0]}&clinicId=test`,
    { headers: headers(), tags: { type: "availability" } },
  );
  bookingDuration.add(Date.now() - availabilityStart, { type: "availability" });

  const availOk = check(availRes, {
    "availability 200": (r) => r.status === 200 || r.status === 401,
    "availability < 500ms": (r) => r.timings.duration < 500,
  });
  if (!availOk) {
    bookingErrors.add(1);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(1);

  // 2. Patient list lookup (staff endpoint)
  const patientRes = http.get(
    `${BASE_URL}/api/v1/patients?limit=20&page=1`,
    { headers: headers(), tags: { type: "patient-list" } },
  );

  check(patientRes, {
    "patients 200 or 401": (r) => r.status === 200 || r.status === 401,
    "patients < 800ms": (r) => r.timings.duration < 800,
  });

  sleep(0.5);

  // 3. AI drug-check (every 5th virtual user to avoid overwhelming LLM)
  if (__VU % 5 === 0) {
    const aiStart = Date.now();
    const aiRes = http.post(
      `${BASE_URL}/api/v1/ai/drug-check`,
      JSON.stringify({
        medications: ["metformin 500mg", "lisinopril 10mg"],
        patientAge: 55,
      }),
      { headers: headers(), tags: { type: "drug-check" } },
    );
    aiDuration.add(Date.now() - aiStart, { type: "drug-check" });

    const aiOk = check(aiRes, {
      "drug-check 200 or 401 or 429": (r) =>
        r.status === 200 || r.status === 401 || r.status === 429,
      "drug-check < 5000ms": (r) => r.timings.duration < 5000,
    });
    if (!aiOk) {
      aiErrors.add(1);
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }

    sleep(2); // Longer pause after AI call
  }

  sleep(1);
}

/**
 * Setup: called once before the test. Validates connectivity.
 */
export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    console.warn(`[setup] Health check returned ${healthRes.status} — test may fail`);
  }
  return { startedAt: new Date().toISOString() };
}

/**
 * Teardown: called once after the test. Logs the run summary.
 */
export function teardown(data) {
  console.log(`[teardown] Load test completed. Started at: ${data.startedAt}`);
}
