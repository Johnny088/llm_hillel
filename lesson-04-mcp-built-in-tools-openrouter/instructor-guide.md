# Lesson 04 OpenRouter – маршрут викладача

## Мета, цінність і поведінка застосунку

### 🎯 Мета проєкту

Під’єднати модель до локальних filesystem tools через MCP і окремо показати hosted `web_search`.

### 💎 Практична цінність застосунку

Студенти розрізняють модель, MCP-клієнт, сервер інструментів та політику дозволених шляхів.

### ⚙️ Що робить застосунок

`src/runtime.ts` створює клієнтів, `src/mcp/filesystem-client.ts` керує сесією, а `src/mcp/filesystem-tools.ts` залишає лише allowlist. Hosted search виконується як інструмент провайдера.

## Послідовність live coding

1. Намалюйте межі: застосунок → MCP client → filesystem server. MCP означає Model Context Protocol, протокол обміну між клієнтом і сервером tools.
2. В `src/mcp/filesystem-client.ts` знайдіть connect/list/call/close. Запитайте, чому runtime має закрити клієнт навіть коли server не стартував повністю.
3. В `src/mcp/filesystem-tools.ts` покажіть allowlist і sandbox. Порівняйте це з `src/services/mcp-web-search-agent.ts`, де hosted search повертає tool result в цикл моделі.
4. Перевірте `tests/filesystem-tools.test.ts`, `tests/server-lifecycle.test.ts` і `tests/mcp-web-search-agent.test.ts` без live мережі.

## Контрольні точки з відповідями

- Дозволене читання synthetic-файла повертає його вміст; шлях поза sandbox відхиляється до читання.
- MCP `listTools` показує доступні інструменти, але застосунок пропускає лише allowlisted назви. Сам факт наявності tool на сервері не є дозволом.
- Помилка під час setup має закрити вже створений клієнт; повторний `close()` не створює другий процес.
- Hosted `web_search` і локальний filesystem – два різні execution paths. Очікуйте synthetic tool result, а не мережеву відповідь.

## Команди еталона

```powershell
corepack yarn test:lesson04:openrouter:solution
corepack yarn eval:lesson04:openrouter:solution
corepack yarn check:lesson04:openrouter:solution
```
