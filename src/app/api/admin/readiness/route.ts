import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { validateEnv, ENV_RULES } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

interface EnvVarStatus {
  name: string;
  description: string;
  status: string;
}

export const GET = withAuth(async () => {
  try {
    const { missing, warnings } = validateEnv();
    
    // Group all rules
    const grouped = new Map<string, EnvVarStatus[]>();
    for (const rule of ENV_RULES) {
      const isMissing = missing.some(m => m.name === rule.name);
      const isWarning = warnings.some(w => w.name === rule.name);
      const status = isMissing || isWarning ? "missing" : "configured";
      
      const list = grouped.get(rule.group) || [];
      list.push({
        name: rule.name,
        description: rule.description,
        status: status, // We never expose the actual value
      });
      grouped.set(rule.group, list);
    }

    const envGroups = Array.from(grouped.entries()).map(([groupName, vars]) => {
      const hasMissing = vars.some(v => v.status === "missing");
      return {
        group: groupName,
        status: hasMissing ? "missing" : "ok",
        vars
      };
    });

    // Check specific services
    const services = [];

    // 1. WhatsApp
    const hasWhatsApp = !missing.some(m => m.name === "WHATSAPP_PHONE_NUMBER_ID") || !missing.some(m => m.name === "TWILIO_ACCOUNT_SID");
    services.push({
      name: "WhatsApp API",
      status: hasWhatsApp ? "operational" : "down",
    });

    // 2. R2 Storage
    const hasR2 = !missing.some(m => m.name === "R2_ACCOUNT_ID") && !missing.some(m => m.name === "R2_ACCESS_KEY_ID");
    services.push({
      name: "Storage (R2)",
      status: hasR2 ? "operational" : "down",
    });

    // 3. Payments
    const hasPayments = !warnings.some(w => w.name === "STRIPE_SECRET_KEY") || !warnings.some(w => w.name === "CMI_MERCHANT_ID");
    services.push({
      name: "Payment Gateway",
      status: hasPayments ? "operational" : "degraded",
    });

    return apiSuccess({
      envGroups,
      services
    });
  } catch (_error) {
    return apiInternalError("Failed to load readiness data");
  }
}, ["super_admin"]);
