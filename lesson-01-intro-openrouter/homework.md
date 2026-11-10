# Домашнє завдання — Lesson 01 (OpenRouter)

## Результат

Завершити особисту копію starter у `my-dev/lesson-01-intro-openrouter/` і створити одноразовий LLM-powered CLI-застосунок на OpenRouter без conversation state, інструментів та agent loop.

## Обов'язково

1. Реалізувати `loadEnvironment(env)` для `OPENROUTER_API_KEY` та необов'язкових `OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`. Базовий URL — константа `OPENROUTER_BASE_URL` (`https://openrouter.ai/api/v1`).
2. Реалізувати `readUserInput(args)` з об'єднанням аргументів, `trim()` і відхиленням порожнього вводу.
3. Реалізувати безпечне форматування HTTP, network, timeout і добової квоти free-моделей (`free-models-per-day`) без витоку ключів, заголовків чи provider body.
4. Реалізувати `requestAnswer(...)` через `openai.chat.completions.create` із системним і користувацьким повідомленнями, однією `model`, `reasoning` та `max_tokens`.
5. Не хардкодити model ID у коді запиту.
6. Виводити надісланий текст, відповідь і фактичну модель (`response.model`), якщо її повернув провайдер.
7. Замінити всі 21 `it.todo` unit-тестами.
8. Не виконувати реальні API calls у тестах.
9. За потреби оновити README у власній копії в `my-dev/lesson-01-intro-openrouter/`.
10. Редагувати лише `my-dev/lesson-01-intro-openrouter/`; не змінювати canonical `starter/` і `solution/` та викладацьку папку `dev/`.
11. Категорично не додавати `.env` до Git або deliverables.

## Acceptance scenarios

| Сценарій                                 | Очікуваний результат                                                 | Як перевіряється                   |
| ---------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| Відсутній `OPENROUTER_API_KEY`           | Безпечне повідомлення без значення ключа                             | unit-тест, без API                 |
| Defaults не задано                       | Використані основна модель і reasoning effort за замовчуванням       | unit-тест, без API                 |
| Невалідний `OPENROUTER_REASONING_EFFORT` | Контрольована помилка схеми Zod                                      | unit-тест, без API                 |
| Порожній CLI input                       | Приклад правильної starter-команди                                   | unit-тест, без API                 |
| HTTP 401                                 | Безпечний статус і `request_id`                                      | mock                               |
| Network error                            | Локалізоване повідомлення без provider body                          | mock                               |
| Timeout                                  | Повідомлення про перевищення часу очікування                         | mock                               |
| Free-model daily limit                   | Пояснення про вичерпання спільної добової квоти безкоштовних моделей | mock                               |
| Порожній response text                   | Контрольована помилка замість порожнього виводу                      | mock                               |
| Успішна відповідь                        | Текст відповіді та фактична модель                                   | mock + один ручний smoke test      |
| Фактичний model ID у відповіді           | Виведено значення, повернуте провайдером                             | mock                               |
| Unit-suite                               | Жодного `it.todo` або skipped mandatory test                         | `yarn test:my:lesson01:openrouter` |

## Перевірка

### Offline-перевірки

Із кореня fork запустіть:

```powershell
yarn test:my:lesson01:openrouter
yarn check:my:lesson01:openrouter
```

`test:my` і `check:my` проходять після заміни всіх 21 `it.todo`; незмінений starter навмисно має strict TODO gate. Повний roadmap додатково створює п'ять тестів free-tier конфігурації. Для перегляду початкових тестів без gate запустіть `yarn vitest run my-dev/lesson-01-intro-openrouter/tests`, де очікуються `0 passed, 21 todo`. Автоматизовані тести не виконують реальних API calls.

### Один контрольований ручний live smoke

Після успішних offline-перевірок виконайте один раз синтетичний запит, якщо у вас є мережа та власний ключ у `my-dev/lesson-01-intro-openrouter/.env`:

```powershell
yarn dev:my:lesson01:openrouter "Поясни коротко, що таке closure у JavaScript."
```

У здачі вкажіть фактичний статус: `PASS`, `FAIL` або `NOT RUN`. Якщо ключ чи мережа недоступні, зазначте `NOT RUN` і не заявляйте про підтверджений live-результат. Не друкуйте ключ і не додавайте `.env` до Git або deliverables.

Робота здається посиланням на доступний fork або репозиторій із назвою гілки та
SHA потрібного commit. Merge request до основного репозиторію курсу не
створюється. `.env` і ключі не додаються до Git.
