/**
 * Tests for the pure-function helpers in `src/lib/system-status.ts`:
 * - `buildSlaReportHtml` — HTML-escapes user data, handles empty rows/incidents,
 *   formats the report shell.
 * - `getLatestReportMonth` — picks the YYYY-MM slice or falls back to today.
 *
 * The Supabase / Cloudflare probe paths are tested indirectly via the
 * /api/system/* route tests; here we lock down the deterministic helpers.
 */

import { describe, it, expect, vi } from "vitest";
import { buildSlaReportHtml, getLatestReportMonth } from "../system-status";

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => true),
}));

describe("buildSlaReportHtml", () => {
  const baseReport = {
    month: "2026-06",
    rows: [
      {
        monitorName: "Database",
        month: "2026-06",
        uptimePct: 99.95,
        downtimeEvents: 1,
        recoveryEvents: 1,
      },
      {
        monitorName: "API",
        month: "2026-06",
        uptimePct: null,
        downtimeEvents: 0,
        recoveryEvents: 0,
      },
    ],
    incidents: [
      {
        id: "inc-1",
        monitorName: "Database",
        eventType: "down" as const,
        message: "Connection refused",
        responseTimeMs: null,
        occurredAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    generatedAt: "2026-06-07T17:00:00.000Z",
  };

  it("renders rows with monitor data and uptime percentage", () => {
    const html = buildSlaReportHtml(baseReport);
    expect(html).toContain("Database");
    expect(html).toContain("API");
    expect(html).toContain("99.95%");
    // null uptime renders as em dash placeholder
    expect(html).toContain("—");
    expect(html).toContain("SLA Report — 2026-06");
  });

  it("escapes HTML in user-supplied strings (XSS guard)", () => {
    const html = buildSlaReportHtml({
      ...baseReport,
      rows: [
        {
          monitorName: "<script>alert('x')</script>",
          month: "2026-06",
          uptimePct: 100,
          downtimeEvents: 0,
          recoveryEvents: 0,
        },
      ],
      incidents: [
        {
          ...baseReport.incidents[0],
          monitorName: "<img onerror=1>",
          message: 'Error & failure "quoted"',
        },
      ],
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert");
    expect(html).toContain("&lt;img onerror=1&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  it("falls back to placeholder rows when no SLA rows or incidents are present", () => {
    const html = buildSlaReportHtml({
      ...baseReport,
      rows: [],
      incidents: [],
    });
    expect(html).toContain("No SLA rows found for this month.");
    expect(html).toContain("No incidents recorded for this month.");
  });

  it("renders an em dash when incident message is null", () => {
    const html = buildSlaReportHtml({
      ...baseReport,
      incidents: [{ ...baseReport.incidents[0], message: null }],
    });
    expect(html).toMatch(/<td>—<\/td>/);
  });

  it("limits incidents to 20 rows", () => {
    const manyIncidents = Array.from({ length: 30 }, (_, i) => ({
      id: `inc-${i}`,
      monitorName: `Monitor-${i}`,
      eventType: "down" as const,
      message: `Incident ${i}`,
      responseTimeMs: null,
      occurredAt: "2026-06-01T10:00:00.000Z",
    }));
    const html = buildSlaReportHtml({ ...baseReport, incidents: manyIncidents });
    expect(html).toContain("Monitor-0");
    expect(html).toContain("Monitor-19");
    expect(html).not.toContain("Monitor-20");
  });

  it("returns valid HTML5 with the expected title and section headers", () => {
    const html = buildSlaReportHtml(baseReport);
    expect(html.trimStart().startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>SLA Report 2026-06</title>");
    expect(html).toContain("Monthly uptime");
    expect(html).toContain("Recent incidents");
  });
});

describe("getLatestReportMonth", () => {
  it("returns the YYYY-MM slice of the first uptime entry", () => {
    expect(
      getLatestReportMonth([
        { monitorName: "DB", month: "2026-06-01", uptimePct: 99, downtimeEvents: 0 },
        { monitorName: "DB", month: "2026-05-01", uptimePct: 99, downtimeEvents: 0 },
      ]),
    ).toBe("2026-06");
  });

  it("falls back to the current month when uptime is empty", () => {
    const now = new Date().toISOString().slice(0, 7);
    expect(getLatestReportMonth([])).toBe(now);
  });

  it("falls back to the current month when month is missing", () => {
    const now = new Date().toISOString().slice(0, 7);
    // @ts-expect-error testing defensive fallback
    expect(getLatestReportMonth([{ monitorName: "DB", uptimePct: null, downtimeEvents: 0 }])).toBe(
      now,
    );
  });
});
