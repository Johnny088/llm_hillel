import { z } from "zod";
import { AgentRequestSchema } from "./agent-request.js";

export const SessionIdSchema = z
  .string()
  .trim()
  .min(1, "Поле sessionId не може бути порожнім.")
  .max(64, "Поле sessionId не може перевищувати 64 символи.")
  .regex(/^[A-Za-z0-9_-]+$/, "Поле sessionId може містити лише латинські літери, цифри, _ та -.");

const ConversationIdSchema = z
  .string()
  .trim()
  .min(1, "Поле conversationId не може бути порожнім.")
  .max(128, "Поле conversationId не може перевищувати 128 символів.");

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

export const ConversationResetRequestSchema = z
  .object({
    sessionId: SessionIdSchema,
  })
  .strict();

export type ConversationMessageRequest = z.infer<typeof ConversationMessageRequestSchema>;
export type ConversationResetRequest = z.infer<typeof ConversationResetRequestSchema>;
