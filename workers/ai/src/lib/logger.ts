/**
 * Minimal structured logger for the webs-alots-ai Worker.
 *
 * Cloudflare Workers does capture console.* output in its observability
 * dashboard, but structured JSON logging with consistent fields makes
 * log querying and alerting far more reliable.
 */

type LogData = Record<string, unknown> | undefined;

function log(level: "info" | "warn" | "error", msg: string, data?: LogData): void {
  const entry: Record<string, unknown> = { level, msg };
  if (data) Object.assign(entry, data);
  // Cloudflare observability captures these as structured log lines.
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, data?: LogData) => log("info", msg, data),
  warn: (msg: string, data?: LogData) => log("warn", msg, data),
  error: (msg: string, data?: LogData) => log("error", msg, data),
};
