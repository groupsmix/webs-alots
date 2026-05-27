/**
 * QA-004: k6 smoke load test for staging deployments.
 *
 * Validates SLO claims (99.9% availability, p95 < 800ms) under light load.
 * Run manually or wire into deploy.yml staging step:
 *
 *   k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js
 *
 * Thresholds:
 *   - p95 response time < 800ms
 *   - Error rate < 0.1%
 *   - Availability > 99.9%
 */

/* eslint-disable import/no-anonymous-default-export */
import { check, sleep } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "https://staging.oltigo.com";

export const options = {
  stages: [
    { duration: "30s", target: 20 },  // ramp up
    { duration: "3m", target: 100 },  // sustain
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],  // SLO: p95 < 800ms
    http_req_failed: ["rate<0.001"],   // SLO: error rate < 0.1%
  },
};

export default function () {
  // Health check endpoint
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    "health status 200": (r) => r.status === 200,
    "health p95 < 500ms": (r) => r.timings.duration < 500,
  });

  // Public availability endpoint (no auth required)
  const avail = http.get(`${BASE_URL}/api/v1/availability`);
  check(avail, {
    "availability responds": (r) => r.status < 500,
  });

  // Landing page
  const landing = http.get(`${BASE_URL}/`);
  check(landing, {
    "landing status 200": (r) => r.status === 200,
    "landing p95 < 800ms": (r) => r.timings.duration < 800,
  });

  sleep(1);
}
