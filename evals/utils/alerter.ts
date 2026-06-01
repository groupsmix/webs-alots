export async function sendSlackAlert(message: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("No Slack webhook configured. Would have sent:", message);
    return;
  }
  
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 *AI Evaluation Alert*\n${message}` })
    });
  } catch (err) {
    console.error("Failed to send Slack alert:", err);
  }
}

export async function alertOnFailure(metrics: any) {
  if (metrics.failed > 0) {
    await sendSlackAlert(`Evaluation Failed! ${metrics.failed} test cases failed out of ${metrics.total}.`);
  }
}
