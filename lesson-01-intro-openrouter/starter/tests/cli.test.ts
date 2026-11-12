import { describe, it } from "vitest";

describe("CLI helpers — завдання студента (OpenRouter)", () => {
  it.todo("відхиляє відсутній OPENROUTER_API_KEY");
  it.todo("підставляє основну модель та effort за замовчуванням");
  it.todo("відхиляє рівень мислення, якого немає в метаданих моделі");
  it.todo("об'єднує аргументи CLI");
  it.todo("відхиляє порожній CLI input");
  it.todo("безпечно форматує HTTP 401");
  it.todo("безпечно форматує network error");
  it.todo("безпечно форматує timeout");
  it.todo("форматує невідомий статус лише за ім'ям помилки");
  it.todo("форматує generic HTTP 429 без provider payload");
  it.todo("розпізнає реальний AuthenticationError через formatError");
  it.todo("розпізнає реальний APIConnectionError через formatError");
  it.todo("розпізнає реальний APIConnectionTimeoutError через formatError");
  it.todo("безпечно форматує HTTP 429 через formatError");
  it.todo("пропускає повідомлення UserFacingError через formatError");
  it.todo("безпечно маскує непередбачену помилку через formatError");
  it.todo("повертає текст і фактичну модель відповіді через mock");
  it.todo("підставляє дефолтні model, effort і max_completion_tokens у запит");
  it.todo("відхиляє порожній text через mock");
  it.todo("перевіряє синхронізацію з конфігурацією кореневого .env.example");
});
