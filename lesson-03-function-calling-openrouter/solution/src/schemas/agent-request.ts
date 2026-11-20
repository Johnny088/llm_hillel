import { z } from "zod";

export const MAX_AGENT_MESSAGE_CHARACTERS = 4_000;

export const AgentRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Поле message не може бути порожнім.")
      .max(
        MAX_AGENT_MESSAGE_CHARACTERS,
        `Поле message не може перевищувати ${MAX_AGENT_MESSAGE_CHARACTERS} символів.`,
      ),
  })
  .strict();

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
