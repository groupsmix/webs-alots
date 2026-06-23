export async function sendSlackAlert(message: string): Promise<void> {
  // nosemgrep: semgrep.env-access - Test execution only
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("No Slack webhook configured. Would have sent:", message);
    return;
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
