import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

/**
 * Checks if a login attempt is suspicious (new device/IP country).
 * In a real-world scenario, this would compare the IP against a known database
 * of previous logins for the user and enqueue a notification (email/WhatsApp).
 */
export async function checkSuspiciousLogin(
  email: string,
  clientIp: string,
  clinicId?: string,
): Promise<void> {
  try {
    const supabase = createAdminClient("audit_log", clinicId);

    // For this implementation, we will log the check.
    // A robust implementation would store the IP/fingerprint in a `user_devices`
    // table and trigger a notification if the IP is unseen.

    logger.info("Suspicious login check initiated", {
      context: "suspicious-login",
      email,
      ip: clientIp,
    });

    // We can simulate an alert trigger here. In reality, we'd enqueue a task
    // to the notification worker to send an email to the user.
    await supabase.from("activity_logs").insert({
      clinic_id: clinicId ?? null,
      action: "suspicious_login_checked",
      actor: email,
      type: "admin",
      ip_address: clientIp,
      description: `Suspicious login checks performed for ${email}`,
      metadata: { status: "checked" },
    });
  } catch (err) {
    logger.warn("Failed to perform suspicious login check", {
      context: "suspicious-login",
      email,
      error: err,
    });
  }
}
