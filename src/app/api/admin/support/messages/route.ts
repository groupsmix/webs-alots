/**
 * GET  /api/admin/support/messages?ticket_id=<uuid> — List messages for a ticket
 * POST /api/admin/support/messages — Add a message to a ticket thread
 *
 * All endpoints require super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];
const VALID_SENDER_TYPES = ["clinic", "admin", "system"] as const;

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticket_id");

    if (!ticketId) {
      return apiValidationError("ticket_id query parameter is required");
    }

    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch support messages", {
        context: "support-messages-api",
        error,
      });
      return apiInternalError("Failed to fetch messages");
    }

    return apiSuccess({ messages: data ?? [] });
  } catch (err) {
    logger.error("Unexpected error fetching support messages", {
      context: "support-messages-api",
      error: err,
    });
    return apiInternalError("Failed to fetch messages");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = body as Record<string, unknown>;
    const ticketId = typeof parsed.ticket_id === "string" ? parsed.ticket_id.trim() : "";
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    const senderType = typeof parsed.sender_type === "string" ? parsed.sender_type : "admin";

    if (!ticketId) {
      return apiValidationError("ticket_id is required");
    }
    if (!message) {
      return apiValidationError("message is required");
    }
    if (!VALID_SENDER_TYPES.includes(senderType as (typeof VALID_SENDER_TYPES)[number])) {
      return apiValidationError(`sender_type must be one of: ${VALID_SENDER_TYPES.join(", ")}`);
    }

    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: auth.user.id,
        sender_type: senderType,
        message,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create support message", {
        context: "support-messages-api",
        error,
      });
      return apiInternalError("Failed to create message");
    }

    // Update the ticket's updated_at timestamp
    await supabase
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return apiSuccess({ message: data }, 201);
  } catch (err) {
    logger.error("Unexpected error creating support message", {
      context: "support-messages-api",
      error: err,
    });
    return apiInternalError("Failed to create message");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
