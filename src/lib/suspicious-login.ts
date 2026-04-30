/**
 * Suspicious login detection and alerting.
 *
 * A154: Detects when a user logs in from a new IP address or user agent
 * and sends an email alert with a one-click session revoke link.
 *
 * Login events are stored in a `login_events` table (see migration 00077).
 * On each successful login, the current IP + UA fingerprint is compared
 * against the user's recent login history. If neither has been seen before,
 * a "new device" email is dispatched.
 *
 * Feature flag: `SUSPICIOUS_LOGIN_ALERTS_ENABLED` (default: "true").
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { suspiciousLoginEmail } from "@/lib/email-templates";
import { logger } from "@/lib/logger";

// login_events is created by migration 00077 but not yet in the generated
// Database types. We use an untyped cast for the table access until the
// types are regenerated after the migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

/** How many days of login history to check for known IPs/UAs. */
const LOOKBACK_DAYS = 90;

function isEnabled(): boolean {
  return process.env.SUSPICIOUS_LOGIN_ALERTS_ENABLED !== "false";
}

export interface LoginEventInput {
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  clinicId?: string;
}

/**
 * Record a login event and check if the IP/UA combination is new.
 * If new, sends a suspicious-login alert email to the user.
 *
 * This function is fire-and-forget safe -- it catches all errors internally
 * and logs them rather than propagating, so it never blocks the login flow.
 */
export async function recordLoginAndAlert(
  supabase: AnySupabase,
  input: LoginEventInput,
): Promise<{ isNewDevice: boolean }> {
  if (!isEnabled()) {
    return { isNewDevice: false };
  }

  try {
    const { userId, email, ipAddress, userAgent, clinicId } = input;

    // Compute a simple fingerprint from UA for comparison
    const uaFingerprint = userAgent.slice(0, 255);

    // Check recent login history for this user
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);

    const { data: recentLogins } = await supabase
      .from("login_events")
      .select("ip_address, ua_fingerprint")
      .eq("user_id", userId)
      .gte("created_at", cutoffDate.toISOString())
      .limit(500);

    // Record the current login event
    await supabase.from("login_events").insert({
      user_id: userId,
      ip_address: ipAddress,
      ua_fingerprint: uaFingerprint,
      clinic_id: clinicId ?? null,
    });

    // If this is the user's first login ever, don't alert
    if (!recentLogins || recentLogins.length === 0) {
      return { isNewDevice: false };
    }

    // Check if this IP + UA combination has been seen before
    const knownIps = new Set(recentLogins.map((e) => e.ip_address));
    const knownUas = new Set(recentLogins.map((e) => e.ua_fingerprint));

    const isNewIp = !knownIps.has(ipAddress);
    const isNewUa = !knownUas.has(uaFingerprint);

    // Alert if BOTH IP and UA are new (reduces noise from mobile IP changes)
    if (isNewIp && isNewUa) {
      logger.info("Suspicious login detected: new IP and UA", {
        context: "suspicious-login",
        userId,
        ipAddress,
        newIp: isNewIp,
        newUa: isNewUa,
      });

      // Send alert email (fire-and-forget)
      if (email) {
        const template = suspiciousLoginEmail({
          userEmail: email,
          ipAddress,
          userAgent: uaFingerprint,
          loginTime: new Date().toISOString(),
        });

        sendEmail({
          to: email,
          subject: template.subject,
          html: template.html,
        }).catch((err) => {
          logger.warn("Failed to send suspicious login email", {
            context: "suspicious-login",
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      return { isNewDevice: true };
    }

    return { isNewDevice: false };
  } catch (err) {
    // Never block the login flow
    logger.warn("Suspicious login check failed", {
      context: "suspicious-login",
      error: err instanceof Error ? err.message : String(err),
    });
    return { isNewDevice: false };
  }
}
