import { describe, expect, it } from "vitest";
import {
  computeOverallStatus,
  deriveHealthStatus,
  MONITORED_SERVICES,
  type HealthApiData,
} from "@/lib/monitoring/services";

const healthData = (overrides: Partial<HealthApiData> = {}): HealthApiData => ({
  status: "ok",
  database: "connected",
  version: "0.1.0",
  nodeVersion: "v22.13.0",
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe("deriveHealthStatus", () => {
  it("reports everything operational on a healthy response", () => {
    const result = deriveHealthStatus({ kind: "ok", data: healthData() });
    expect(result.webApp).toBe("operational");
    expect(result.database).toBe("operational");
    expect(result.version).toBe("0.1.0");
    expect(result.nodeVersion).toBe("v22.13.0");
  });

  it("marks the database down when the health body says disconnected", () => {
    const result = deriveHealthStatus({
      kind: "ok",
      data: healthData({ database: "disconnected" }),
    });
    expect(result.webApp).toBe("operational");
    expect(result.database).toBe("down");
  });

  // Regression test for the System Status vs Uptime SLA contradiction: a 503
  // (database unreachable) must surface the DB as "down", never "operational".
  it("marks the database down on an HTTP error (e.g. 503 DB_UNREACHABLE)", () => {
    const result = deriveHealthStatus({ kind: "http-error" });
    expect(result.webApp).toBe("degraded");
    expect(result.database).toBe("down");
  });

  it("marks the database down on a malformed body", () => {
    const result = deriveHealthStatus({ kind: "bad-json" });
    expect(result.database).toBe("down");
  });

  it("marks both web app and database down when the server is unreachable", () => {
    const result = deriveHealthStatus({ kind: "network-error" });
    expect(result.webApp).toBe("down");
    expect(result.database).toBe("down");
    expect(result.nodeVersion).toBeNull();
  });

  it("falls back to the default version when the response omits it", () => {
    const result = deriveHealthStatus({
      kind: "ok",
      data: healthData({ version: "" }),
    });
    expect(result.version).toBe("0.1.0");
  });
});

describe("computeOverallStatus", () => {
  it("returns operational when all services are operational", () => {
    expect(computeOverallStatus(["operational", "operational", "operational"])).toBe("operational");
  });

  it("returns degraded when any service is degraded but none are down", () => {
    expect(computeOverallStatus(["operational", "degraded", "operational"])).toBe("degraded");
  });

  it("returns down when any service is down (worst-wins over degraded)", () => {
    expect(computeOverallStatus(["degraded", "down", "operational"])).toBe("down");
  });

  it("treats an empty set as operational", () => {
    expect(computeOverallStatus([])).toBe("operational");
  });
});

describe("MONITORED_SERVICES", () => {
  it("tracks the three always-on core services", () => {
    expect(MONITORED_SERVICES.map((s) => s.key)).toEqual(["web", "database", "auth"]);
  });
});
