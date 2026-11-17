import { z } from "zod";

export const MAX_DOCUMENT_CHARACTERS = 20_000;

export const DocumentRequestSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Поле content не може бути порожнім.")
      .max(
        MAX_DOCUMENT_CHARACTERS,
        `Поле content не може перевищувати ${MAX_DOCUMENT_CHARACTERS} символів.`,
      ),
  })
  .strict();

export type DocumentRequest = z.infer<typeof DocumentRequestSchema>;
