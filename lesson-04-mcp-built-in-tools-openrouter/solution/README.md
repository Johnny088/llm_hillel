# Lesson 04 OpenRouter – готове рішення

Готове рішення поєднує успадковану Lesson 03 OpenRouter основу з локальним filesystem MCP та hosted web search OpenRouter. Власні Lesson 04 модулі зберігаються в solution/src; маршрути й успадковані функції працюють з локального коду цього дерева. Графічного інтерфейсу немає, запит і результат передаються через HTTP JSON.

## Offline та локальна перевірка без provider inference

З кореня репозиторію, де лежить package.json:

```powershell
yarn test:lesson04:openrouter:solution
yarn eval:lesson04:openrouter:solution
yarn build:lesson04:openrouter
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/scripts/smoke-filesystem-mcp.ts
```

Тести й recorded eval використовують контрольовані дані. MCP smoke запускає реальний filesystem server як локальний subprocess і читає лише синтетичні файли у `.tmp/lesson04-mcp-smoke`. Він не робить inference через OpenRouter. Успіх smoke означає, що stdio протокол, дозволений файл і cleanup subprocess спрацювали на цій машині.

## HTTP запит і відповідь

Research endpoint приймає JSON із запитом message, наприклад `{ "message": "Прочитай notes.txt і коротко поясни його вміст." }`. Зі запущеним solution сервером такий запит читає файл у власній sandbox папці. Очікуваний результат має успішний status, текстову відповідь та метрики локальних tool calls. Текст моделі й числові метрики змінюються між запусками.

Окремий запит на актуальну інформацію може активувати hosted web search у OpenRouter. У відповіді перевіряється ознака використаного server tool та посилання-джерела. Це provider-виклик і він не входить до offline gate.

Для ручного HTTP smoke запустіть сервер у першому терміналі з кореня репозиторію:

```powershell
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/src/server.ts
```

Процес продовжує працювати і не повертає запрошення термінала. У другому терміналі можна надіслати HTTP-запит на localhost:3000/api/agent/research. Після перевірки зупиніть сервер через Ctrl+C. Серверний запуск ініціалізує локальний MCP transport; обидва процеси мають закритися при зупинці.

## Опційна демонстрація live

Для реального inference потрібен власний OPENROUTER_API_KEY у кореневому .env та налаштована модель. Не друкуйте ключ у терміналі чи звіті. Команда нижче може витрачати баланс і не потрібна для здачі:

```powershell
node scripts/run-tsx-entrypoint.mjs lesson-04-mcp-built-in-tools-openrouter/solution/src/demo.ts
```

Позначайте цей результат окремо як live provider evidence. Він не замінює offline тести або локальний MCP smoke.
