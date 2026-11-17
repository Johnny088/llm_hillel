import { describe, it } from "vitest";

describe("Lesson 02 (OpenRouter) starter — document API", () => {
  it.todo("повертає 200 для GET /health");
  it.todo("відхиляє порожній content із HTTP 400");
  it.todo("відхиляє unknown fields із HTTP 400");
  it.todo("повертає MALFORMED_JSON для невалідного JSON");
  it.todo("повертає PAYLOAD_TOO_LARGE для завеликого body");
  it.todo("викликає chat.completions.create з stream: true та читає usage з фінального chunk");
  it.todo("обробляє stop, length і content_filter у streaming chunks");
  it.todo("повертає data, usage та metrics для extraction");
  it.todo("викликає chat.completions.create з response_format json_schema для DeepSeek");
  it.todo("надсилає named SSE events delta, usage і done");
  it.todo("не надсилає done після incomplete, failed або refusal");
  it.todo("повертає HTTP 504 або SSE GATEWAY_TIMEOUT після timeout OpenRouter API");
});
