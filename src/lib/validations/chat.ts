import { z } from "zod";
import { safeText } from "./primitives";

/**
 * A14-01: bound `content` to 2 000 chars at the schema layer to match
 * MAX_MESSAGE_LENGTH in the chat route handler. Prevents unbounded
 * payloads being forwarded to the upstream LLM.
 */
export const CHAT_MESSAGE_CONTENT_MAX = 2000;

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: safeText.pipe(z.string().min(1).max(CHAT_MESSAGE_CONTENT_MAX)),
      }),
    )
    .min(1)
    .max(20),
});

export const aiManagerRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});
