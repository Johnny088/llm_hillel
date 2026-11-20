import { z } from "zod";

export const ExtractionSchema = z
  .object({
    names: z.array(z.string().min(1)).describe("Імена людей, явно присутні у вхідному тексті"),
    dates: z.array(z.string().min(1)).describe("Дати, явно присутні у вхідному тексті"),
    locations: z.array(z.string().min(1)).describe("Локації, явно присутні у вхідному тексті"),
    summary: z.string().min(1).max(600).describe("Короткий нейтральний підсумок без нових фактів"),
  })
  .strict();

export type Extraction = z.infer<typeof ExtractionSchema>;
