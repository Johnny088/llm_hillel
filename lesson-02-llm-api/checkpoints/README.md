# Lesson 02 — проміжний стан

Checkpoint потрібен викладачу для відновлення лайвкодингу. Студенту для
звичайного проходження достатньо [starter/README.md](../starter/README.md).

`01-streaming/` — робочий стан після реалізації потокового підсумку, але до
Structured Output extraction.

Перевірка checkpoint без мережі:

```powershell
# Команди виконуються з кореня репозиторію, де розташований package.json.
yarn test:lesson02:checkpoints
```

Очікування: 2 test files і 9 пройдених тестів. Успіх — Vitest не показує failed
tests і повертає PowerShell prompt.
