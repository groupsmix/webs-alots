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

function normalizeSenderType(senderType: string): "clinic" | "admin" | "system" {
  switch (senderType) {
    case "patient":
      return "clinic";
    case "staff":
      return "admin";
    case "bot":
      return "system";
    case "admin":
    case "system":
    case "clinic":
      return senderType;
    default:
      return "system";
  }
}

function legacySenderType(senderType: string): "patient" | "staff" | "bot" {
  switch (senderType) {
    case "clinic":
      return "patient";
    case "admin":
      return "staff";
    case "system":
    default:
      return "bot";
  }
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticket_id");

    if (!ticketId) {
      return apiValidationError("ticket_id query parameter is required");
    }

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

    const messages = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      ticket_id: String(row.ticket_id),
      sender_id: typeof row.sender_id === "string" ? row.sender_id : null,
      sender_type: normalizeSenderType(
        typeof row.sender_type === "string" ? row.sender_type : "system",
      ),
      message:
        typeof row.message === "string"
          ? row.message
          : typeof row.content === "string"
            ? row.content
            : "",
      created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    }));

    return apiSuccess({ messages });
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

    if (!ticketId) return apiValidationError("ticket_id is required");
    if (!message) return apiValidationError("message is required");
    if (!VALID_SENDER_TYPES.includes(senderType as (typeof VALID_SENDER_TYPES)[number])) {
      return apiValidationError(`sender_type must be one of: ${VALID_SENDER_TYPES.join(", ")}`);
    }

    const supabase = createUntypedAdminClient("super_admin");
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("clinic_id")
      .eq("id", ticketId)
      .single();

    let insertedMessage: Record<string, unknown> | null = null;

    const primaryInsert = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: auth.user.id,
        sender_type: senderType,
        message,
      })
      .select()
      .single();

    if (primaryInsert.error) {
      const fallbackInsert = await supabase
        .from("support_messages")
        .insert({
          clinic_id: (ticket as { clinic_id?: string } | null)?.clinic_id ?? null,
          ticket_id: ticketId,
          sender_id: auth.user.id,
          sender_type: legacySenderType(senderType),
          content: message,
          language: "fr",
          is_auto_reply: senderType === "system",
        })
        .select()
        .single();

      if (fallbackInsert.error) {
        logger.error("Failed to create support message", {
          context: "support-messages-api",
          error: fallbackInsert.error,
        });
        return apiInternalError("Failed to create message");
      }

      insertedMessage = fallbackInsert.data as Record<string, unknown>;
    } else {
      insertedMessage = primaryInsert.data as Record<string, unknown>;
    }

    await supabase
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return apiSuccess(
      {
        message: {
          id: String(insertedMessage.id),
          ticket_id: String(insertedMessage.ticket_id),
          sender_id:
            typeof insertedMessage.sender_id === "string" ? insertedMessage.sender_id : null,
          sender_type: normalizeSenderType(
            typeof insertedMessage.sender_type === "string"
              ? insertedMessage.sender_type
              : senderType,
          ),
          message:
            typeof insertedMessage.message === "string"
              ? insertedMessage.message
              : typeof insertedMessage.content === "string"
                ? insertedMessage.content
                : message,
          created_at:
            typeof insertedMessage.created_at === "string"
              ? insertedMessage.created_at
              : new Date().toISOString(),
        },
      },
      201,
    );
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
