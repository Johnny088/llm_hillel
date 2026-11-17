import { describe, it } from "vitest";

describe("Lesson 02 starter — document API", () => {
  it.todo("повертає 200 для GET /health");
  it.todo("відхиляє порожній content із HTTP 400");
  it.todo("відхиляє unknown fields із HTTP 400");
  it.todo("повертає MALFORMED_JSON для невалідного JSON");
  it.todo("повертає PAYLOAD_TOO_LARGE для завеликого body");
  it.todo("викликає responses.parse зі store: false");
  it.todo("обробляє refusal, incomplete і failed structured responses");
  it.todo("повертає data, usage та metrics для extraction");
  it.todo("викликає responses.create зі stream: true і store: false");
  it.todo("надсилає named SSE events delta, usage і done");
  it.todo("не надсилає done після incomplete, failed або refusal");
  it.todo("повертає HTTP 504 або SSE GATEWAY_TIMEOUT після timeout OpenAI API");
});
