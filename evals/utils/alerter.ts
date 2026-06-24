export async function sendSlackAlert(message: string): Promise<void> {
  // nosemgrep: semgrep.env-access - Test execution only
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("No Slack webhook configured. Would have sent:", message);
    return;
  }

  // Validate the URL before posting — sending failure details to an unintended
  // endpoint (e.g. a mis-set env var) would silently exfiltrate eval metadata.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    console.error("SLACK_WEBHOOK_URL is not a valid URL — skipping alert to prevent exfiltration.");
    return;
  }
  if (parsedUrl.protocol !== "https:") {
    console.error(
      `SLACK_WEBHOOK_URL uses protocol '${parsedUrl.protocol}' — only HTTPS is permitted. Skipping alert.`,
    );
    return;
  }
  if (parsedUrl.hostname !== "hooks.slack.com" && !parsedUrl.hostname.endsWith(".slack.com")) {
    console.warn(
      `SLACK_WEBHOOK_URL hostname '${parsedUrl.hostname}' is not a known Slack host — verify this is intentional.`,
    );
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 *AI Evaluation Alert*\n${message}` }),
    });
  } catch (err) {
    console.error("Failed to send Slack alert:", err);
  }
}

interface AlertMetrics {
  total: number;
  passed: number;
  failed: number;
  passRate?: number;
}

export async function alertOnFailure(metrics: AlertMetrics): Promise<void> {
  if (metrics.failed > 0) {
    const rate = typeof metrics.passRate === "number" ? ` (${metrics.passRate.toFixed(1)}%)` : "";
    await sendSlackAlert(
      `Evaluation Failed! ${metrics.failed} of ${metrics.total} cases failed${rate}.`,
    );
  }
}
