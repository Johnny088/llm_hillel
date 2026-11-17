import { z } from "zod";

export const ExtractionSchema = z
  .object({
    names: z.array(z.string().min(1)).describe("Імена людей, явно присутні у вхідному тексті"),
    dates: z.array(z.string().min(1)).describe("Дати, явно присутні у вхідному тексті"),
    locations: z
      .array(z.string().min(1))
      .describe("Назви локацій без прийменників, явно присутні у вхідному тексті"),
    summary: z.string().min(1).max(600).describe("Короткий нейтральний підсумок без нових фактів"),
  })
  .strict();

export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["names", "dates", "locations", "summary"],
  properties: {
    names: {
      type: "array",
      description: "Імена людей, дослівно скопійовані з вхідного тексту без нормалізації.",
      items: { type: "string", minLength: 1 },
    },
    dates: {
      type: "array",
      description: "Дати, дослівно скопійовані з вхідного тексту без нормалізації.",
      items: { type: "string", minLength: 1 },
    },
    locations: {
      type: "array",
      description:
        "Назви локацій без прийменників, дослівно скопійовані з вхідного тексту без зміни відмінка.",
      items: { type: "string", minLength: 1 },
    },
    summary: {
      type: "string",
      description: "Короткий нейтральний підсумок без нових фактів.",
      minLength: 1,
      maxLength: 600,
    },
  },
} as const;
