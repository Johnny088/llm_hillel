# Lesson 03 (OpenRouter) – успадковані extraction evals

Ця папка містить extraction evals, успадковані з Lesson 02 OpenRouter solution. Їхній код, fixtures і scorer залишаються без змін; назва README та commands нижче вказують на Lesson 03 starter target.

## Offline replay

З кореня репозиторію:

```powershell
yarn eval:lesson03:openrouter
```

Runner повторно оцінює п'ять записаних extraction cases і працює без мережі. Він перевіряє успадкований extraction eval pipeline, а не tool calling і не завершення Lesson 03.

## Optional live extraction

Реальні provider-запити не потрібні для приймання практики. Якщо окремо потрібна жива extraction демонстрація, команда запускається лише після налаштування власного кореневого `./.env`:

```powershell
node scripts/run-tsx-entrypoint.mjs lesson-03-function-calling-openrouter/starter/evals/run.ts --live
```

Цей виклик звертається до OpenRouter і може витратити баланс. Він не доводить, що новий tool-calling маршрут працює.

## Optional public catalog check

Catalog-запит не виконує model inference, але читає актуальний публічний каталог, який може змінитися:

```powershell
node scripts/run-tsx-entrypoint.mjs lesson-03-function-calling-openrouter/starter/evals/live-catalog.ts
```

Offline recorded replay, live extraction і catalog check є різними видами доказів. У цій папці немає tool-calling fixtures чи scorer; вони створюються у student route за [roadmap](../../roadmap-code-guide.md).
