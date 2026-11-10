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
  it.todo("пояснює спільний добовий ліміт безкоштовних моделей");
  it.todo("розпізнає реальний AuthenticationError через formatError");
  it.todo("розпізнає реальний APIConnectionError через formatError");
  it.todo("розпізнає реальний APIConnectionTimeoutError через formatError");
  it.todo("розпізнає маркер добового free-ліміту через formatError");
  it.todo("пропускає повідомлення UserFacingError через formatError");
  it.todo("безпечно маскує непередбачену помилку через formatError");
  it.todo("повертає текст і фактичну модель відповіді через mock");
  it.todo("підставляє дефолтні model, effort і max_tokens у запит");
  it.todo("відхиляє порожній text через mock");
  it.todo("перевіряє, що основна модель позначена безкоштовним тарифом");
  it.todo("перевіряє, що .env.example не містить реального ключа");
});
