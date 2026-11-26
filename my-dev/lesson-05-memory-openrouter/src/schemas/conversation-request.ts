import { z } from "zod";
import { AgentRequestSchema } from "./agent-request.js";

export const SessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const ConversationIdSchema = z.string().trim().min(1).max(128);

export const ConversationMessageRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("session"),
      sessionId: SessionIdSchema,
      message: AgentRequestSchema.shape.message,
    })
    .strict(),
  z
    .object({
      mode: z.literal("conversation"),
      conversationId: ConversationIdSchema.optional(),
      message: AgentRequestSchema.shape.message,
    })
    .strict(),
]);

export const ConversationResetRequestSchema = z.object({ sessionId: SessionIdSchema }).strict();
export type ConversationMessageRequest = z.infer<typeof ConversationMessageRequestSchema>;
export type ConversationResetRequest = z.infer<typeof ConversationResetRequestSchema>;
