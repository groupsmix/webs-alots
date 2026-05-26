/**
 * F-A154-b: Suspicious login detection.
 *
 * Detects potentially compromised accounts by tracking login metadata
 * (IP, user-agent, country) and alerting when a new device or location
 * is seen for the first time.
 *
 * This module provides the detection logic. The notification (email
 * alert with revoke link) is handled by the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface LoginContext {
  userId: string;
  ip: string;
  userAgent: string;
  country?: string;
}

export interface LoginRiskSignal {
  isNewDevice: boolean;
  isNewCountry: boolean;
  isNewIp: boolean;
  riskLevel: "low" | "medium" | "high";
  reasons: string[];
}

/**
 * Evaluate login risk by comparing current login context against
 * the user's recent login history stored in audit_logs.
 *
 * @param supabase - Supabase client (service role)
 * @param ctx - Current login context
 * @returns Risk assessment with signals
 */
export async function evaluateLoginRisk(
  supabase: SupabaseClient,
  ctx: LoginContext,
): Promise<LoginRiskSignal> {
  const reasons: string[] = [];

  try {
    // Fetch recent successful logins for this user from activity_logs
    const { data: recentLogins } = await supabase
      .from("activity_logs")
      .select("metadata")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!recentLogins || recentLogins.length === 0) {
      // First login ever — not suspicious, just new
      return {
        isNewDevice: true,
        isNewCountry: false,
        isNewIp: true,
        riskLevel: "low",
        reasons: ["First login for this account"],
      };
    }

    const knownIps = new Set<string>();
    const knownAgents = new Set<string>();
    const knownCountries = new Set<string>();

    for (const log of recentLogins) {
      const meta = log.metadata;
      if (!meta) continue;
      if (typeof meta.ip === "string") knownIps.add(meta.ip);
      if (typeof meta.user_agent === "string") knownAgents.add(meta.user_agent);
      if (typeof meta.country === "string") knownCountries.add(meta.country);
    }

    const isNewIp = !knownIps.has(ctx.ip);
    const isNewDevice = !knownAgents.has(ctx.userAgent);
    const isNewCountry = ctx.country ? !knownCountries.has(ctx.country) : false;

    if (isNewIp) reasons.push("New IP address");
    if (isNewDevice) reasons.push("New device/browser");
    if (isNewCountry) reasons.push(`New country: ${ctx.country}`);

    let riskLevel: "low" | "medium" | "high" = "low";
    if (isNewCountry) riskLevel = "high";
    else if (isNewIp && isNewDevice) riskLevel = "medium";
    else if (isNewIp || isNewDevice) riskLevel = "low";

    return { isNewDevice, isNewCountry, isNewIp, riskLevel, reasons };
  } catch (err) {
    logger.warn("Login risk evaluation failed — defaulting to low risk", {
      context: "suspicious-login",
      userId: ctx.userId,
      error: err,
    });
    return {
      isNewDevice: false,
      isNewCountry: false,
      isNewIp: false,
      riskLevel: "low",
      reasons: ["Risk evaluation unavailable"],
    };
  }
}
