/**
 * POST /api/push/subscribe
 *
 * F-05: Persist push notification subscriptions for the current user.
 * Called by sw-register.tsx after the browser grants push permission.
 *
 * Body: PushSubscription JSON (endpoint, keys.p256dh, keys.auth)
 *
 * Stores the subscription in push_subscriptions table scoped to the
 * current user's clinic_id. If the push_subscriptions table does not
 * exist yet, returns 501 so the client can degrade gracefully.
 */

import { z } from "zod";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuthAnyRole } from "@/lib/with-auth";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

export const POST = withAuthAnyRole(async (request, { supabase, user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = pushSubscriptionSchema.safeParse(body);
  if (!result.success) {
    return apiValidationError(result.error.issues.map((i) => i.message).join(", "));
  }

  const subscription = result.data;

  try {
    // Use RPC or raw query since push_subscriptions table may not exist in DB types yet
    const { error } = await supabase.rpc("upsert_push_subscription" as never, {
      p_user_id: user.id,
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
    } as never);

    if (error) {
      // RPC or table might not exist yet — return 501 so the client degrades
      if (error.code === "42883" || error.code === "42P01") {
        logger.info("Push subscription backend not configured yet", {
          context: "push/subscribe",
        });
        return apiError(
          "Push subscriptions are not yet available. The feature is pending backend setup.",
          501,
        );
      }
      logger.error("Failed to save push subscription", {
        context: "push/subscribe",
        error,
      });
      return apiInternalError("Failed to save push subscription");
    }

    return apiSuccess({ subscribed: true });
  } catch (err) {
    logger.error("Push subscription error", {
      context: "push/subscribe",
      error: err,
    });
    return apiInternalError("Failed to process push subscription");
  }
});
