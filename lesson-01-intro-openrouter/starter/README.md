# Lesson 01 (OpenRouter) — starter

`starter` — незавершена навчальна версія з `TODO`. Вона призначена для реалізації
першого запиту із застосунку командного рядка (CLI, Command-Line Interface) до
великої мовної моделі (LLM, Large Language Model) через OpenRouter. Готовий
результат міститься в `solution`.

Загальна підготовка проєкту, пояснення результату й типових помилок наведені в
[кореневому README практики](../README.md).

## Як спочатку побачити готовий результат

Із кореня репозиторію виконується:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn dev:lesson01:openrouter:solution "Обчисли 37 * 19. Поверни лише число."
```

Команда має показати надісланий текст, відповідь `703` та ідентифікатор (ID)
фактичної моделі. Суфікс `:solution` обов'язковий: команда без нього запускає
незавершений `starter`.

## Що потрібно реалізувати

Після завершення starter має:

- прочитати `OPENROUTER_API_KEY` та необов'язкові налаштування з `.env`;
- отримати непорожній запит з аргументів командного рядка;
- надіслати system message і user message до OpenRouter;
- надіслати запит до однієї налаштованої моделі;
- повернути текст та ID фактичної моделі;
- безпечно пояснити network error, timeout, HTTP status і спільний добовий ліміт;
- не вивести ключ, provider body або службові reasoning-поля.

## Робочі файли

```text
src/cli.ts
src/index.ts
tests/cli.test.ts
```

Інші файли не змінюються без окремої причини.

## Порядок роботи

1. Реалізувати `loadEnvironment(env)` через Zod і повертати лише перевірені поля.
2. Реалізувати `readUserInput(args)` з об'єднанням аргументів і `trim()`.
3. Реалізувати `formatApiFailure(error)` без витоку provider body.
4. Реалізувати `requestAnswer(client, environment, input)` із повідомленнями,
   reasoning і `max_tokens` для однієї налаштованої моделі.
5. Замінити всі 21 `it.todo` повноцінними unit-тестами.
6. Запустити фінальну автоматичну перевірку.
7. Виконати один контрольований реальний запит без приватних даних.

## Проміжна перевірка

```powershell
yarn test:lesson01:openrouter
```

Незмінений starter містить `it.todo`, тому проміжний запуск не підтверджує
завершення завдання.

## Focused completeness gate

```powershell
yarn verify:lesson01:openrouter
```

Команда перевіряє, що в тестовому файлі не залишилося жодного `it.todo`, а потім запускає реалізовані unit-тести.

## Повний acceptance-gate

```powershell
yarn check:lesson01:openrouter
```

Команда виконує повний acceptance-пакет для виконаного starter:

- аудит структури та контракту курсу;
- перевірку лінтером (`lint`);
- перевірку форматування (`format:check`);
- перевірку типів TypeScript (`typecheck`);
- перевірку відсутності `it.todo` та повний прогін unit-тестів starter (`verify:lesson01:openrouter`).

## Запуск реалізованого starter

Перед першим реальним запуском створюється локальний `.env` саме для starter:

```powershell
if (-not (Test-Path lesson-01-intro-openrouter/starter/.env)) {
  Copy-Item lesson-01-intro-openrouter/starter/.env.example lesson-01-intro-openrouter/starter/.env
}
notepad lesson-01-intro-openrouter/starter/.env
```

Після завершення `TODO` із кореня репозиторію виконується команда без
`:solution`:

```powershell
yarn dev:lesson01:openrouter "Що таке closure у JavaScript?"
```

Критерій успіху: у терміналі показано надісланий текст, непорожню відповідь і ID
фактичної моделі, після чого процес завершується.

## Важливі обмеження

- Unit-тести не звертаються до реального OpenRouter API.
- Реальний ключ зберігається в `.env`, який ігнорується Git: локальному
  `starter/.env` або кореневому.
- Застосунок використовує одну налаштовану модель за запит і повідомляє про контрольовану помилку, якщо запит не вдався.
- У навчальні запити не додаються персональні або конфіденційні дані.
- Деталі готової реалізації наведено в [solution README](../solution/README.md).
