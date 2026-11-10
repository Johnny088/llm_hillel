import { describe, it } from "vitest";

describe("CLI helpers — завдання студента", () => {
  it.todo("відхиляє відсутній OPENAI_API_KEY");
  it.todo("відхиляє відсутній OPENAI_MODEL_FAST");
  it.todo("повертає лише перевірені поля environment");
  it.todo("об'єднує аргументи CLI");
  it.todo("відхиляє порожній CLI input");
  it.todo("безпечно форматує HTTP 401");
  it.todo("безпечно форматує network error");
  it.todo("безпечно форматує timeout");
  it.todo("розпізнає реальний AuthenticationError через formatError");
  it.todo("розпізнає реальний APIConnectionError через formatError");
  it.todo("розпізнає реальний APIConnectionTimeoutError через formatError");
  it.todo("повертає успішну текстову відповідь через mock");
  it.todo("відхиляє порожній output_text через mock");
  it.todo("передає помилку mock-клієнта вище");
});
