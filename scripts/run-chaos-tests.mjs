#!/usr/bin/env node
/**
 * Chaos engineering harness.
 *
 * Enables chaos experiments on a running instance, probes a liveness endpoint
 * under fault injection to confirm the app degrades gracefully (responds with
 * an HTTP status rather than dropping the connection), then disables chaos and
 * verifies the system recovers to a healthy state.
 *
 * This is NOT a mock: enabling chaos is treated as fatal if it fails (there is
 * nothing to test otherwise), chaos is ALWAYS disabled in a finally block so a
 * failed probe cannot leave the target in a degraded state, and the process
 * exits non-zero if liveness or recovery checks fail.
 *
 * Usage:
 *   CHAOS_TARGET_URL=http://localhost:3000 node scripts/run-chaos-tests.mjs
 *
 * Optional environment:
 *   CHAOS_TARGET_URL    Base URL of the target (default http://localhost:3000)
 *   CHAOS_HEALTH_PATH   Liveness path (default /api/health)
 *   CHAOS_AUTH_COOKIE   Cookie header for the super-admin chaos toggle endpoint
 *   CHAOS_AUTH_HEADER   Authorization header for the toggle endpoint
 *   CHAOS_PROBES        Number of liveness probes under chaos (default 10)
 *   CHAOS_RECOVERY_TIMEOUT_MS  Max wait for recovery (default 60000)
 */

const BASE = (process.env.CHAOS_TARGET_URL || "http://localhost:3000").replace(/\/$/, "");
const HEALTH_PATH = process.env.CHAOS_HEALTH_PATH || "/api/health";
const PROBES = Number(process.env.CHAOS_PROBES || 10);
const RECOVERY_TIMEOUT_MS = Number(process.env.CHAOS_RECOVERY_TIMEOUT_MS || 60000);
const REQUEST_TIMEOUT_MS = Number(process.env.CHAOS_REQUEST_TIMEOUT_MS || 10000);

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (process.env.CHAOS_AUTH_COOKIE) headers.Cookie = process.env.CHAOS_AUTH_COOKIE;
  if (process.env.CHAOS_AUTH_HEADER) headers.Authorization = process.env.CHAOS_AUTH_HEADER;
  return headers;
}

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function setChaos(enabled) {
  const res = await fetchWithTimeout(`${BASE}/api/super-admin/chaos/toggle`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error(`chaos toggle (enabled=${enabled}) returned HTTP ${res.status}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Probe liveness under chaos: a graceful response (any HTTP status) is a pass;
 *  a dropped connection / abort is a failure. */
async function probeLiveness() {
  let responded = 0;
  let dropped = 0;
  for (let i = 0; i < PROBES; i++) {
    try {
      const res = await fetchWithTimeout(BASE + HEALTH_PATH);
      responded++;
      console.log(`  probe ${i + 1}/${PROBES}: HTTP ${res.status}`);
    } catch (err) {
      dropped++;
      console.warn(`  probe ${i + 1}/${PROBES}: connection dropped (${err?.message || err})`);
    }
    await sleep(500);
  }
  return { responded, dropped };
}

/** Poll until the health endpoint reports a non-degraded status or we time out. */
async function waitForRecovery() {
  const deadline = Date.now() + RECOVERY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(BASE + HEALTH_PATH);
      if (res.status < 500) {
        let status;
        try {
          const body = await res.json();
          status = body?.data?.status ?? body?.status;
        } catch {
          /* non-JSON health body is still a live response */
        }
        if (status !== "unhealthy") {
          console.log(`  recovered: HTTP ${res.status}${status ? ` (status="${status}")` : ""}`);
          return true;
        }
      }
    } catch {
      /* keep polling */
    }
    await sleep(2000);
  }
  return false;
}

async function main() {
  console.log(`Chaos Engineering Harness → ${BASE}\n`);

  console.log("1. Enabling chaos experiments...");
  try {
    await setChaos(true);
  } catch (err) {
    console.error(`FATAL: could not enable chaos — nothing to test (${err?.message || err}).`);
    console.error(
      "Ensure the target is running and CHAOS_AUTH_COOKIE/CHAOS_AUTH_HEADER grant super-admin access.",
    );
    process.exit(1);
  }
  console.log("   chaos enabled.\n");

  let liveness;
  let recovered = false;
  try {
    console.log(`2. Probing liveness under chaos (${PROBES} requests)...`);
    liveness = await probeLiveness();
  } finally {
    // ALWAYS disable chaos, even if probing threw, so we never leave the
    // target in a degraded state.
    console.log("\n3. Disabling chaos experiments...");
    try {
      await setChaos(false);
      console.log("   chaos disabled.");
    } catch (err) {
      console.error(
        `WARNING: failed to disable chaos — disable it manually! (${err?.message || err})`,
      );
    }
  }

  console.log("\n4. Verifying system recovery...");
  recovered = await waitForRecovery();

  console.log("\n=== Chaos test summary ===");
  console.log(
    `  liveness under chaos: ${liveness.responded}/${PROBES} responded, ${liveness.dropped} dropped`,
  );
  console.log(`  recovery:             ${recovered ? "OK" : "TIMED OUT"}`);

  // Pass criteria: the app stayed reachable under chaos (no dropped
  // connections) and returned to a healthy state afterwards.
  const passed = liveness.dropped === 0 && recovered;
  if (!passed) {
    console.error("\n✗ Chaos test FAILED.");
    process.exit(1);
  }
  console.log("\n✓ Chaos test passed — system degraded gracefully and recovered.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
